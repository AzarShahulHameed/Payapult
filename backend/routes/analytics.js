// backend/routes/analytics.js
const express = require('express');
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/analytics/dashboard — summary stats
router.get('/dashboard', async (req, res, next) => {
  try {
    const orgId = req.orgId;

    const [empStats, leaveStats, loanStats, deptStats, monthlyTrend] = await Promise.all([
      db.many(`SELECT status, COUNT(*) count FROM employees WHERE org_id=$1 AND is_active=TRUE GROUP BY status`, [orgId]),
      db.one(`
        SELECT COUNT(*) FILTER (WHERE lr.status='pending') pending,
               COUNT(*) FILTER (WHERE lr.status='approved' AND lr.from_date <= CURRENT_DATE AND lr.to_date >= CURRENT_DATE) on_leave_today
        FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id WHERE e.org_id=$1
      `, [orgId]),
      db.one(`
        SELECT COUNT(*) FILTER (WHERE status='active') active_loans,
               SUM(amount) FILTER (WHERE status='active') total_loan_amount
        FROM loans WHERE org_id=$1
      `, [orgId]),
      db.many(`
        SELECT d.name dept, SUM(e.base_salary) total_spend, COUNT(e.id) headcount
        FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.org_id=$1 AND e.is_active=TRUE AND e.status='active'
        GROUP BY d.name ORDER BY total_spend DESC
      `, [orgId]),
      db.many(`
        SELECT TO_CHAR(period_start,'Mon') AS mo,
               EXTRACT(YEAR FROM period_start) AS yr,
               EXTRACT(MONTH FROM period_start) AS mo_num,
               SUM(total_gross) total_gross,
               SUM(total_net) total_net,
               SUM(employee_count) employee_count
        FROM pay_runs
        WHERE org_id=$1 AND status IN ('paid','approved')
          AND period_start >= NOW() - INTERVAL '12 months'
        GROUP BY mo, yr, mo_num
        ORDER BY yr, mo_num
      `, [orgId]),
    ]);

    // Latest pay run separately to avoid crashing on no data
    let payrollStats = null;
    try {
      payrollStats = await db.oneOrNone(`
        SELECT total_gross, total_net, total_deductions, employee_count, pay_date, status, currency
        FROM pay_runs WHERE org_id=$1 AND status IN ('paid','approved','draft')
        ORDER BY period_start DESC LIMIT 1
      `, [orgId]);
    } catch(_) {}

    // Normalize monthlyTrend keys
    const trend = monthlyTrend.map(r => ({ ...r, month: r.mo, year: r.yr, month_num: r.mo_num }));

    res.json({
      success: true,
      data: {
        employees: empStats,
        latestPayRun: payrollStats,
        leave: leaveStats,
        loans: loanStats,
        deptSpend: deptStats,
        monthlyTrend: trend,
      }
    });
  } catch (err) { next(err); }
});

// GET /api/analytics/payroll — detailed payroll analytics
router.get('/payroll', async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const rows = await db.manyOrNone(`
      SELECT
        TO_CHAR(pr.period_start,'Mon') AS mo,
        EXTRACT(MONTH FROM pr.period_start) AS mo_num,
        SUM(pr.total_gross) total_gross,
        SUM(pr.total_net) total_net,
        SUM(pr.total_deductions) total_deductions,
        AVG(pr.total_gross / NULLIF(pr.employee_count,0)) avg_gross,
        SUM(pr.employee_count) headcount
      FROM pay_runs pr
      WHERE pr.org_id=$1 AND EXTRACT(YEAR FROM pr.period_start)=$2
        AND pr.status IN ('paid','approved')
      GROUP BY mo, mo_num
      ORDER BY mo_num
    `, [req.orgId, year]);
    res.json({ success: true, data: rows || [] });
  } catch (err) { next(err); }
});

// GET /api/analytics/headcount
router.get('/headcount', async (req, res, next) => {
  try {
    const [byDept, byGender, byStatus, orgTree] = await Promise.all([
      db.manyOrNone(`
        SELECT d.name dept, COUNT(e.id) count, SUM(e.base_salary) total_salary
        FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.org_id=$1 AND e.is_active=TRUE
        GROUP BY d.name ORDER BY count DESC
      `, [req.orgId]),
      db.manyOrNone(`SELECT gender, COUNT(*) count FROM employees WHERE org_id=$1 AND is_active=TRUE GROUP BY gender`, [req.orgId]),
      db.manyOrNone(`SELECT status, COUNT(*) count FROM employees WHERE org_id=$1 AND is_active=TRUE GROUP BY status`, [req.orgId]),
      db.manyOrNone(`
        SELECT e.id, e.first_name || ' ' || e.last_name full_name, e.employee_code,
               e.manager_id, des.name designation, d.name department
        FROM employees e
        LEFT JOIN designations des ON des.id = e.designation_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.org_id=$1 AND e.is_active=TRUE
        ORDER BY e.join_date
      `, [req.orgId]),
    ]);
    res.json({ success: true, data: { byDept: byDept||[], byGender: byGender||[], byStatus: byStatus||[], orgTree: orgTree||[] } });
  } catch (err) { next(err); }
});

// GET /api/analytics/reports/:type
router.get('/reports/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { department_id, year = new Date().getFullYear(), month } = req.query;
    let data;

    if (type === 'payroll-detail') {
      const baseParams = [req.orgId, year];
      const monthFilter = month ? `AND EXTRACT(MONTH FROM pr.period_start)=$3` : '';
      if (month) baseParams.push(month);
      data = await db.manyOrNone(`
        SELECT e.employee_code, e.first_name || ' ' || e.last_name emp_name,
               d.name department, des.name designation,
               pri.gross_salary, pri.total_deductions, pri.loan_deduction, pri.advance_deduction,
               pri.net_salary, pri.currency, pr.period_start, pr.period_end, pr.pay_date
        FROM pay_run_items pri
        JOIN pay_runs pr ON pr.id = pri.pay_run_id
        JOIN employees e ON e.id = pri.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN designations des ON des.id = e.designation_id
        WHERE pr.org_id=$1 AND EXTRACT(YEAR FROM pr.period_start)=$2
          ${monthFilter}
        ORDER BY pr.period_start DESC, e.first_name
      `, baseParams);
    }
    else if (type === 'leave-summary') {
      data = await db.manyOrNone(`
        SELECT e.employee_code, e.first_name || ' ' || e.last_name emp_name,
               d.name department, lp.leave_type,
               lb.entitled_days, lb.used_days, lb.pending_days,
               lb.entitled_days - lb.used_days - lb.pending_days balance
        FROM leave_balances lb
        JOIN employees e ON e.id = lb.employee_id
        JOIN leave_policies lp ON lp.id = lb.policy_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.org_id=$1 AND lb.year=$2 AND e.is_active=TRUE
        ORDER BY e.first_name, lp.leave_type
      `, [req.orgId, year]);
    }
    else if (type === 'loan-status') {
      data = await db.manyOrNone(`
        SELECT l.loan_number, e.first_name || ' ' || e.last_name emp_name, e.employee_code,
               l.amount, l.emi_amount, l.tenure_months, l.status, l.disbursed_date,
               COALESCE(SUM(lr.paid_amount),0) paid,
               l.amount - COALESCE(SUM(lr.paid_amount),0) outstanding
        FROM loans l
        JOIN employees e ON e.id = l.employee_id
        LEFT JOIN loan_repayments lr ON lr.loan_id = l.id
        WHERE l.org_id=$1
        GROUP BY l.id, e.id
        ORDER BY l.created_at DESC
      `, [req.orgId]);
    }
    else if (type === 'headcount-tree') {
      data = await db.manyOrNone(`
        SELECT e.id, e.first_name || ' ' || e.last_name full_name, e.employee_code,
               e.manager_id, des.name designation, d.name department,
               e.base_salary, e.status, e.join_date, e.gender
        FROM employees e
        LEFT JOIN designations des ON des.id = e.designation_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.org_id=$1 AND e.is_active=TRUE
        ORDER BY e.join_date
      `, [req.orgId]);
    }
    else {
      return res.status(400).json({ success: false, message: 'Unknown report type' });
    }

    res.json({ success: true, data: data || [] });
  } catch (err) { next(err); }
});

module.exports = router;
