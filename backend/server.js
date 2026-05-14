require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
 
const logger = require('./config/logger');
const { db } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');
 
const authRoutes      = require('./routes/auth');
const employeeRoutes  = require('./routes/employees');
const payRunRoutes    = require('./routes/payRuns');
const leaveRoutes     = require('./routes/leave');
const loanRoutes      = require('./routes/loans');
const { advancesRouter } = require('./routes/loans');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes  = require('./routes/settings');
const documentRoutes  = require('./routes/documents');
 
const app = express();
const isDev = process.env.NODE_ENV !== 'production';
 
// Required for Render / reverse proxy deployments
app.set('trust proxy', 1);
 
// Ensure dirs exist
['./uploads','./uploads/avatars','./uploads/logos','./logs'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});
 
// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
 
// No-cache headers in dev to fix 304 stale data issue
if (isDev) {
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
}
 
// Rate limiting — generous in dev, strict in prod
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : parseInt(process.env.RATE_LIMIT_MAX) || 200,
  skip: () => isDev, // completely skip in dev
  message: { success: false, message: 'Too many requests — try again later' },
  standardHeaders: true, legacyHeaders: false,
});
app.use('/api', limiter);
 
// Body parsing
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
 
// Logging
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) },
  skip: req => req.url === '/api/health',
}));
 
// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
 
// Health
app.get('/api/health', async (req, res) => {
  try {
    const dbTime = await db.ping();
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: dbTime, uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});
 
// Routes
app.use('/api/auth',      authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/pay-runs',  payRunRoutes);
app.use('/api/leave',     leaveRoutes);
app.use('/api/loans',     loanRoutes);
app.use('/api/advances',  advancesRouter);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/documents', documentRoutes);
 
app.use(notFound);
app.use(errorHandler);
 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`🚀 Payapult API on http://localhost:${PORT} [${isDev?'DEV':'PROD'}]`);
});
 
module.exports = app;