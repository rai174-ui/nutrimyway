import { Pool } from 'pg';
const pool = new Pool({ connectionString: 'postgresql://postgres@localhost:54321/nutrimyway' });
async function run() {
  const res = await pool.query("SELECT DATE('2026-07-07 10:00:00 AT TIME ZONE ''Asia/Kolkata''') as day");
  console.log('Result type:', typeof res.rows[0].day);
  console.log('Result string:', JSON.stringify(res.rows[0].day));
  process.exit(0);
}
run();
