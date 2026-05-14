// backend/routes/loans.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/loans
router.get('/', async (req, res, next) => {
  try {
    const { status, employee_id } = req.query;
    const params = [req.orgId];
    const conds = ['l.org_id = $1'];
    let i = 2;
    if (status)      { conds.push(`l.status = $${i}`);       params.push(status);      i++; }
    if (employee_id) { conds.push(`l.employee_id = $${i}`);  params.push(employee_id); i++; }

    const rows = await db.many(`
      SELECT l.*,
             e.first_name || ' ' || e.last_name emp_name, e.employee_code,
             COALESCE(SUM(lr.paid_amount),0) total_paid,
             l.amount - COALESCE(SUM(lr.paid_amount),0) remaining,
             COUNT(lr.id) FILTER (WHERE lr.is_paid) paid_count
      FROM loans l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN loan_repayments lr ON lr.loan_id = l.id
      WHERE ${conds.join(' AND ')}
      GROUP BY l.id, e.id
      ORDER BY l.created_at DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/loans
router.post('/',
  authorize('super_admin','admin','hr_manager'),
  [body('employee_id').isUUID(), body('amount').isFloat({min:1}), body('tenure_months').isInt({min:1,max:120})],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { employee_id, amount, interest_rate = 0, tenure_months, disbursed_date, first_emi_date, reason, currency = 'AED' } = req.body;
      const emi = amount * (1 + interest_rate / 100) / tenure_months;

      const countRow = await db.one('SELECT COUNT(*) FROM loans WHERE org_id=$1', [req.orgId]);
      const loanNo = `LOAN-${new Date().getFullYear()}-${String(parseInt(countRow.count)+1).padStart(4,'0')}`;

      const loan = await db.one(`
        INSERT INTO loans (org_id,employee_id,loan_number,amount,currency,interest_rate,tenure_months,emi_amount,disbursed_date,first_emi_date,reason,status,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING *
      `, [req.orgId, employee_id, loanNo, amount, currency, interest_rate, tenure_months, emi.toFixed(2), disbursed_date, first_emi_date, reason, req.user.id]);

      res.status(201).json({ success: true, data: loan });
    } catch (err) { next(err); }
  }
);

// POST /api/loans/:id/approve
router.post('/:id/approve', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const loan = await db.one('SELECT * FROM loans WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!loan) return res.status(404).json({ success: false, message: 'Not found' });
    if (loan.status !== 'pending') return res.status(400).json({ success: false, message: 'Loan is not pending' });

    await db.transaction(async (client) => {
      await client.query(`UPDATE loans SET status='active', approved_by=$1, approved_at=NOW() WHERE id=$2`, [req.user.id, loan.id]);

      // Generate repayment schedule
      const startDate = new Date(loan.first_emi_date || loan.disbursed_date);
      for (let i = 0; i < loan.tenure_months; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        await client.query(`
          INSERT INTO loan_repayments (loan_id, installment_no, due_date, amount)
          VALUES ($1,$2,$3,$4)
        `, [loan.id, i+1, dueDate.toISOString().split('T')[0], loan.emi_amount]);
      }
    });

    res.json({ success: true, message: 'Loan approved and repayment schedule generated' });
  } catch (err) { next(err); }
});

// GET /api/loans/:id/schedule
router.get('/:id/schedule', async (req, res, next) => {
  try {
    const schedule = await db.many(`
      SELECT * FROM loan_repayments WHERE loan_id=$1 ORDER BY installment_no
    `, [req.params.id]);
    res.json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

module.exports = router;


// ─── ADVANCES ────────────────────────────────────────────────────────────────
const advRouter = express.Router();
advRouter.use(authenticate);

// GET /api/advances
advRouter.get('/', async (req, res, next) => {
  try {
    const rows = await db.many(`
      SELECT sa.*, e.first_name || ' ' || e.last_name emp_name, e.employee_code
      FROM salary_advances sa
      JOIN employees e ON e.id = sa.employee_id
      WHERE sa.org_id = $1
      ORDER BY sa.created_at DESC
    `, [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// POST /api/advances
advRouter.post('/',
  [body('employee_id').isUUID(), body('amount').isFloat({min:1})],
  async (req, res, next) => {
    try {
      const { employee_id, amount, reason, recovery_months = 1, currency = 'AED' } = req.body;
      const countRow = await db.one('SELECT COUNT(*) FROM salary_advances WHERE org_id=$1', [req.orgId]);
      const advNo = `ADV-${new Date().getFullYear()}-${String(parseInt(countRow.count)+1).padStart(4,'0')}`;

      const adv = await db.one(`
        INSERT INTO salary_advances (org_id,employee_id,advance_number,amount,currency,reason,recovery_months,status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *
      `, [req.orgId, employee_id, advNo, amount, currency, reason, recovery_months]);
      res.status(201).json({ success: true, data: adv });
    } catch (err) { next(err); }
  }
);

// POST /api/advances/:id/approve or /reject
advRouter.post('/:id/:action', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const { action } = req.params;
    if (!['approve','reject'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid action' });
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await db.query(`UPDATE salary_advances SET status=$1, approved_by=$2, approved_at=NOW() WHERE id=$3 AND org_id=$4`,
      [newStatus, req.user.id, req.params.id, req.orgId]);
    res.json({ success: true, message: `Advance ${newStatus}` });
  } catch (err) { next(err); }
});


module.exports = router;
module.exports.advancesRouter = advRouter;
