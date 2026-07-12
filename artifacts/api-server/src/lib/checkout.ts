import { pool } from "./sqlite";

function slotForNowIST(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

export async function bookAndCheckout(checkinId: number, memberId: number, centerId: string): Promise<void> {
  // Fetch all ingredient selections for this checkin, including flavour
  const { rows: selections } = await pool.query(
    `SELECT vis.ingredient_id,
            i.name, COALESCE(vis.flavour, i.flavour) AS flavour, i.serving_qty, i.kcal_per_serving,
            i.protein_per_serving, i.fiber_per_serving, i.carbs_per_serving, i.fat_per_serving
     FROM (
       SELECT ingredient_id, NULL as flavour FROM visit_ingredient_selections WHERE checkin_id = $1
       UNION ALL
       SELECT ingredient_id, flavour FROM visit_flavour_selections WHERE checkin_id = $1
     ) vis
     JOIN ingredients i ON i.id = vis.ingredient_id`,
    [checkinId]
  );

  if (selections.length === 0) {
    // Still close the check-in even if no selections were made, but mark as cancelled
    await pool.query(
      `UPDATE member_check_ins SET checked_out_at = NOW(), cancelled = TRUE WHERE id = $1`,
      [checkinId]
    );
    return;
  }

  const mealSlot = slotForNowIST();

  await pool.query("BEGIN");
  try {
    for (const sel of selections) {
      const serveQty = Number(sel.serving_qty) || 1;
      const kcal = Number(sel.kcal_per_serving) || 0;
      const protein = Number(sel.protein_per_serving) || 0;
      const fiber = Number(sel.fiber_per_serving) || 0;
      const carbs = Number(sel.carbs_per_serving) || 0;
      const fat = Number(sel.fat_per_serving) || 0;

      // Deduct from ingredient batch stock if an open batch exists
      const { rows: batches } = await pool.query(
        `SELECT ib.id, COALESCE(ib.received_qty, i.pack_size) AS pack_size
         FROM ingredient_batches ib
         JOIN ingredients i ON i.id = ib.ingredient_id
         WHERE ib.ingredient_id = $1 AND ib.center_id = $2 AND ib.status = 'open'
         ORDER BY ib.opened_at ASC LIMIT 1`,
        [sel.ingredient_id as number, centerId]
      );

      if (batches[0]) {
        const batchRow = batches[0] as { id: number; pack_size: number };

        await pool.query(
          `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
           VALUES ($1, $2, 'auto: member visit', NOW())`,
          [batchRow.id, serveQty]
        );

        // Recalculate consumed total and update batch
        await pool.query(
          `WITH consumption AS (
             SELECT COALESCE(SUM(quantity), 0) AS used
             FROM batch_consumption_logs WHERE batch_id = $1
           )
           UPDATE ingredient_batches
           SET consumed_qty = (SELECT used FROM consumption)
           WHERE id = $1`,
          [batchRow.id]
        );

        // Auto-close batch if fully consumed
        await pool.query(
          `UPDATE ingredient_batches
           SET status = 'consumed', consumed_at = NOW()
           WHERE id = $1 AND consumed_qty >= $2 AND status = 'open'`,
          [batchRow.id, batchRow.pack_size]
        );
      }

      // Log each item as its own consumption record with flavour
      const foodLabel = sel.flavour
        ? `${sel.name as string} (${sel.flavour as string})`
        : (sel.name as string);

      await pool.query(
        `INSERT INTO consumption_logs
           (member_id, meal_slot, food_item, calories_kcal, protein_g, fiber_g, carbs_g, fat_g, selected_flavour, checkin_id, logged_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          memberId,
          mealSlot,
          foodLabel,
          kcal > 0 ? kcal : null,
          protein > 0 ? protein : null,
          fiber > 0 ? fiber : null,
          carbs > 0 ? carbs : null,
          fat > 0 ? fat : null,
          (sel.flavour as string | null) ?? null,
          checkinId,
        ]
      );
    }

    // Mark check-in as checked out
    await pool.query(
      `UPDATE member_check_ins SET checked_out_at = NOW() WHERE id = $1`,
      [checkinId]
    );

    await pool.query("COMMIT");
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}
