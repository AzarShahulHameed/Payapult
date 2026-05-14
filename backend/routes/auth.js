// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { db } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const signRefresh = (userId) => jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: '30d' });

router.post('/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

      const { email, password } = req.body;
      const user = await db.one(`
        SELECT u.*, o.name org_name, o.base_currency, o.timezone, o.logo_url, o.id org_id
        FROM users u JOIN organizations o ON o.id=u.org_id
        WHERE u.email=$1 AND u.is_active=TRUE
      `, [email]);

      if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });

      const token = signToken(user.id);
      const refreshToken = signRefresh(user.id);
      const rHash = await bcrypt.hash(refreshToken, 6);
      await db.query('UPDATE users SET refresh_token=$1, last_login=NOW() WHERE id=$2', [rHash, user.id]);

      const { password_hash, refresh_token, ...safeUser } = user;
      res.json({ success: true, token, refreshToken, user: safeUser });
    } catch (err) { next(err); }
  }
);

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await db.one('SELECT * FROM users WHERE id=$1 AND is_active=TRUE', [decoded.userId]);
    if (!user?.refresh_token) return res.status(401).json({ success: false, message: 'Invalid' });
    const valid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid' });
    res.json({ success: true, token: signToken(user.id) });
  } catch (err) {
    if (err.name?.includes('Token')) return res.status(401).json({ success: false, message: 'Refresh expired — login again' });
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await db.one(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.avatar_url, u.phone, u.last_login,
             o.name org_name, o.base_currency, o.timezone, o.logo_url, o.trade_license, o.id org_id
      FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.id=$1
    `, [req.user.id]);
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await db.query('UPDATE users SET refresh_token=NULL WHERE id=$1', [req.user.id]);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
});

router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { first_name, last_name, phone, avatar_url } = req.body;
    const user = await db.one(`
      UPDATE users SET first_name=$1, last_name=$2, phone=$3, avatar_url=$4 WHERE id=$5
      RETURNING id, email, first_name, last_name, role, avatar_url, phone
    `, [first_name, last_name, phone || null, avatar_url || null, req.user.id]);
    res.json({ success: true, user });
  } catch (err) { next(err); }
});

router.post('/change-password', authenticate,
  [body('oldPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
  async (req, res, next) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const user = await db.one('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
      const valid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!valid) return res.status(400).json({ success: false, message: 'Old password incorrect' });
      const hash = await bcrypt.hash(newPassword, 12);
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
      res.json({ success: true, message: 'Password changed' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
