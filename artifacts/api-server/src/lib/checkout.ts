import { pool } from "./sqlite";

function slotForNowIST(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

export async function bookAndCheckout(checkinId: number, memberId: number, centerId: string): Promise<void> {
  // Fetch all selections (mandatory + optional) for this visit
  const { rows: selections } = await pool.query(
    `SELECT vms.menu_item_id, mi.name
     FROM visit_menu_selections vms
     JOIN menu_items mi ON mi.id = vms.menu_item_id
     WHERE vms.checkin_id = $1`,
    [checkinId]
  );
  
  for (const sel of selections) {
    // Only log consumption if ALL tracked BOM ingredients have an open batch.
    const { rows: avail } = await pool.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM menu_item_bom mb
         WHERE mb.menu_item_id = $1 AND mb.ingredient_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM ingredient_batches ib
             WHERE ib.ingredient_id = mb.ingredient_id AND ib.center_id = $2 AND ib.status = 'open'
           )
       ) AS is_available`,
      [sel.menu_item_id as number, centerId]
    );
    if (!(avail[0] as { is_available: boolean }).is_available) continue;

    // Sum BOM kcal for this menu item
    const { rows: kcalRows } = await pool.query(
      `SELECT COALESCE(SUM(kcal), 0) AS total_kcal FROM menu_item_bom WHERE menu_item_id = $1`,
      [sel.menu_item_id as number]
    );
    const totalKcal = Number((kcalRows[0] as { total_kcal: number }).total_kcal) || null;

    // Log consumption under the time-appropriate meal slot
    await pool.query(
      `INSERT INTO consumption_logs (member_id, meal_slot, food_item, menu_item_id, calories_kcal, checkin_id, logged_at)
       VALUES ($1, $5, $2, $3, $4, $6, NOW())`,
      [memberId, sel.name as string, sel.menu_item_id as number, totalKcal, slotForNowIST(), checkinId]
    );
    
    // Deduct BOM quantities from the open ingredient batch
    const { rows: bom } = await pool.query(
      `SELECT mb.ingredient_id, mb.quantity FROM menu_item_bom mb
       WHERE mb.menu_item_id = $1 AND mb.ingredient_id IS NOT NULL`,
      [sel.menu_item_id as number]
    );
    for (const b of bom) {
      const { rows: batches } = await pool.query(
        `SELECT ib.id, COALESCE(ib.received_qty, i.pack_size) AS pack_size FROM ingredient_batches ib
         JOIN ingredients i ON i.id = ib.ingredient_id
         WHERE ib.ingredient_id = $1 AND ib.center_id = $2 AND ib.status = 'open'
         ORDER BY ib.opened_at ASC LIMIT 1`,
        [b.ingredient_id as number, centerId]
      );
      if (batches[0]) {
        const batchRow = batches[0] as { id: number; pack_size: number };
        await pool.query(
          `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
           VALUES ($1, $2, 'auto: member visit', NOW())`,
          [batchRow.id, b.quantity as number]
        );
        const { rows: bal } = await pool.query(
          `SELECT COALESCE(SUM(quantity), 0) AS total FROM batch_consumption_logs WHERE batch_id = $1`,
          [batchRow.id]
        );
        if (Number((bal[0] as { total: number }).total) >= batchRow.pack_size) {
          await pool.query(
            `UPDATE ingredient_batches SET status = 'consumed', consumed_at = NOW()
             WHERE id = $1 AND status = 'open'`,
            [batchRow.id]
          );
        }
      }
    }
  }

  // Process direct-order flavour selections
  const { rows: flavourSels } = await pool.query(
    `SELECT vfs.ingredient_id, vfs.flavour, i.name
     FROM visit_flavour_selections vfs
     JOIN ingredients i ON i.id = vfs.ingredient_id
     WHERE vfs.checkin_id = $1`,
    [checkinId]
  );
  for (const fsel of flavourSels) {
    const { rows: batches } = await pool.query(
      `SELECT ib.id, COALESCE(ib.received_qty, i.pack_size, 1) AS total_qty,
              COALESCE(
                (SELECT mb.quantity FROM menu_item_bom mb
                 JOIN visit_menu_selections vms ON vms.menu_item_id = mb.menu_item_id
                 WHERE vms.checkin_id = $3 AND mb.ingredient_id = $1 LIMIT 1),
                i.serving_qty,
                1
              ) AS serving_qty
       FROM ingredient_batches ib
       JOIN ingredients i ON i.id = ib.ingredient_id
       WHERE ib.ingredient_id = $1 AND ib.center_id = $2 AND ib.status = 'open'
       ORDER BY ib.opened_at ASC LIMIT 1`,
      [fsel.ingredient_id as number, centerId, checkinId]
    );
    if (!batches[0]) continue;
    const batchRow = batches[0] as { id: number; total_qty: number; serving_qty: number };
    const foodLabel = `${fsel.name as string} – ${fsel.flavour as string}`;
    
    // Look up kcal_per_serving
    const { rows: kcalIngRows } = await pool.query(
      `SELECT kcal_per_serving FROM ingredients WHERE id = $1`,
      [fsel.ingredient_id as number]
    );
    const kcalPerServing = Number((kcalIngRows[0] as { kcal_per_serving: number | null })?.kcal_per_serving) || null;

    await pool.query(
      `INSERT INTO consumption_logs (member_id, meal_slot, food_item, quantity_g, calories_kcal, checkin_id, logged_at)
       VALUES ($1, $4, $2, $5, $3, $6, NOW())`,
      [memberId, foodLabel, kcalPerServing, slotForNowIST(), batchRow.serving_qty, checkinId]
    );

    await pool.query(
      `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
       VALUES ($1, $2, 'auto: flavour visit', NOW())`,
      [batchRow.id, batchRow.serving_qty]
    );
    const { rows: bal } = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM batch_consumption_logs WHERE batch_id = $1`,
      [batchRow.id]
    );
    if (Number((bal[0] as { total: number }).total) >= batchRow.total_qty) {
      await pool.query(
        `UPDATE ingredient_batches SET status = 'consumed', consumed_at = NOW()
         WHERE id = $1 AND status = 'open'`,
        [batchRow.id]
      );
    }
  }

  // Finally mark as checked out
  await pool.query(
    `UPDATE member_check_ins SET checked_out_at = NOW()
     WHERE id = $1`,
    [checkinId]
  );
}
