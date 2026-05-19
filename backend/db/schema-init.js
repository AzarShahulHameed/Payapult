// db/schema-init.js — Auto-run schema + seed on first deploy
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

async function init() {
  const client = await pool.connect();
  try {
    // Check if already initialized
    const check = await client.query(`SELECT to_regclass('public.organizations') AS exists`);
    if (check.rows[0].exists) {
      console.log('✅ Database already initialized — skipping schema');
      
      // Still run migrate for new columns
      await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trade_license VARCHAR(100)`);
      await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payslip_footer TEXT`);
      await client.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fiscal_year_start SMALLINT DEFAULT 1`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_templates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL, description TEXT, category VARCHAR(50) DEFAULT 'other',
          file_url TEXT, file_size INTEGER, mime_type VARCHAR(100), fields JSONB DEFAULT '[]',
          is_active BOOLEAN DEFAULT TRUE, created_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS employee_certificates (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
          cert_type VARCHAR(100) NOT NULL, cert_number VARCHAR(200), issued_by VARCHAR(200),
          issue_date DATE, expiry_date DATE, file_url TEXT, file_size INTEGER, mime_type VARCHAR(100),
          notes TEXT, is_active BOOLEAN DEFAULT TRUE, uploaded_by UUID NOT NULL REFERENCES users(id),
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_cert_emp ON employee_certificates(employee_id)`);
      console.log('✅ Migrations applied');
      return;
    }

    console.log('🔧 Running schema for the first time...');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Schema created');

    // Seed
    const orgId = uuid();
    await client.query(`
      INSERT INTO organizations (id,name,legal_name,industry,base_currency,pay_frequency,pay_day,timezone,country_code,email)
      VALUES ($1,'Your Company','Your Company LLC','Technology','AED','monthly',28,'Asia/Dubai','AE','admin@yourcompany.com')
    `, [orgId]);

    const hash = await bcrypt.hash('Admin@123', 12);
    await client.query(`
      INSERT INTO users (id,org_id,email,password_hash,first_name,last_name,role,is_verified)
      VALUES ($1,$2,'admin@yourcompany.com',$3,'Admin','User','super_admin',true)
    `, [uuid(), orgId, hash]);

    const policies = [
      ['Annual Leave','annual',30],['Sick Leave','sick',15],['Maternity Leave','maternity',90],['Paternity Leave','paternity',5]
    ];
    for (const [name,type,days] of policies) {
      await client.query(`INSERT INTO leave_policies (org_id,name,leave_type,days_allowed,is_paid) VALUES ($1,$2,$3,$4,true)`, [orgId,name,type,days]);
    }
    await client.query(`INSERT INTO work_locations (org_id,name,country_code,timezone,currency,is_primary) VALUES ($1,'HQ','AE','Asia/Dubai','AED',true)`, [orgId]);

    console.log('✅ Seed complete — admin@yourcompany.com / Admin@123');
  } catch(e) {
    console.error('❌ Schema init failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

init();
