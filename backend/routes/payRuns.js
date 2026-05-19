// backend/routes/payRuns.js — Fixed: LOP, loan per-month, auto-refresh, Cloudinary
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/pay-runs
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.orgId]; const conds = ['pr.org_id=$1']; let i = 2;
    if (status) { conds.push(`pr.status=$${i}`); params.push(status); i++; }
    const [runs, countRow] = await Promise.all([
      db.many(`
        SELECT pr.*, u.first_name||' '||u.last_name created_by_name
        FROM pay_runs pr LEFT JOIN users u ON u.id=pr.created_by
        WHERE ${conds.join(' AND ')} ORDER BY pr.period_start DESC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, limit, offset]),
      db.one(`SELECT COUNT(*) FROM pay_runs pr WHERE ${conds.join(' AND ')}`, params),
    ]);
    res.json({ success: true, data: runs, pagination: { page:+page, limit:+limit, total:+countRow.count } });
  } catch (err) { next(err); }
});

// GET /api/pay-runs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    const items = await db.many(`
      SELECT pri.*, e.first_name||' '||e.last_name emp_name, e.employee_code, e.photo_url,
             d.name dept_name, des.name designation_name
      FROM pay_run_items pri
      JOIN employees e ON e.id=pri.employee_id
      LEFT JOIN departments d ON d.id=e.department_id
      LEFT JOIN designations des ON des.id=e.designation_id
      WHERE pri.pay_run_id=$1 ORDER BY e.first_name
    `, [req.params.id]);
    res.json({ success: true, data: { ...run, items } });
  } catch (err) { next(err); }
});

// Helper: count working days in a month (Mon-Fri)
function countWorkingDays(startDate, endDate) {
  let count = 0;
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count || 1;
}

// POST /api/pay-runs — Create with LOP + correct loan deduction
router.post('/',
  authorize('super_admin','admin','hr_manager','accountant'),
  [body('period_start').isISO8601(), body('period_end').isISO8601(), body('pay_date').isISO8601()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { period_start, period_end, pay_date, currency = 'AED', notes } = req.body;

      // Check for existing non-cancelled run in same period
      const existing = await db.one(`
        SELECT id, status FROM pay_runs
        WHERE org_id=$1 AND status NOT IN ('cancelled')
          AND period_start <= $2 AND period_end >= $3
      `, [req.orgId, period_end, period_start]);

      if (existing) {
        // If draft/approved — recalculate it instead of blocking
        if (['draft','approved'].includes(existing.status)) {
          // Delete old items and recalculate
          await db.query('DELETE FROM pay_run_items WHERE pay_run_id=$1', [existing.id]);
          await recalcPayRun(existing.id, req.orgId, period_start, period_end, currency, req.user.id);
          const updated = await db.one('SELECT * FROM pay_runs WHERE id=$1', [existing.id]);
          return res.json({ success: true, data: updated, message: 'Pay run recalculated' });
        }
        return res.status(409).json({ success: false, message: `A ${existing.status} pay run already exists for this period. Cancel it first.` });
      }

      const result = await db.transaction(async (client) => {
        const runRow = await client.query(`
          INSERT INTO pay_runs (org_id,period_start,period_end,pay_date,currency,status,notes,created_by)
          VALUES ($1,$2,$3,$4,$5,'draft',$6,$7) RETURNING *
        `, [req.orgId, period_start, period_end, pay_date, currency, notes, req.user.id]);
        const payRun = runRow.rows[0];
        await recalcPayRunClient(client, payRun.id, req.orgId, period_start, period_end, currency);
        return db.one('SELECT * FROM pay_runs WHERE id=$1', [payRun.id]);
      });

      res.status(201).json({ success: true, data: result, message: 'Pay run created' });
    } catch (err) { next(err); }
  }
);

// POST /api/pay-runs/:id/recalculate — refresh existing pay run
router.post('/:id/recalculate', authorize('super_admin','admin','hr_manager','accountant'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot recalculate a paid run' });

    await db.query('DELETE FROM pay_run_items WHERE pay_run_id=$1', [req.params.id]);
    await recalcPayRun(run.id, req.orgId, run.period_start, run.period_end, run.currency, req.user.id);
    const updated = await db.one('SELECT * FROM pay_runs WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Pay run recalculated successfully' });
  } catch (err) { next(err); }
});

// Core calculation function (uses pool directly)
async function recalcPayRun(runId, orgId, period_start, period_end, currency, userId) {
  return db.transaction(async (client) => {
    await recalcPayRunClient(client, runId, orgId, period_start, period_end, currency);
  });
}

async function recalcPayRunClient(client, runId, orgId, period_start, period_end, currency) {
  // Get all active employees
  const employees = await client.query(
    `SELECT * FROM employees WHERE org_id=$1 AND is_active=TRUE AND status IN ('active','on_leave')`,
    [orgId]
  );

  const totalWorkingDays = countWorkingDays(period_start, period_end);
  let totalGross = 0, totalNet = 0, totalDed = 0;

  for (const emp of employees.rows) {
    // ── 1. Salary components ─────────────────────────────────────────────────
    const comps = await client.query(`
      SELECT ess.*, sc.name, sc.code, sc.type, sc.calculation, sc.percentage as comp_pct
      FROM employee_salary_structures ess
      JOIN salary_components sc ON sc.id=ess.component_id
      WHERE ess.employee_id=$1 AND ess.is_active=TRUE
    `, [emp.id]);

    let earnings = 0, deductions = 0;
    const componentDetails = [];

    if (comps.rows.length > 0) {
      for (const c of comps.rows) {
        let amount = parseFloat(c.amount);
        if (c.calculation === 'percentage_of_basic') {
          amount = (parseFloat(emp.base_salary) * parseFloat(c.percentage || c.comp_pct || 0)) / 100;
        }
        componentDetails.push({ name: c.name, code: c.code, type: c.type, amount: amount.toFixed(2) });
        if (c.type === 'earning' || c.type === 'benefit') earnings += amount;
        else if (c.type === 'deduction') deductions += amount;
      }
    } else {
      earnings = parseFloat(emp.base_salary);
    }

    const grossSalary = parseFloat(emp.base_salary);

    // ── 2. LOP (Loss of Pay) — count unpaid approved leaves in period ────────
    const lopResult = await client.query(`
      SELECT COALESCE(SUM(lr.days), 0) AS lop_days
      FROM leave_requests lr
      JOIN leave_policies lp ON lp.id = lr.policy_id
      WHERE lr.employee_id = $1
        AND lr.status = 'approved'
        AND lp.is_paid = FALSE
        AND lr.from_date <= $2
        AND lr.to_date >= $3
    `, [emp.id, period_end, period_start]);

    const lopDays = parseFloat(lopResult.rows[0]?.lop_days || 0);
    const dailyRate = grossSalary / totalWorkingDays;
    const lopDeduction = lopDays > 0 ? Math.min(lopDays * dailyRate, earnings) : 0;

    if (lopDays > 0) {
      componentDetails.push({
        name: `LOP (${lopDays} day${lopDays > 1 ? 's' : ''})`,
        code: 'LOP',
        type: 'deduction',
        amount: lopDeduction.toFixed(2)
      });
      deductions += lopDeduction;
      earnings = Math.max(earnings - lopDeduction, 0);
    }

    // ── 3. Loan deduction — ONLY the current month's EMI installment ─────────
    // Find the ONE installment due in this pay period (not all unpaid ones)
    const loanInstallment = await client.query(`
      SELECT COALESCE(SUM(lr.amount), 0) AS emi
      FROM loan_repayments lr
      JOIN loans l ON l.id = lr.loan_id
      WHERE l.employee_id = $1
        AND l.status = 'active'
        AND lr.is_paid = FALSE
        AND lr.due_date >= $2
        AND lr.due_date <= $3
    `, [emp.id, period_start, period_end]);
    const loanDeduction = parseFloat(loanInstallment.rows[0]?.emi || 0);

    // ── 4. Advance deduction — monthly recovery amount ───────────────────────
    const advResult = await client.query(`
      SELECT COALESCE(SUM(
        ROUND((amount / GREATEST(recovery_months, 1))::numeric, 2)
      ), 0) AS monthly_recovery
      FROM salary_advances
      WHERE employee_id = $1
        AND status = 'approved'
        AND recovered_amount < amount
    `, [emp.id]);
    const advanceDeduction = parseFloat(advResult.rows[0]?.monthly_recovery || 0);

    // ── 5. Calculate net ──────────────────────────────────────────────────────
    const totalDeductions = deductions + loanDeduction + advanceDeduction;
    const netSalary = Math.max(earnings - loanDeduction - advanceDeduction, 0);

    totalGross += grossSalary;
    totalNet += netSalary;
    totalDed += totalDeductions;

    await client.query(`
      INSERT INTO pay_run_items (
        pay_run_id, employee_id, gross_salary, total_earnings,
        total_deductions, loan_deduction, advance_deduction, net_salary,
        currency, components, working_days, leave_days
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `, [
      runId, emp.id, grossSalary, earnings.toFixed(2),
      totalDeductions.toFixed(2), loanDeduction.toFixed(2),
      advanceDeduction.toFixed(2), netSalary.toFixed(2),
      currency, JSON.stringify(componentDetails),
      totalWorkingDays, lopDays,
    ]);
  }

  // Update totals
  await client.query(`
    UPDATE pay_runs
    SET total_gross=$1, total_net=$2, total_deductions=$3, employee_count=$4
    WHERE id=$5
  `, [totalGross.toFixed(2), totalNet.toFixed(2), totalDed.toFixed(2), employees.rows.length, runId]);
}

// POST /api/pay-runs/:id/approve
router.post('/:id/approve', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status !== 'draft') return res.status(400).json({ success: false, message: `Status is ${run.status}` });
    await db.query(`UPDATE pay_runs SET status='approved',approved_by=$1,approved_at=NOW() WHERE id=$2`, [req.user.id, req.params.id]);
    res.json({ success: true, message: 'Approved' });
  } catch (err) { next(err); }
});

// POST /api/pay-runs/:id/mark-paid
router.post('/:id/mark-paid', authorize('super_admin','admin','accountant'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    await db.transaction(async (client) => {
      await client.query(`UPDATE pay_runs SET status='paid',paid_by=$1,paid_at=NOW() WHERE id=$2`, [req.user.id, req.params.id]);
      await client.query(`UPDATE pay_run_items SET is_processed=TRUE WHERE pay_run_id=$1`, [req.params.id]);

      const items = await client.query('SELECT id,employee_id FROM pay_run_items WHERE pay_run_id=$1', [req.params.id]);
      for (const item of items.rows) {
        await client.query(`INSERT INTO payslips (pay_run_item_id,employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [item.id, item.employee_id]);
      }

      // Mark only this period's loan installments as paid
      const itemsDetail = await client.query(`
        SELECT pri.employee_id, pri.loan_deduction, pri.advance_deduction
        FROM pay_run_items pri WHERE pri.pay_run_id=$1
      `, [req.params.id]);

      for (const item of itemsDetail.rows) {
        if (parseFloat(item.loan_deduction) > 0) {
          // Mark ONLY the installments due in this period as paid
          await client.query(`
            UPDATE loan_repayments SET is_paid=TRUE, paid_date=NOW(), paid_amount=amount
            WHERE loan_id IN (SELECT id FROM loans WHERE employee_id=$1 AND status='active')
              AND is_paid=FALSE
              AND due_date >= $2 AND due_date <= $3
          `, [item.employee_id, run.period_start, run.period_end]);

          // Close loan if all installments paid
          await client.query(`
            UPDATE loans SET status='closed'
            WHERE employee_id=$1 AND status='active'
              AND id NOT IN (
                SELECT loan_id FROM loan_repayments WHERE is_paid=FALSE
              )
          `, [item.employee_id]);
        }

        if (parseFloat(item.advance_deduction) > 0) {
          await client.query(`
            UPDATE salary_advances
            SET recovered_amount = LEAST(recovered_amount + (amount/GREATEST(recovery_months,1)), amount)
            WHERE employee_id=$1 AND status='approved' AND recovered_amount < amount
          `, [item.employee_id]);
          await client.query(`
            UPDATE salary_advances SET status='recovered'
            WHERE employee_id=$1 AND status='approved' AND recovered_amount >= amount
          `, [item.employee_id]);
        }
      }
    });
    res.json({ success: true, message: 'Pay run marked paid, payslips generated' });
  } catch (err) { next(err); }
});

// DELETE /api/pay-runs/:id
router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT status FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot cancel paid run' });
    await db.query(`UPDATE pay_runs SET status='cancelled' WHERE id=$1`, [req.params.id]);
    res.json({ success: true, message: 'Cancelled' });
  } catch (err) { next(err); }
});

module.exports = router;
