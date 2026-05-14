// backend/routes/leave.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

// GET /api/leave — list requests
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, status, year = new Date().getFullYear() } = req.query;
    const params = [req.orgId];
    const conditions = ['e.org_id = $1'];
    let i = 2;

    if (employee_id) { conditions.push(`lr.employee_id = $${i}`); params.push(employee_id); i++; }
    if (status)      { conditions.push(`lr.status = $${i}`);      params.push(status);      i++; }
    conditions.push(`EXTRACT(YEAR FROM lr.from_date) = $${i}`);
    params.push(year);

    const rows = await db.many(`
      SELECT lr.*, e.first_name || ' ' || e.last_name emp_name, e.employee_code,
             lp.name policy_name, lp.leave_type, lp.is_paid
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_policies lp ON lp.id = lr.policy_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lr.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/leave
router.post('/',
  [body('employee_id').isUUID(), body('policy_id').isUUID(), body('from_date').isISO8601(), body('to_date').isISO8601()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { employee_id, policy_id, from_date, to_date, reason } = req.body;
      const days = Math.ceil((new Date(to_date) - new Date(from_date)) / 86400000) + 1;

      // Check balance
      const balance = await db.one(`
        SELECT * FROM leave_balances WHERE employee_id=$1 AND policy_id=$2 AND year=$3
      `, [employee_id, policy_id, new Date(from_date).getFullYear()]);

      if (balance && (balance.entitled_days - balance.used_days - balance.pending_days) < days) {
        return res.status(400).json({ success: false, message: 'Insufficient leave balance' });
      }

      const req_row = await db.one(`
        INSERT INTO leave_requests (employee_id, policy_id, from_date, to_date, days, reason, status)
        VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *
      `, [employee_id, policy_id, from_date, to_date, days, reason]);

      // Update pending balance
      if (balance) {
        await db.query('UPDATE leave_balances SET pending_days = pending_days + $1 WHERE id = $2', [days, balance.id]);
      }

      res.status(201).json({ success: true, data: req_row });
    } catch (err) { next(err); }
  }
);

// POST /api/leave/:id/approve or /reject
router.post('/:id/:action', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const { action } = req.params;
    if (!['approve','reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action' });

    const leave = await db.one(`
      SELECT lr.*, e.org_id FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      WHERE lr.id = $1
    `, [req.params.id]);

    if (!leave || leave.org_id !== req.orgId) return res.status(404).json({ success: false, message: 'Not found' });
    if (leave.status !== 'pending') return res.status(400).json({ success: false, message: 'Not pending' });

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.query(`
      UPDATE leave_requests SET status=$1, approved_by=$2, approved_at=NOW(), rejection_reason=$3 WHERE id=$4
    `, [newStatus, req.user.id, req.body.reason, req.params.id]);

    if (action === 'approve') {
      await db.query(`
        UPDATE leave_balances SET used_days=used_days+$1, pending_days=GREATEST(pending_days-$1,0)
        WHERE employee_id=$2 AND policy_id=$3 AND year=$4
      `, [leave.days, leave.employee_id, leave.policy_id, new Date(leave.from_date).getFullYear()]);
    } else {
      await db.query(`
        UPDATE leave_balances SET pending_days=GREATEST(pending_days-$1,0)
        WHERE employee_id=$2 AND policy_id=$3 AND year=$4
      `, [leave.days, leave.employee_id, leave.policy_id, new Date(leave.from_date).getFullYear()]);
    }

    res.json({ success: true, message: `Leave ${newStatus}` });
  } catch (err) { next(err); }
});

// GET /api/leave/balances
router.get('/balances', async (req, res, next) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const rows = await db.many(`
      SELECT lb.*, lp.name policy_name, lp.leave_type, lp.is_paid,
             e.first_name || ' ' || e.last_name emp_name, e.employee_code
      FROM leave_balances lb
      JOIN employees e ON e.id = lb.employee_id
      JOIN leave_policies lp ON lp.id = lb.policy_id
      WHERE e.org_id = $1 AND lb.year = $2 AND e.is_active = TRUE
      ORDER BY e.first_name, lp.leave_type
    `, [req.orgId, year]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

module.exports = router;
