// backend/db/migrate.js — Run to add new tables to existing database
// Usage: node db/migrate.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');

    // Add trade_license and payslip_footer to organizations if not exists
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trade_license VARCHAR(100)`);
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payslip_footer TEXT`);
    await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiscal_year_start SMALLINT DEFAULT 1`);
    console.log('  ✅ organizations table updated');

    // document_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_templates (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        category    VARCHAR(50) NOT NULL DEFAULT 'other',
        file_url    TEXT,
        file_size   INTEGER,
        mime_type   VARCHAR(100),
        fields      JSONB DEFAULT '[]',
        is_active   BOOLEAN DEFAULT TRUE,
        created_by  UUID NOT NULL REFERENCES users(id),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  ✅ document_templates table created');

    // employee_certificates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_certificates (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
        cert_type    VARCHAR(100) NOT NULL,
        cert_number  VARCHAR(200),
        issued_by    VARCHAR(200),
        issue_date   DATE,
        expiry_date  DATE,
        file_url     TEXT,
        file_size    INTEGER,
        mime_type    VARCHAR(100),
        notes        TEXT,
        is_active    BOOLEAN DEFAULT TRUE,
        uploaded_by  UUID NOT NULL REFERENCES users(id),
        created_at   TIMESTAMPTZ DEFAULT NOW(),
        updated_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_cert_emp ON employee_certificates(employee_id)`);
    console.log('  ✅ employee_certificates table created');

    console.log('✅ All migrations complete!');
  } catch(e) {
    console.error('❌ Migration failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
migrate();

// Add LOP columns to pay_run_items
async function migrateLOP() {
  const { Pool } = require('pg');
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE pay_run_items ADD COLUMN IF NOT EXISTS lop_days NUMERIC(5,1) DEFAULT 0');
    await client.query('ALTER TABLE pay_run_items ADD COLUMN IF NOT EXISTS lop_amount NUMERIC(15,2) DEFAULT 0');
    console.log('✅ LOP columns added to pay_run_items');
  } finally { client.release(); await pool.end(); }
}
migrateLOP().catch(console.error);
