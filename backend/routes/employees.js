// backend/routes/employees.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/employees
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, department_id, status } = req.query;
    const offset = (page - 1) * limit;
    const params = [req.orgId];
    const conditions = ['e.org_id = $1', 'e.is_active = TRUE'];
    let i = 2;
    if (search) {
      conditions.push(`(e.first_name ILIKE $${i} OR e.last_name ILIKE $${i} OR e.email ILIKE $${i} OR e.employee_code ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    if (department_id) { conditions.push(`e.department_id = $${i}`); params.push(department_id); i++; }
    if (status) { conditions.push(`e.status = $${i}`); params.push(status); i++; }
    const where = conditions.join(' AND ');

    const [rows, countRow] = await Promise.all([
      db.many(`
        SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.phone,
               e.gender, e.status, e.join_date, e.base_salary, e.currency,
               e.photo_url, e.employment_type,
               d.name dept_name, des.name designation_name,
               wl.name work_location_name, wl.timezone, wl.country_code,
               m.first_name || ' ' || m.last_name manager_name
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN designations des ON des.id = e.designation_id
        LEFT JOIN work_locations wl ON wl.id = e.work_location_id
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE ${where}
        ORDER BY e.first_name ASC
        LIMIT $${i} OFFSET $${i+1}
      `, [...params, limit, offset]),
      db.one(`SELECT COUNT(*) FROM employees e WHERE ${where}`, params),
    ]);
    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total: +countRow.count, pages: Math.ceil(countRow.count / limit) } });
  } catch (err) { next(err); }
});

// GET /api/employees/:id
router.get('/:id', async (req, res, next) => {
  try {
    const emp = await db.one(`
      SELECT e.*, d.name dept_name, des.name designation_name,
             wl.name work_location_name, wl.timezone, wl.country_code,
             m.first_name || ' ' || m.last_name manager_name
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN work_locations wl ON wl.id = e.work_location_id
      LEFT JOIN employees m ON m.id = e.manager_id
      WHERE e.id = $1 AND e.org_id = $2 AND e.is_active = TRUE
    `, [req.params.id, req.orgId]);
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    const salaryStructure = await db.many(`
      SELECT ess.*, sc.name, sc.code, sc.type, sc.calculation
      FROM employee_salary_structures ess
      JOIN salary_components sc ON sc.id = ess.component_id
      WHERE ess.employee_id = $1 AND ess.is_active = TRUE
    `, [req.params.id]);

    const leaveBalances = await db.many(`
      SELECT lb.*, lp.name policy_name, lp.leave_type
      FROM leave_balances lb
      JOIN leave_policies lp ON lp.id = lb.policy_id
      WHERE lb.employee_id = $1 AND lb.year = EXTRACT(YEAR FROM NOW())
    `, [req.params.id]);

    res.json({ success: true, data: { ...emp, salaryStructure, leaveBalances } });
  } catch (err) { next(err); }
});

// POST /api/employees — Create (join_date optional, defaults to today)
router.post('/',
  authorize('super_admin','admin','hr_manager'),
  [
    body('first_name').trim().notEmpty().withMessage('First name required'),
    body('last_name').trim().notEmpty().withMessage('Last name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('base_salary').isFloat({ min: 0 }).withMessage('Base salary required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const {
        first_name, last_name, middle_name, email, personal_email, phone,
        date_of_birth, gender, nationality, national_id, passport_no,
        department_id, designation_id, work_location_id, manager_id,
        join_date, probation_end_date, employment_type,
        base_salary, currency = 'AED',
        bank_name, bank_account_no, bank_iban, bank_swift,
        tax_id, social_security_no, photo_url,
      } = req.body;

      // Auto employee code
      const countRow = await db.one('SELECT COUNT(*) FROM employees WHERE org_id = $1', [req.orgId]);
      const empCode = `EMP-${String(parseInt(countRow.count) + 1001).padStart(4,'0')}`;
      const joinDate = join_date || new Date().toISOString().split('T')[0];

      const emp = await db.one(`
        INSERT INTO employees (
          org_id, employee_code, first_name, last_name, middle_name,
          email, personal_email, phone, date_of_birth, gender,
          nationality, national_id, passport_no,
          department_id, designation_id, work_location_id, manager_id,
          join_date, probation_end_date, employment_type,
          base_salary, currency, photo_url,
          bank_name, bank_account_no, bank_iban, bank_swift,
          tax_id, social_security_no, status, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,'active',$30
        ) RETURNING *
      `, [
        req.orgId, empCode, first_name, last_name, middle_name || null,
        email, personal_email || null, phone || null, date_of_birth || null, gender || null,
        nationality || null, national_id || null, passport_no || null,
        department_id || null, designation_id || null, work_location_id || null, manager_id || null,
        joinDate, probation_end_date || null, employment_type || 'full_time',
        base_salary, currency, photo_url || null,
        bank_name || null, bank_account_no || null, bank_iban || null, bank_swift || null,
        tax_id || null, social_security_no || null,
        req.user.id,
      ]);

      // Create leave balances for this employee
      const policies = await db.many('SELECT * FROM leave_policies WHERE org_id=$1 AND is_active=TRUE', [req.orgId]);
      const year = new Date().getFullYear();
      for (const p of policies) {
        await db.query(`
          INSERT INTO leave_balances (employee_id, policy_id, year, entitled_days)
          VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
        `, [emp.id, p.id, year, p.days_allowed]);
      }

      res.status(201).json({ success: true, data: emp, message: 'Employee created' });
    } catch (err) { next(err); }
  }
);

// PUT /api/employees/:id
router.put('/:id', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const fields = [
      'first_name','last_name','middle_name','email','personal_email','phone',
      'date_of_birth','gender','nationality','national_id','passport_no',
      'department_id','designation_id','work_location_id','manager_id',
      'employment_type','base_salary','currency','bank_name','bank_account_no',
      'bank_iban','bank_swift','status','photo_url','tax_id','social_security_no'
    ];
    const updates = []; const params = []; let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${i}`); params.push(req.body[f]); i++; }
    }
    if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id, req.orgId);
    const emp = await db.one(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = $${i} AND org_id = $${i+1} RETURNING *`,
      params
    );
    res.json({ success: true, data: emp });
  } catch (err) { next(err); }
});

// DELETE /api/employees/:id
router.delete('/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query(
      `UPDATE employees SET is_active=FALSE, status='terminated', termination_date=NOW() WHERE id=$1 AND org_id=$2`,
      [req.params.id, req.orgId]
    );
    res.json({ success: true, message: 'Employee deactivated' });
  } catch (err) { next(err); }
});

// GET /api/employees/:id/payslips
router.get('/:id/payslips', async (req, res, next) => {
  try {
    const slips = await db.many(`
      SELECT p.*, pr.period_start, pr.period_end, pr.pay_date,
             pri.gross_salary, pri.net_salary, pri.total_deductions,
             pri.loan_deduction, pri.advance_deduction, pri.components,
             pri.currency,
             e.first_name, e.last_name, e.first_name || ' ' || e.last_name emp_name, e.employee_code,
             d.name dept_name, des.name designation_name,
             o.name org_name, o.legal_name, o.logo_url, o.trade_license,
             o.address org_address, o.payslip_footer
      FROM payslips p
      JOIN pay_run_items pri ON pri.id = p.pay_run_item_id
      JOIN pay_runs pr ON pr.id = pri.pay_run_id
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      JOIN organizations o ON o.id = pr.org_id
      WHERE p.employee_id = $1
      ORDER BY pr.pay_date DESC
    `, [req.params.id]);
    res.json({ success: true, data: slips });
  } catch (err) { next(err); }
});

// GET /api/employees/:id/payslip/:payslipId  — single payslip for print
router.get('/:id/payslip/:payslipId', async (req, res, next) => {
  try {
    const slip = await db.one(`
      SELECT p.*, pr.period_start, pr.period_end, pr.pay_date,
             pri.gross_salary, pri.net_salary, pri.total_deductions,
             pri.loan_deduction, pri.advance_deduction, pri.components, pri.currency,
             e.first_name, e.last_name, e.employee_code, e.bank_name, e.bank_account_no,
             d.name dept_name, des.name designation_name,
             o.name org_name, o.legal_name, o.logo_url, o.trade_license,
             o.phone org_phone, o.email org_email, o.address org_address, o.payslip_footer
      FROM payslips p
      JOIN pay_run_items pri ON pri.id = p.pay_run_item_id
      JOIN pay_runs pr ON pr.id = pri.pay_run_id
      JOIN employees e ON e.id = p.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN designations des ON des.id = e.designation_id
      JOIN organizations o ON o.id = pr.org_id
      WHERE p.id = $1 AND p.employee_id = $2
    `, [req.params.payslipId, req.params.id]);
    if (!slip) return res.status(404).json({ success: false, message: 'Payslip not found' });
    res.json({ success: true, data: slip });
  } catch (err) { next(err); }
});

module.exports = router;
