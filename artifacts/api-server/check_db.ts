import { pool } from "./src/lib/sqlite";

async function run() {
  try {
    const res = await pool.query("SELECT * FROM consumption_logs LIMIT 1");
    console.log("Success:", Object.keys(res.rows[0] || {}));
  } catch (err) {
    console.error("Query failed:", err.message);
  } finally {
    await pool.end();
  }
}
run();
