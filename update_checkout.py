import re

with open('artifacts/api-server/src/lib/checkout.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# I will just write the whole thing cleanly
new_checkout = '''import { pool } from "./sqlite";

function slotForNowIST(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

export async function bookAndCheckout(checkinId: number, memberId: number, centerId: string): Promise<void> {
  // Fetch all ingredient selections for this checkin
  const { rows: selections } = await pool.query(
    `SELECT vis.ingredient_id, i.name, i.serving_qty, i.kcal_per_serving
     FROM visit_ingredient_selections vis
     JOIN ingredients i ON i.id = vis.ingredient_id
     WHERE vis.checkin_id = $1`,
    [checkinId]
  );
  
  if (selections.length === 0) return;

  let totalKcal = 0;
  
  for (const sel of selections) {
    // Only deduct if there is an open batch
    const { rows: batches } = await pool.query(
      `SELECT ib.id, COALESCE(ib.received_qty, i.pack_size) AS pack_size FROM ingredient_batches ib
       JOIN ingredients i ON i.id = ib.ingredient_id
       WHERE ib.ingredient_id = $1 AND ib.center_id = $2 AND ib.status = 'open'
       ORDER BY ib.opened_at ASC LIMIT 1`,
      [sel.ingredient_id as number, centerId]
    );
    
    if (batches[0]) {
      const batchRow = batches[0] as { id: number; pack_size: number };
      const serveQty = Number(sel.serving_qty) || 1;
      
      await pool.query(
        `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
         VALUES ($1, $2, 'auto: member visit', NOW())`,
        [batchRow.id, serveQty]
      );
      
      // Update batch consumed qty
      await pool.query(
        `WITH consumption AS (
           SELECT COALESCE(SUM(quantity), 0) as used
           FROM batch_consumption_logs WHERE batch_id = $1
         )
         UPDATE ingredient_batches
         SET consumed_qty = (SELECT used FROM consumption)
         WHERE id = $1`,
        [batchRow.id]
      );
      
      // Auto close batch if empty
      await pool.query(
        `UPDATE ingredient_batches
         SET status = 'consumed', consumed_at = NOW()
         WHERE id = $1 AND consumed_qty >= $2 AND status = 'open'`,
        [batchRow.id, batchRow.pack_size]
      );
    }
    
    totalKcal += (Number(sel.kcal_per_serving) || 0);
  }

  // Log a single summary consumption entry for this checkin
  const foodItems = selections.map(s => s.name).join(", ");
  await pool.query(
    `INSERT INTO consumption_logs (member_id, meal_slot, food_item, calories_kcal, checkin_id, logged_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [memberId, slotForNowIST(), foodItems || "Center Check-in", totalKcal > 0 ? totalKcal : null, checkinId]
  );
}
'''

with open('artifacts/api-server/src/lib/checkout.ts', 'w', encoding='utf-8') as f:
    f.write(new_checkout)
