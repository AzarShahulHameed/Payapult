// backend/config/database.js
const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'payapult_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD,
  min:      parseInt(process.env.DB_POOL_MIN) || 2,
  max:      parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => logger.debug('New DB client connected'));
pool.on('error', (err) => logger.error('Idle DB client error', err));

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
