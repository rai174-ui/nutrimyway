import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DATABASE_URL.includes("supabase") || process.env.DATABASE_URL.includes("railway")) 
    ? { rejectUnauthorized: false } 
    : undefined
});

const oldId = "CI-1";
const newId = "DWK-1";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    console.log(`Cloning center ${oldId} to ${newId}...`);
    // Insert DWK-1 copying data from CI-1 (ignoring id column)
    const centerRes = await client.query(`SELECT * FROM centers WHERE id = $1`, [oldId]);
    if (centerRes.rows.length === 0) {
      console.log(`Center ${oldId} not found! Maybe already migrated?`);
    } else {
      const c = centerRes.rows[0];
      await client.query(
        `INSERT INTO centers (id, name, is_active, daily_checkin_cap, current_version) 
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [newId, c.name || `Center ${newId}`, c.is_active, c.daily_checkin_cap, c.current_version]
      );
      console.log("Center cloned.");
      
      const tables = [
        "member_center_mapping",
        "health_records",
        "issuances",
        "center_auth",
        "center_broadcast_settings",
        "member_broadcasts",
        "menu_items",
        "member_check_ins",
        "ingredient_batches",
        "center_broadcast_schedules",
        "center_flavours",
        "member_renewals",
        "checkin_categories",
        "ingredients",
        "broadcast_logs",
        "visits"
      ];

      for (const table of tables) {
        try {
          const res = await client.query(`UPDATE ${table} SET center_id = $1 WHERE center_id = $2`, [newId, oldId]);
          if (res.rowCount > 0) {
            console.log(`Updated ${res.rowCount} rows in ${table}`);
          }
        } catch (err) {
          // Some tables might not exist or might not have center_id, that's fine
          if (err.message.includes('does not exist')) {
            // Ignore
          } else {
            console.warn(`Warning on table ${table}: ${err.message}`);
          }
        }
      }

      console.log(`Deleting old center ${oldId}...`);
      await client.query(`DELETE FROM centers WHERE id = $1`, [oldId]);
    }
    
    await client.query("COMMIT");
    console.log("Migration successful!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back.", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
