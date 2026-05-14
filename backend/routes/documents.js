// backend/routes/documents.js — Full documents, templates & certificates
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { db }  = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const router  = express.Router();

// ── MULTER ────────────────────────────────────────────────────────────────────
const mkStorage = (subdir) => multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('./uploads', subdir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const ALLOWED = ['.pdf','.doc','.docx','.xls','.xlsx','.csv','.jpg','.jpeg','.png','.gif','.txt'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED.includes(ext)) cb(null, true);
  else cb(new Error(`File type ${ext} not allowed. Use: ${ALLOWED.join(', ')}`));
};

const docUpload  = multer({ storage: mkStorage('documents'),  limits: { fileSize: 20 * 1024 * 1024 }, fileFilter });
const tmplUpload = multer({ storage: mkStorage('templates'),  limits: { fileSize: 20 * 1024 * 1024 }, fileFilter });
const certUpload = multer({ storage: mkStorage('certs'),      limits: { fileSize: 20 * 1024 * 1024 }, fileFilter });

router.use(authenticate);

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/documents  — list (optionally filtered by employee / category)
router.get('/', async (req, res, next) => {
  try {
    const { employee_id, category } = req.query;
    const params = [req.orgId];
    const conds  = ['d.org_id = $1'];
    let i = 2;
    if (employee_id) { conds.push(`d.employee_id = $${i}`); params.push(employee_id); i++; }
    if (category)    { conds.push(`d.category = $${i}`);    params.push(category);    i++; }

    const docs = await db.many(`
      SELECT d.*,
             e.first_name || ' ' || e.last_name  AS emp_name,
             e.employee_code,
             u.first_name || ' ' || u.last_name  AS uploaded_by_name
      FROM documents d
      LEFT JOIN employees e ON e.id = d.employee_id
      LEFT JOIN users u     ON u.id = d.uploaded_by
      WHERE ${conds.join(' AND ')}
      ORDER BY e.first_name, d.created_at DESC
    `, params);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// GET /api/documents/by-employee  — grouped by employee
router.get('/by-employee', async (req, res, next) => {
  try {
    const docs = await db.many(`
      SELECT d.*,
             e.id AS emp_id, e.first_name, e.last_name, e.employee_code, e.photo_url,
             dep.name AS dept_name,
             u.first_name || ' ' || u.last_name AS uploaded_by_name
      FROM documents d
      JOIN employees e    ON e.id = d.employee_id
      LEFT JOIN departments dep ON dep.id = e.department_id
      LEFT JOIN users u   ON u.id = d.uploaded_by
      WHERE d.org_id = $1 AND e.is_active = TRUE
      ORDER BY e.first_name, d.created_at DESC
    `, [req.orgId]);

    // Group by employee
    const grouped = {};
    for (const doc of docs) {
      const eid = doc.emp_id;
      if (!grouped[eid]) {
        grouped[eid] = {
          id: eid, first_name: doc.first_name, last_name: doc.last_name,
          employee_code: doc.employee_code, photo_url: doc.photo_url, dept_name: doc.dept_name,
          documents: [],
        };
      }
      grouped[eid].documents.push(doc);
    }
    res.json({ success: true, data: Object.values(grouped) });
  } catch (err) { next(err); }
});

// POST /api/documents  — upload a document
router.post('/', docUpload.single('file'), async (req, res, next) => {
  try {
    const { employee_id, category = 'other', name, description, expiry_date } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Document name required' });

    const doc = await db.one(`
      INSERT INTO documents (org_id, employee_id, category, name, description, file_url, file_size, mime_type, expiry_date, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [
      req.orgId, employee_id || null, category, name, description || null,
      req.file ? `/uploads/documents/${req.file.filename}` : null,
      req.file?.size || null, req.file?.mimetype || null,
      expiry_date || null, req.user.id,
    ]);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
});

// DELETE /api/documents/:id
router.delete('/:id', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const doc = await db.one('SELECT * FROM documents WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    if (doc.file_url) {
      const fp = path.join(__dirname, '..', doc.file_url);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.query('DELETE FROM documents WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE CERTIFICATES (Passport, Emirates ID, Labour Card, etc.)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/documents/certificates/:empId
router.get('/certificates/:empId', async (req, res, next) => {
  try {
    const certs = await db.many(`
      SELECT ec.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
      FROM employee_certificates ec
      LEFT JOIN users u ON u.id = ec.uploaded_by
      WHERE ec.employee_id = $1 AND ec.org_id = $2 AND ec.is_active = TRUE
      ORDER BY ec.cert_type, ec.expiry_date
    `, [req.params.empId, req.orgId]);
    res.json({ success: true, data: certs });
  } catch (err) { next(err); }
});

// POST /api/documents/certificates/:empId
router.post('/certificates/:empId', certUpload.single('file'), async (req, res, next) => {
  try {
    const { cert_type, cert_number, issued_by, issue_date, expiry_date, notes } = req.body;
    if (!cert_type) return res.status(400).json({ success: false, message: 'Certificate type required' });

    const cert = await db.one(`
      INSERT INTO employee_certificates
        (org_id, employee_id, cert_type, cert_number, issued_by, issue_date, expiry_date, notes,
         file_url, file_size, mime_type, uploaded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
      req.orgId, req.params.empId, cert_type, cert_number || null, issued_by || null,
      issue_date || null, expiry_date || null, notes || null,
      req.file ? `/uploads/certs/${req.file.filename}` : null,
      req.file?.size || null, req.file?.mimetype || null,
      req.user.id,
    ]);
    res.status(201).json({ success: true, data: cert });
  } catch (err) { next(err); }
});

// PUT /api/documents/certificates/:certId
router.put('/certificates/:certId', certUpload.single('file'), async (req, res, next) => {
  try {
    const { cert_type, cert_number, issued_by, issue_date, expiry_date, notes } = req.body;
    const existing = await db.one('SELECT * FROM employee_certificates WHERE id=$1 AND org_id=$2', [req.params.certId, req.orgId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

    let fileUrl = existing.file_url, fileSize = existing.file_size, mimeType = existing.mime_type;
    if (req.file) {
      if (existing.file_url) { const fp = path.join(__dirname, '..', existing.file_url); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
      fileUrl  = `/uploads/certs/${req.file.filename}`;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    }

    const cert = await db.one(`
      UPDATE employee_certificates
      SET cert_type=$1, cert_number=$2, issued_by=$3, issue_date=$4, expiry_date=$5, notes=$6,
          file_url=$7, file_size=$8, mime_type=$9, updated_at=NOW()
      WHERE id=$10 AND org_id=$11 RETURNING *
    `, [cert_type, cert_number||null, issued_by||null, issue_date||null, expiry_date||null, notes||null,
        fileUrl, fileSize, mimeType, req.params.certId, req.orgId]);
    res.json({ success: true, data: cert });
  } catch (err) { next(err); }
});

// DELETE /api/documents/certificates/:certId
router.delete('/certificates/:certId', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const cert = await db.one('SELECT * FROM employee_certificates WHERE id=$1 AND org_id=$2', [req.params.certId, req.orgId]);
    if (!cert) return res.status(404).json({ success: false, message: 'Not found' });
    if (cert.file_url) { const fp = path.join(__dirname, '..', cert.file_url); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    await db.query('UPDATE employee_certificates SET is_active=FALSE WHERE id=$1', [req.params.certId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT TEMPLATES (Excel/CSV import → employee data)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/documents/templates
router.get('/templates', async (req, res, next) => {
  try {
    const tmpl = await db.many(`
      SELECT dt.*, u.first_name || ' ' || u.last_name AS created_by_name
      FROM document_templates dt
      LEFT JOIN users u ON u.id = dt.created_by
      WHERE dt.org_id = $1 AND dt.is_active = TRUE
      ORDER BY dt.created_at DESC
    `, [req.orgId]);
    res.json({ success: true, data: tmpl });
  } catch (err) { next(err); }
});

// POST /api/documents/templates  — upload template file
router.post('/templates', authorize('super_admin','admin','hr_manager'), tmplUpload.single('file'), async (req, res, next) => {
  try {
    const { name, description, category = 'other', fields } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Template name required' });

    const tmpl = await db.one(`
      INSERT INTO document_templates (org_id, name, description, category, file_url, file_size, mime_type, fields, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      req.orgId, name, description || null, category,
      req.file ? `/uploads/templates/${req.file.filename}` : null,
      req.file?.size || null, req.file?.mimetype || null,
      fields ? JSON.parse(fields) : [],
      req.user.id,
    ]);
    res.status(201).json({ success: true, data: tmpl });
  } catch (err) { next(err); }
});

// POST /api/documents/templates/import — import Excel/CSV → employee records
router.post('/templates/import', authorize('super_admin','admin','hr_manager'), tmplUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const ext = path.extname(req.file.originalname).toLowerCase();

    let rows = [];
    const filePath = req.file.path;

    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        return Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));
      }).filter(r => Object.values(r).some(v => v));
    } else if (['.xlsx', '.xls'].includes(ext)) {
      // Use xlsx if available
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(filePath);
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        rows = rows.map(r => Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, '_'), String(v || '')])
        ));
      } catch (e) {
        return res.status(400).json({ success: false, message: 'xlsx package not installed. Use CSV format or run: npm install xlsx' });
      }
    }

    if (!rows.length) return res.status(400).json({ success: false, message: 'No data rows found in file' });

    // Map common column name variations
    const get = (row, ...keys) => { for (const k of keys) { if (row[k]) return row[k]; } return ''; };

    const results = { created: 0, updated: 0, errors: [] };

    for (const row of rows) {
      try {
        const firstName = get(row, 'first_name', 'firstname', 'first name', 'fname', 'name');
        const lastName  = get(row, 'last_name', 'lastname', 'last name', 'lname', 'surname');
        const email     = get(row, 'email', 'email_address', 'work_email');
        const salary    = parseFloat(get(row, 'salary', 'base_salary', 'gross', 'gross_salary')) || 0;
        const dept      = get(row, 'department', 'dept', 'department_name');
        const desig     = get(row, 'designation', 'position', 'title', 'job_title');
        const joinDate  = get(row, 'join_date', 'joining_date', 'start_date', 'date_of_joining');

        if (!firstName || !email) { results.errors.push(`Row skipped: missing first_name or email`); continue; }

        // Find or create department
        let deptId = null;
        if (dept) {
          let dRow = await db.one('SELECT id FROM departments WHERE org_id=$1 AND LOWER(name)=LOWER($2)', [req.orgId, dept]);
          if (!dRow) {
            dRow = await db.one('INSERT INTO departments (org_id,name) VALUES ($1,$2) RETURNING id', [req.orgId, dept]);
          }
          deptId = dRow.id;
        }

        // Find or create designation
        let desigId = null;
        if (desig) {
          let dsRow = await db.one('SELECT id FROM designations WHERE org_id=$1 AND LOWER(name)=LOWER($2)', [req.orgId, desig]);
          if (!dsRow) {
            dsRow = await db.one('INSERT INTO designations (org_id,name,department_id) VALUES ($1,$2,$3) RETURNING id', [req.orgId, desig, deptId]);
          }
          desigId = dsRow.id;
        }

        // Check if employee exists
        const existing = await db.one('SELECT id FROM employees WHERE org_id=$1 AND LOWER(email)=LOWER($2)', [req.orgId, email]);

        if (existing) {
          await db.query(`UPDATE employees SET first_name=$1,last_name=$2,department_id=$3,designation_id=$4,
            base_salary=CASE WHEN $5>0 THEN $5 ELSE base_salary END WHERE id=$6`,
            [firstName, lastName||'', deptId, desigId, salary, existing.id]);
          results.updated++;
        } else {
          const count = await db.one('SELECT COUNT(*) FROM employees WHERE org_id=$1', [req.orgId]);
          const code  = `EMP-${String(parseInt(count.count) + 1001).padStart(4, '0')}`;
          const jd    = joinDate || new Date().toISOString().split('T')[0];

          const emp = await db.one(`
            INSERT INTO employees (org_id,employee_code,first_name,last_name,email,base_salary,department_id,designation_id,join_date,status,created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING id
          `, [req.orgId, code, firstName, lastName||'', email.toLowerCase(), salary||0, deptId, desigId, jd, req.user.id]);

          // Create leave balances
          const policies = await db.many('SELECT * FROM leave_policies WHERE org_id=$1 AND is_active=TRUE', [req.orgId]);
          const year = new Date().getFullYear();
          for (const p of policies) {
            await db.query(`INSERT INTO leave_balances (employee_id,policy_id,year,entitled_days) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
              [emp.id, p.id, year, p.days_allowed]);
          }
          results.created++;
        }
      } catch (rowErr) {
        results.errors.push(`Row error: ${rowErr.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ success: true, results, message: `Import complete: ${results.created} created, ${results.updated} updated${results.errors.length ? `, ${results.errors.length} errors` : ''}` });
  } catch (err) { next(err); }
});

// DELETE /api/documents/templates/:id
router.delete('/templates/:id', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const tmpl = await db.one('SELECT * FROM document_templates WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    if (!tmpl) return res.status(404).json({ success: false, message: 'Not found' });
    if (tmpl.file_url) { const fp = path.join(__dirname, '..', tmpl.file_url); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    await db.query('UPDATE document_templates SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
