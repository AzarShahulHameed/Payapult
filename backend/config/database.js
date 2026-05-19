// backend/config/database.js
const { Pool } = require('pg');
const logger = require('./logger');

const getConfig = () => {
  // If DATABASE_URL is set, parse it manually
  if (process.env.DATABASE_URL) {
    const url = process.env.DATABASE_URL
      .replace('?pgbouncer=true', '')
      .replace('&pgbouncer=true', '');
    return {
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      min: 1, max: 3,
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
    };
  }

  // Use individual env vars (more reliable with Supabase pooler)
  return {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT) || 6543,
    database: process.env.DB_NAME || 'postgres',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    min: 1, max: 3,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 30000,
  };
};

const pool = new Pool(getConfig());

pool.on('connect', () => logger.info('✅ DB connected'));
pool.on('error', (err) => logger.error('DB error:', err.message));

// Test connection on startup
pool.query('SELECT 1').then(() => logger.info('✅ Database connection verified')).catch(e => logger.error('❌ DB connection failed:', e.message));

const db = {
  query:      (text, params) => pool.query(text, params),
  one:        async (text, params) => { const r = await pool.query(text, params); return r.rows[0] || null; },
  oneOrNone:  async (text, params) => { const r = await pool.query(text, params); return r.rows[0] || null; },
  many:       async (text, params) => { const r = await pool.query(text, params); return r.rows; },
  manyOrNone: async (text, params) => { const r = await pool.query(text, params); return r.rows; },
  none:       async (text, params) => { await pool.query(text, params); return null; },
  ping:       async () => { const r = await pool.query('SELECT NOW() AS now'); return r.rows[0].now; },
  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

module.exports = { db, pool };
