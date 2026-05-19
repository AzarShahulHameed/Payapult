// backend/routes/payRuns.js — Fixed: LOP, loan EMI, recalculate
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

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

// Core payroll calculation function
async function calculatePayroll(client, orgId, periodStart, periodEnd, currency) {
  const employees = await client.query(
    `SELECT * FROM employees WHERE org_id=$1 AND is_active=TRUE AND status NOT IN ('terminated')`,
    [orgId]
  );

  const items = [];
  let totalGross = 0, totalNet = 0, totalDed = 0;

  for (const emp of employees.rows) {
    // Working days in period
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const totalDays = Math.ceil((end - start) / (1000*60*60*24)) + 1;

    // Check for unpaid leave / LOP in this period
    const lopResult = await client.query(`
      SELECT COALESCE(SUM(
        -- Days of unpaid leave that fall within the pay period
        LEAST(lr.to_date::date, $3::date) - GREATEST(lr.from_date::date, $2::date) + 1
      ), 0) AS lop_days
      FROM leave_requests lr
      JOIN leave_policies lp ON lp.id = lr.policy_id
      WHERE lr.employee_id = $1
        AND lr.status = 'approved'
        AND lp.is_paid = false
        AND lr.from_date <= $3
        AND lr.to_date >= $2
    `, [emp.id, periodStart, periodEnd]);
    const lopDays = parseFloat(lopResult.rows[0]?.lop_days || 0);

    // Get salary components
    const comps = await client.query(`
      SELECT ess.*, sc.name, sc.code, sc.type, sc.calculation, sc.percentage as comp_pct
      FROM employee_salary_structures ess
      JOIN salary_components sc ON sc.id=ess.component_id
      WHERE ess.employee_id=$1 AND ess.is_active=TRUE
    `, [emp.id]);

    let earnings = 0, dedFromComps = 0;
    const componentDetails = [];

    const baseSalary = parseFloat(emp.base_salary);

    if (comps.rows.length > 0) {
      for (const c of comps.rows) {
        let amount = parseFloat(c.amount || 0);
        if (c.calculation === 'percentage_of_basic') {
          amount = (baseSalary * parseFloat(c.percentage || c.comp_pct || 0)) / 100;
        }
        // Apply LOP deduction proportionally to each earning component
        if ((c.type === 'earning' || c.type === 'benefit') && lopDays > 0) {
          const lopDeductionForComp = (amount / totalDays) * lopDays;
          amount = Math.max(amount - lopDeductionForComp, 0);
        }
        componentDetails.push({ name: c.name, code: c.code, type: c.type, amount: parseFloat(amount.toFixed(2)) });
        if (c.type === 'earning' || c.type === 'benefit') earnings += amount;
        else if (c.type === 'deduction') dedFromComps += amount;
      }
    } else {
      earnings = baseSalary;
    }

    // Apply LOP to base salary if no components
    let lopAmount = 0;
    if (comps.rows.length === 0 && lopDays > 0) {
      lopAmount = (baseSalary / totalDays) * lopDays;
      earnings = Math.max(earnings - lopAmount, 0);
    } else if (lopDays > 0) {
      // LOP already applied per component above, just track it
      lopAmount = (baseSalary / totalDays) * lopDays;
    }

    // Add LOP as a deduction line item if applicable
    if (lopDays > 0) {
      componentDetails.push({
        name: `Loss of Pay (${lopDays} days)`,
        code: 'LOP',
        type: 'deduction',
        amount: parseFloat(lopAmount.toFixed(2))
      });
    }

    const grossSalary = baseSalary;

    // ── LOAN: deduct only the current period's EMI installment ──────────────
    const loanDedResult = await client.query(`
      SELECT COALESCE(SUM(lr.amount), 0) AS total
      FROM loan_repayments lr
      JOIN loans l ON l.id = lr.loan_id
      WHERE l.employee_id = $1
        AND l.status = 'active'
        AND lr.is_paid = FALSE
        AND lr.due_date >= $2::date
        AND lr.due_date <= $3::date
    `, [emp.id, periodStart, periodEnd]);
    const loanDeduction = parseFloat(loanDedResult.rows[0]?.total || 0);

    // ── ADVANCE: recover monthly portion ────────────────────────────────────
    const advDedResult = await client.query(`
      SELECT COALESCE(SUM(
        CASE WHEN recovery_months > 0 
          THEN LEAST(amount / recovery_months, amount - recovered_amount)
          ELSE 0 
        END
      ), 0) AS total
      FROM salary_advances
      WHERE employee_id = $1 
        AND status = 'approved' 
        AND recovered_amount < amount
    `, [emp.id]);
    const advanceDeduction = parseFloat(advDedResult.rows[0]?.total || 0);

    const totalDeductions = dedFromComps + loanDeduction + advanceDeduction;
    const netSalary = Math.max(earnings - dedFromComps - loanDeduction - advanceDeduction, 0);

    totalGross += grossSalary;
    totalNet += netSalary;
    totalDed += totalDeductions;

    items.push({
      employee_id: emp.id,
      gross_salary: grossSalary.toFixed(2),
      total_earnings: earnings.toFixed(2),
      total_deductions: totalDeductions.toFixed(2),
      loan_deduction: loanDeduction.toFixed(2),
      advance_deduction: advanceDeduction.toFixed(2),
      lop_days: lopDays,
      lop_amount: lopAmount.toFixed(2),
      net_salary: netSalary.toFixed(2),
      currency,
      components: JSON.stringify(componentDetails),
      working_days: totalDays,
      paid_days: totalDays - lopDays,
    });
  }

  return { items, totalGross, totalNet, totalDed, count: employees.rows.length };
}

// POST /api/pay-runs — Create
router.post('/',
  authorize('super_admin','admin','hr_manager','accountant'),
  [body('period_start').isISO8601(), body('period_end').isISO8601(), body('pay_date').isISO8601()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { period_start, period_end, pay_date, currency = 'AED', notes } = req.body;

      const result = await db.transaction(async (client) => {
        const runRow = await client.query(`
          INSERT INTO pay_runs (org_id,period_start,period_end,pay_date,currency,status,notes,created_by)
          VALUES ($1,$2,$3,$4,$5,'draft',$6,$7) RETURNING *
        `, [req.orgId, period_start, period_end, pay_date, currency, notes, req.user.id]);
        const payRun = runRow.rows[0];

        const { items, totalGross, totalNet, totalDed, count } = await calculatePayroll(client, req.orgId, period_start, period_end, currency);

        for (const item of items) {
          await client.query(`
            INSERT INTO pay_run_items (
              pay_run_id, employee_id, gross_salary, total_earnings,
              total_deductions, loan_deduction, advance_deduction, net_salary,
              currency, components, working_days, paid_days
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [payRun.id, item.employee_id, item.gross_salary, item.total_earnings,
              item.total_deductions, item.loan_deduction, item.advance_deduction,
              item.net_salary, item.currency, item.components,
              item.working_days, item.paid_days]);
        }

        await client.query(`
          UPDATE pay_runs SET total_gross=$1,total_net=$2,total_deductions=$3,employee_count=$4 WHERE id=$5
        `, [totalGross.toFixed(2), totalNet.toFixed(2), totalDed.toFixed(2), count, payRun.id]);

        return { ...payRun, total_gross: totalGross, total_net: totalNet, employee_count: count };
      });
      res.status(201).json({ success: true, data: result, message: 'Pay run created' });
    } catch (err) { next(err); }
  }
);

// POST /api/pay-runs/:id/recalculate — refresh existing draft pay run
router.post('/:id/recalculate', authorize('super_admin','admin','hr_manager','accountant'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (!['draft'].includes(run.status)) return res.status(400).json({ success: false, message: 'Can only recalculate draft pay runs' });

    await db.transaction(async (client) => {
      // Delete existing items
      await client.query('DELETE FROM pay_run_items WHERE pay_run_id=$1', [req.params.id]);

      const { items, totalGross, totalNet, totalDed, count } = await calculatePayroll(
        client, req.orgId, run.period_start, run.period_end, run.currency
      );

      for (const item of items) {
        await client.query(`
          INSERT INTO pay_run_items (
            pay_run_id, employee_id, gross_salary, total_earnings,
            total_deductions, loan_deduction, advance_deduction, net_salary,
            currency, components, working_days, paid_days
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [req.params.id, item.employee_id, item.gross_salary, item.total_earnings,
            item.total_deductions, item.loan_deduction, item.advance_deduction,
            item.net_salary, item.currency, item.components,
            item.working_days, item.paid_days]);
      }

      await client.query(`
        UPDATE pay_runs SET total_gross=$1,total_net=$2,total_deductions=$3,employee_count=$4,updated_at=NOW() WHERE id=$5
      `, [totalGross.toFixed(2), totalNet.toFixed(2), totalDed.toFixed(2), count, req.params.id]);
    });

    const updated = await db.one('SELECT * FROM pay_runs WHERE id=$1', [req.params.id]);
    res.json({ success: true, data: updated, message: 'Pay run recalculated successfully' });
  } catch (err) { next(err); }
});

router.post('/:id/approve', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status !== 'draft') return res.status(400).json({ success: false, message: `Status is ${run.status}` });
    await db.query(`UPDATE pay_runs SET status='approved',approved_by=$1,approved_at=NOW() WHERE id=$2`, [req.user.id, req.params.id]);
    res.json({ success: true, message: 'Approved' });
  } catch (err) { next(err); }
});

router.post('/:id/mark-paid', authorize('super_admin','admin','accountant'), async (req, res, next) => {
  try {
    const run = await db.one('SELECT * FROM pay_runs WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!run) return res.status(404).json({ success: false, message: 'Not found' });
    if (run.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    await db.transaction(async (client) => {
      await client.query(`UPDATE pay_runs SET status='paid',paid_by=$1,paid_at=NOW() WHERE id=$2`, [req.user.id, req.params.id]);
      await client.query(`UPDATE pay_run_items SET is_processed=TRUE WHERE pay_run_id=$1`, [req.params.id]);

      const items = await client.query('SELECT * FROM pay_run_items WHERE pay_run_id=$1', [req.params.id]);

      for (const item of items.rows) {
        // Create payslip
        await client.query(`INSERT INTO payslips (pay_run_item_id,employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [item.id, item.employee_id]);

        // Mark specific loan installments as paid (only the ones due in this period)
        if (parseFloat(item.loan_deduction) > 0) {
          await client.query(`
            UPDATE loan_repayments SET is_paid=TRUE, paid_date=NOW(), paid_amount=amount
            WHERE loan_id IN (SELECT id FROM loans WHERE employee_id=$1 AND status='active')
              AND is_paid=FALSE
              AND due_date >= $2::date
              AND due_date <= $3::date
          `, [item.employee_id, run.period_start, run.period_end]);

          // Check if all installments paid → close loan
          await client.query(`
            UPDATE loans SET status='closed'
            WHERE employee_id=$1 AND status='active'
              AND id NOT IN (
                SELECT DISTINCT loan_id FROM loan_repayments WHERE is_paid=FALSE
              )
          `, [item.employee_id]);
        }

        // Recover advance — only the monthly portion
        if (parseFloat(item.advance_deduction) > 0) {
          await client.query(`
            UPDATE salary_advances
            SET recovered_amount = LEAST(
              recovered_amount + (amount / GREATEST(recovery_months, 1)),
              amount
            )
            WHERE employee_id=$1 AND status='approved' AND recovered_amount < amount
          `, [item.employee_id]);

          // Mark fully recovered advances
          await client.query(`
            UPDATE salary_advances SET status='recovered'
            WHERE employee_id=$1 AND status='approved' AND recovered_amount >= amount
          `, [item.employee_id]);
        }
      }
    });
    res.json({ success: true, message: 'Pay run marked paid' });
  } catch (err) { next(err); }
});

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
