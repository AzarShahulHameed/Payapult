// backend/routes/settings.js — Full CRUD for all settings
const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const router = express.Router();
router.use(authenticate);

// ── ORGANIZATION ──────────────────────────────────────────────
router.get('/organization', async (req, res, next) => {
  try {
    const org = await db.one('SELECT * FROM organizations WHERE id=$1', [req.orgId]);
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

router.put('/organization', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const fields = ['name','legal_name','registration_no','trade_license','industry','website',
      'phone','email','base_currency','pay_frequency','pay_day','timezone','country_code','payslip_footer'];
    const updates = []; const params = []; let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f}=$${i}`); params.push(req.body[f]); i++; }
    }
    if (req.body.address !== undefined) { updates.push(`address=$${i}`); params.push(JSON.stringify(req.body.address)); i++; }
    params.push(req.orgId);
    const org = await db.one(`UPDATE organizations SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, params);
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

router.post('/organization/logo', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { logo_url } = req.body;
    const org = await db.one('UPDATE organizations SET logo_url=$1 WHERE id=$2 RETURNING *', [logo_url, req.orgId]);
    res.json({ success: true, data: org });
  } catch (err) { next(err); }
});

// ── DEPARTMENTS ───────────────────────────────────────────────
router.get('/departments', async (req, res, next) => {
  try {
    const rows = await db.many(`
      SELECT d.*, u.first_name||' '||u.last_name head_name, COUNT(e.id) emp_count
      FROM departments d
      LEFT JOIN users u ON u.id=d.head_user_id
      LEFT JOIN employees e ON e.department_id=d.id AND e.is_active=TRUE
      WHERE d.org_id=$1 AND d.is_active=TRUE
      GROUP BY d.id, u.id ORDER BY d.name
    `, [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/departments', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const dept = await db.one(`INSERT INTO departments (org_id,name,code,description) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.orgId, name, code || null, description || null]);
    res.status(201).json({ success: true, data: dept });
  } catch (err) { next(err); }
});

router.put('/departments/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    const dept = await db.one(`UPDATE departments SET name=$1,code=$2,description=$3 WHERE id=$4 AND org_id=$5 RETURNING *`,
      [name, code || null, description || null, req.params.id, req.orgId]);
    res.json({ success: true, data: dept });
  } catch (err) { next(err); }
});

router.delete('/departments/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE departments SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── DESIGNATIONS ──────────────────────────────────────────────
router.get('/designations', async (req, res, next) => {
  try {
    const rows = await db.many('SELECT * FROM designations WHERE org_id=$1 AND is_active=TRUE ORDER BY name', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/designations', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, department_id, level } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const des = await db.one(`INSERT INTO designations (org_id,name,department_id,level) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.orgId, name, department_id || null, level || 1]);
    res.status(201).json({ success: true, data: des });
  } catch (err) { next(err); }
});

router.put('/designations/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, department_id, level } = req.body;
    const des = await db.one(`UPDATE designations SET name=$1,department_id=$2,level=$3 WHERE id=$4 AND org_id=$5 RETURNING *`,
      [name, department_id || null, level || 1, req.params.id, req.orgId]);
    res.json({ success: true, data: des });
  } catch (err) { next(err); }
});

router.delete('/designations/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE designations SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── WORK LOCATIONS ────────────────────────────────────────────
router.get('/work-locations', async (req, res, next) => {
  try {
    const rows = await db.many('SELECT * FROM work_locations WHERE org_id=$1 AND is_active=TRUE ORDER BY is_primary DESC,name', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/work-locations', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, country_code='AE', timezone='Asia/Dubai', currency='AED', is_primary=false } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const wl = await db.one(`INSERT INTO work_locations (org_id,name,country_code,timezone,currency,is_primary) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.orgId, name, country_code, timezone, currency, is_primary]);
    res.status(201).json({ success: true, data: wl });
  } catch (err) { next(err); }
});

router.put('/work-locations/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, country_code, timezone, currency, is_primary } = req.body;
    const wl = await db.one(`UPDATE work_locations SET name=$1,country_code=$2,timezone=$3,currency=$4,is_primary=$5 WHERE id=$6 AND org_id=$7 RETURNING *`,
      [name, country_code, timezone, currency, is_primary, req.params.id, req.orgId]);
    res.json({ success: true, data: wl });
  } catch (err) { next(err); }
});

router.delete('/work-locations/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE work_locations SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── SALARY COMPONENTS ─────────────────────────────────────────
router.get('/salary-components', async (req, res, next) => {
  try {
    const rows = await db.many('SELECT * FROM salary_components WHERE org_id=$1 AND is_active=TRUE ORDER BY type,display_order', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/salary-components', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, code, type, calculation='fixed', default_value=0, percentage=0, is_taxable=false, is_statutory=false, display_order=0 } = req.body;
    if (!name || !code || !type) return res.status(400).json({ success: false, message: 'name, code, type required' });
    const comp = await db.one(`INSERT INTO salary_components (org_id,name,code,type,calculation,default_value,percentage,is_taxable,is_statutory,display_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.orgId, name, code.toUpperCase(), type, calculation, default_value, percentage, is_taxable, is_statutory, display_order]);
    res.status(201).json({ success: true, data: comp });
  } catch (err) { next(err); }
});

router.put('/salary-components/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { name, code, type, calculation, default_value, percentage, is_taxable, display_order } = req.body;
    const comp = await db.one(`UPDATE salary_components SET name=$1,code=$2,type=$3,calculation=$4,default_value=$5,percentage=$6,is_taxable=$7,display_order=$8 WHERE id=$9 AND org_id=$10 RETURNING *`,
      [name, code?.toUpperCase(), type, calculation, default_value, percentage, is_taxable, display_order || 0, req.params.id, req.orgId]);
    res.json({ success: true, data: comp });
  } catch (err) { next(err); }
});

router.delete('/salary-components/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE salary_components SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── LEAVE POLICIES ────────────────────────────────────────────
router.get('/leave-policies', async (req, res, next) => {
  try {
    const rows = await db.many('SELECT * FROM leave_policies WHERE org_id=$1 AND is_active=TRUE ORDER BY leave_type', [req.orgId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/leave-policies', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const { name, leave_type, days_allowed, is_paid=true, carry_forward=false, max_carry_days=0 } = req.body;
    if (!name || !leave_type || !days_allowed) return res.status(400).json({ success: false, message: 'name, leave_type, days_allowed required' });
    const p = await db.one(`INSERT INTO leave_policies (org_id,name,leave_type,days_allowed,is_paid,carry_forward,max_carry_days) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.orgId, name, leave_type, days_allowed, is_paid, carry_forward, max_carry_days]);
    res.status(201).json({ success: true, data: p });
  } catch (err) { next(err); }
});

router.put('/leave-policies/:id', authorize('super_admin','admin','hr_manager'), async (req, res, next) => {
  try {
    const { name, days_allowed, is_paid, carry_forward, max_carry_days } = req.body;
    const p = await db.one(`UPDATE leave_policies SET name=$1,days_allowed=$2,is_paid=$3,carry_forward=$4,max_carry_days=$5 WHERE id=$6 AND org_id=$7 RETURNING *`,
      [name, days_allowed, is_paid, carry_forward, max_carry_days, req.params.id, req.orgId]);
    res.json({ success: true, data: p });
  } catch (err) { next(err); }
});

router.delete('/leave-policies/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    await db.query('UPDATE leave_policies SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ── USERS ─────────────────────────────────────────────────────
router.get('/users', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const users = await db.many(`SELECT id,email,first_name,last_name,role,is_active,last_login,avatar_url,phone,created_at FROM users WHERE org_id=$1 ORDER BY first_name`, [req.orgId]);
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

router.post('/users', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, role='employee', phone } = req.body;
    if (!email || !password || !first_name || !last_name) return res.status(400).json({ success: false, message: 'email, password, first_name, last_name required' });
    const hash = await bcrypt.hash(password, 12);
    const user = await db.one(`INSERT INTO users (org_id,email,password_hash,first_name,last_name,role,phone,is_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING id,email,first_name,last_name,role,phone,is_active,created_at`,
      [req.orgId, email.toLowerCase(), hash, first_name, last_name, role, phone || null]);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.put('/users/:id', authorize('super_admin','admin'), async (req, res, next) => {
  try {
    const { first_name, last_name, role, phone, is_active } = req.body;
    const user = await db.one(`UPDATE users SET first_name=$1,last_name=$2,role=$3,phone=$4,is_active=$5 WHERE id=$6 AND org_id=$7 RETURNING id,email,first_name,last_name,role,phone,is_active`,
      [first_name, last_name, role, phone || null, is_active !== undefined ? is_active : true, req.params.id, req.orgId]);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

router.delete('/users/:id', authorize('super_admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    await db.query('UPDATE users SET is_active=FALSE WHERE id=$1 AND org_id=$2', [req.params.id, req.orgId]);
    res.json({ success: true, message: 'User deactivated' });
  } catch (err) { next(err); }
});

module.exports = router;

// ── FILE UPLOADS (avatar, logo) ───────────────────────────────
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'logo' ? './uploads/logos' : './uploads/avatars';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  if (/image\/(jpeg|png|gif|webp|svg\+xml)/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Images only'));
}});

// POST /api/settings/upload/logo
router.post('/upload/logo', authorize('super_admin','admin'), upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    const org = await db.one('UPDATE organizations SET logo_url=$1 WHERE id=$2 RETURNING *', [logoUrl, req.orgId]);
    res.json({ success: true, url: logoUrl, data: org });
  } catch (err) { next(err); }
});

// POST /api/settings/upload/avatar
router.post('/upload/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const user = await db.one('UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id,email,first_name,last_name,role,avatar_url,phone', [avatarUrl, req.user.id]);
    res.json({ success: true, url: avatarUrl, user });
  } catch (err) { next(err); }
});

// POST /api/settings/upload/employee-photo/:id
router.post('/upload/employee-photo/:id', authorize('super_admin','admin','hr_manager'), upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const photoUrl = `/uploads/avatars/${req.file.filename}`;
    const emp = await db.one('UPDATE employees SET photo_url=$1 WHERE id=$2 AND org_id=$3 RETURNING id,photo_url', [photoUrl, req.params.id, req.orgId]);
    res.json({ success: true, url: photoUrl, data: emp });
  } catch (err) { next(err); }
});

// ── CLOUDINARY UPLOAD OVERRIDE ────────────────────────────────────────────────
// Replaces the multer-only endpoints with Cloudinary-backed versions
const { uploadToCloudinary } = require('../config/cloudinary');
const path2 = require('path');
const fs2   = require('fs');

// Override: POST /api/settings/upload/logo — with Cloudinary
router.post('/upload/logo/cloud', authorize('super_admin','admin'), upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    let logoUrl = `/uploads/logos/${req.file.filename}`;

    // Try Cloudinary first
    try {
      const cloudUrl = await uploadToCloudinary(req.file.path, 'payapult/logos');
      if (cloudUrl) {
        logoUrl = cloudUrl;
        // Delete local file after successful cloud upload
        if (fs2.existsSync(req.file.path)) fs2.unlinkSync(req.file.path);
      }
    } catch (cloudErr) {
      // Fall back to local URL if Cloudinary fails
      console.warn('Cloudinary upload failed, using local:', cloudErr.message);
    }

    const org = await db.one('UPDATE organizations SET logo_url=$1 WHERE id=$2 RETURNING *', [logoUrl, req.orgId]);
    res.json({ success: true, url: logoUrl, data: org });
  } catch (err) { next(err); }
});

// Override: POST /api/settings/upload/avatar/cloud — with Cloudinary
router.post('/upload/avatar/cloud', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    let avatarUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      const cloudUrl = await uploadToCloudinary(req.file.path, 'payapult/avatars');
      if (cloudUrl) {
        avatarUrl = cloudUrl;
        if (fs2.existsSync(req.file.path)) fs2.unlinkSync(req.file.path);
      }
    } catch (cloudErr) {
      console.warn('Cloudinary upload failed, using local:', cloudErr.message);
    }

    const user = await db.one('UPDATE users SET avatar_url=$1 WHERE id=$2 RETURNING id,email,first_name,last_name,role,avatar_url,phone', [avatarUrl, req.user.id]);
    res.json({ success: true, url: avatarUrl, user });
  } catch (err) { next(err); }
});

// Override: POST /api/settings/upload/employee-photo/:id/cloud — with Cloudinary
router.post('/upload/employee-photo/:id/cloud', authorize('super_admin','admin','hr_manager'), upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    let photoUrl = `/uploads/avatars/${req.file.filename}`;

    try {
      const cloudUrl = await uploadToCloudinary(req.file.path, 'payapult/employees');
      if (cloudUrl) {
        photoUrl = cloudUrl;
        if (fs2.existsSync(req.file.path)) fs2.unlinkSync(req.file.path);
      }
    } catch (cloudErr) {
      console.warn('Cloudinary upload failed, using local:', cloudErr.message);
    }

    const emp = await db.one('UPDATE employees SET photo_url=$1 WHERE id=$2 AND org_id=$3 RETURNING id,photo_url', [photoUrl, req.params.id, req.orgId]);
    res.json({ success: true, url: photoUrl, data: emp });
  } catch (err) { next(err); }
});
