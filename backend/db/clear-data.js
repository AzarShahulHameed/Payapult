// backend/db/clear-data.js
// Removes ALL demo/test data but preserves the schema and org/user setup
// Run: node db/clear-data.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  database: process.env.DB_NAME, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function clearData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🗑  Clearing demo data (preserving schema, org, and admin user)...');

    // Clear in dependency order
    const tables = [
      'payslips',
      'pay_run_items',
      'pay_runs',
      'loan_repayments',
      'loans',
      'advances',
      'leave_balances',
      'leave_requests',
      'documents',
      'employees',
      'salary_components',
      'leave_policies',
      'designations',
      'work_locations',
      'departments',
    ];

    for (const t of tables) {
      await client.query(`DELETE FROM ${t}`);
      console.log(`  ✓ Cleared ${t}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Demo data cleared! Your org and admin user are intact.');
    console.log('   You can now add real data through the application.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Clear failed:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearData();
