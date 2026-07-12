const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'nutrimyway',
  password: 'password', // check if password is correct? Wait, railway uses different env vars.
  port: 54321
});

async function run() {
  try {
    const res = await pool.query('SELECT id, food_item, checkin_id, logged_at FROM consumption_logs ORDER BY logged_at DESC LIMIT 10');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
