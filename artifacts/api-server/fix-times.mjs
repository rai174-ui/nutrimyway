import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const query = `
    UPDATE consumption_logs
    SET logged_at = (DATE(logged_at AT TIME ZONE 'Asia/Kolkata') || 
      CASE meal_slot 
        WHEN 'Breakfast' THEN ' 09:00:00'
        WHEN 'Lunch' THEN ' 13:00:00'
        WHEN 'Snack' THEN ' 17:00:00'
        WHEN 'Dinner' THEN ' 20:00:00'
        ELSE ' 12:00:00'
      END || '+05:30')::timestamptz
    WHERE EXTRACT(HOUR FROM logged_at AT TIME ZONE 'UTC') = 0 
      AND EXTRACT(MINUTE FROM logged_at AT TIME ZONE 'UTC') = 0;
  `;
  try {
    const res = await pool.query(query);
    console.log(`Updated ${res.rowCount} rows`);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
