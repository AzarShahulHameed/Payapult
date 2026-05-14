// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

// Verify JWT and attach user to req
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db.one(
      'SELECT id, org_id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = user;
    req.orgId = user.org_id;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    next(err);
  }
};

// Role-based access guard
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Insufficient permissions' });
  }
  next();
};

// Ensure org isolation — user must belong to the requested org
const orgGuard = (req, res, next) => {
  const requestedOrg = req.params.orgId || req.query.orgId || req.body.orgId;
  if (requestedOrg && requestedOrg !== req.user.org_id) {
    return res.status(403).json({ success: false, message: 'Access denied to this organization' });
  }
  next();
};

module.exports = { authenticate, authorize, orgGuard };
