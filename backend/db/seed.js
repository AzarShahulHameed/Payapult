// db/seed.js — Minimal org + admin only. No demo data.
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Creating org and admin...');

    const orgId = uuid();
    await client.query(`
      INSERT INTO organizations (id,name,legal_name,industry,base_currency,pay_frequency,pay_day,timezone,country_code,email)
      VALUES ($1,'Your Company','Your Company LLC','Technology','AED','monthly',28,'Asia/Dubai','AE','admin@yourcompany.com')
    `, [orgId]);

    const hash = await bcrypt.hash('Admin@123', 12);
    const adminId = uuid();
    await client.query(`
      INSERT INTO users (id,org_id,email,password_hash,first_name,last_name,role,is_verified)
      VALUES ($1,$2,'admin@yourcompany.com',$3,'Admin','User','super_admin',true)
    `, [adminId, orgId, hash]);

    // Default leave policies
    const policies = [
      { name:'Annual Leave', type:'annual', days:30, paid:true },
      { name:'Sick Leave',   type:'sick',   days:15, paid:true },
      { name:'Maternity Leave', type:'maternity', days:90, paid:true },
      { name:'Paternity Leave', type:'paternity', days:5,  paid:true },
    ];
    for (const p of policies) {
      await client.query(
        `INSERT INTO leave_policies (org_id,name,leave_type,days_allowed,is_paid) VALUES ($1,$2,$3,$4,$5)`,
        [orgId, p.name, p.type, p.days, p.paid]
      );
    }

    // Default work location
    await client.query(
      `INSERT INTO work_locations (org_id,name,country_code,timezone,currency,is_primary) VALUES ($1,'HQ','AE','Asia/Dubai','AED',true)`,
      [orgId]
    );

    await client.query('COMMIT');
    console.log('✅ Done!');
    console.log('   Login: admin@yourcompany.com / Admin@123');
    console.log('   ⚠️  Update org name/email in Settings after first login.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', e.message);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
