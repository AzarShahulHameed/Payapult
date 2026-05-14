// backend/routes/payRuns.js
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

router.post('/',
  authorize('super_admin','admin','hr_manager','accountant'),
  [body('period_start').isISO8601(), body('period_end').isISO8601(), body('pay_date').isISO8601()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { period_start, period_end, pay_date, currency = 'AED', notes } = req.body;

      const result = await db.transaction(async (client) => {
        const employees = await client.query(
          `SELECT * FROM employees WHERE org_id=$1 AND is_active=TRUE AND status='active'`,
          [req.orgId]
        );

        const runRow = await client.query(`
          INSERT INTO pay_runs (org_id,period_start,period_end,pay_date,currency,status,notes,created_by)
          VALUES ($1,$2,$3,$4,$5,'draft',$6,$7) RETURNING *
        `, [req.orgId, period_start, period_end, pay_date, currency, notes, req.user.id]);
        const payRun = runRow.rows[0];

        let totalGross = 0, totalNet = 0, totalDed = 0;

        for (const emp of employees.rows) {
          // Salary components
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

          // Loan deductions — find active installment due this period
          const loanDed = await client.query(`
            SELECT COALESCE(SUM(lr.amount),0) AS total
            FROM loan_repayments lr
            JOIN loans l ON l.id=lr.loan_id
            WHERE l.employee_id=$1 AND l.status='active'
              AND lr.is_paid=FALSE
              AND lr.due_date <= $2
          `, [emp.id, period_end]);
          const loanDeduction = parseFloat(loanDed.rows[0]?.total || 0);

          // Advance deductions
          const advDed = await client.query(`
            SELECT COALESCE(SUM(
              CASE WHEN recovery_months > 0 THEN amount/recovery_months ELSE amount END
            ),0) AS total
            FROM salary_advances
            WHERE employee_id=$1 AND status='approved' AND recovered_amount < amount
          `, [emp.id]);
          const advanceDeduction = parseFloat(advDed.rows[0]?.total || 0);

          const totalDeductions = deductions + loanDeduction + advanceDeduction;
          const netSalary = Math.max(earnings - totalDeductions, 0);

          totalGross += grossSalary;
          totalNet += netSalary;
          totalDed += totalDeductions;

          await client.query(`
            INSERT INTO pay_run_items (
              pay_run_id,employee_id,gross_salary,total_earnings,
              total_deductions,loan_deduction,advance_deduction,net_salary,currency,components
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          `, [payRun.id, emp.id, grossSalary, earnings.toFixed(2), totalDeductions.toFixed(2),
              loanDeduction.toFixed(2), advanceDeduction.toFixed(2), netSalary.toFixed(2),
              currency, JSON.stringify(componentDetails)]);
        }

        await client.query(`
          UPDATE pay_runs SET total_gross=$1,total_net=$2,total_deductions=$3,employee_count=$4 WHERE id=$5
        `, [totalGross.toFixed(2), totalNet.toFixed(2), totalDed.toFixed(2), employees.rows.length, payRun.id]);

        return payRun;
      });
      res.status(201).json({ success: true, data: result, message: 'Pay run created' });
    } catch (err) { next(err); }
  }
);

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

      const items = await client.query('SELECT id,employee_id FROM pay_run_items WHERE pay_run_id=$1', [req.params.id]);
      for (const item of items.rows) {
        await client.query(`INSERT INTO payslips (pay_run_item_id,employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [item.id, item.employee_id]);
      }

      // Mark loan repayments as paid and update recovered advances
      const itemsDetail = await client.query(`
        SELECT pri.employee_id, pri.loan_deduction, pri.advance_deduction
        FROM pay_run_items pri WHERE pri.pay_run_id=$1 AND pri.loan_deduction > 0
      `, [req.params.id]);

      for (const item of itemsDetail.rows) {
        if (parseFloat(item.loan_deduction) > 0) {
          // Mark the relevant installments paid
          const period_end = run.period_end;
          await client.query(`
            UPDATE loan_repayments SET is_paid=TRUE, paid_date=NOW(), paid_amount=amount
            WHERE loan_id IN (SELECT id FROM loans WHERE employee_id=$1 AND status='active')
              AND is_paid=FALSE AND due_date <= $2
          `, [item.employee_id, period_end]);

          // Close loan if fully paid
          await client.query(`
            UPDATE loans SET status='closed'
            WHERE employee_id=$1 AND status='active'
              AND id NOT IN (SELECT loan_id FROM loan_repayments WHERE is_paid=FALSE)
          `, [item.employee_id]);
        }

        if (parseFloat(item.advance_deduction) > 0) {
          await client.query(`
            UPDATE salary_advances
            SET recovered_amount = recovered_amount + (amount/GREATEST(recovery_months,1))
            WHERE employee_id=$1 AND status='approved' AND recovered_amount < amount
          `, [item.employee_id]);
          // Mark fully recovered
          await client.query(`
            UPDATE salary_advances SET status='recovered'
            WHERE employee_id=$1 AND status='approved' AND recovered_amount >= amount
          `, [item.employee_id]);
        }
      }
    });
    res.json({ success: true, message: 'Pay run marked paid, payslips generated, loans/advances updated' });
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
