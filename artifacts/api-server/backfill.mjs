import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function slotForNowIST(date) {
  const h = new Date(date.getTime() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

async function run() {
  const { rows } = await pool.query(`
    SELECT vfs.checkin_id, vfs.ingredient_id, vfs.flavour as sel_flavour, 
           i.name, i.serving_qty, i.kcal_per_serving,
           i.protein_per_serving, i.fiber_per_serving, i.carbs_per_serving, i.fat_per_serving,
           mci.member_id, mci.checked_out_at
    FROM visit_flavour_selections vfs
    JOIN member_check_ins mci ON mci.id = vfs.checkin_id
    JOIN ingredients i ON i.id = vfs.ingredient_id
    WHERE mci.checked_out_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM consumption_logs cl 
        WHERE cl.checkin_id = vfs.checkin_id 
          AND cl.food_item LIKE i.name || '%'
      )
  `);

  console.log(`Found ${rows.length} missing flavour selections to backfill.`);

  for (const row of rows) {
    const mealSlot = slotForNowIST(new Date(row.checked_out_at));
    const kcal = Number(row.kcal_per_serving) || 0;
    const protein = Number(row.protein_per_serving) || 0;
    const fiber = Number(row.fiber_per_serving) || 0;
    const carbs = Number(row.carbs_per_serving) || 0;
    const fat = Number(row.fat_per_serving) || 0;

    const foodLabel = row.sel_flavour ? `${row.name} (${row.sel_flavour})` : row.name;

    await pool.query(
      `INSERT INTO consumption_logs
         (member_id, meal_slot, food_item, calories_kcal, protein_g, fiber_g, carbs_g, fat_g, selected_flavour, checkin_id, logged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        row.member_id,
        mealSlot,
        foodLabel,
        kcal > 0 ? kcal : null,
        protein > 0 ? protein : null,
        fiber > 0 ? fiber : null,
        carbs > 0 ? carbs : null,
        fat > 0 ? fat : null,
        row.sel_flavour || null,
        row.checkin_id,
        row.checked_out_at
      ]
    );
    console.log(`Inserted ${foodLabel} for member ${row.member_id} at checkin ${row.checkin_id}`);
  }
  await pool.end();
}

run().catch(console.error);
