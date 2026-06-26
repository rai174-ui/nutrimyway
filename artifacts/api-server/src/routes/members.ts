import { Router } from "express";
import { pool } from "../lib/sqlite";

const router = Router();

// GET /api/members/:id
router.get("/members/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM members WHERE id = $1", [Number(req.params.id)]);
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
  res.json(rows[0]);
});

// GET /api/members/:id/centers
router.get("/members/:id/centers", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.* FROM centers c JOIN member_center_mapping m ON m.center_id = c.id WHERE m.member_id = $1`,
    [Number(req.params.id)]
  );
  res.json(rows);
});

// GET /api/members/:id/health-records
router.get("/members/:id/health-records", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM health_records WHERE member_id = $1 ORDER BY recorded_at DESC",
    [Number(req.params.id)]
  );
  res.json(rows);
});

// POST /api/members/:id/health-records
router.post("/members/:id/health-records", async (req, res) => {
  const memberId = Number(req.params.id);
  const {
    recorded_at, center_id, weight_kg, body_fat_pct, visceral_fat,
    bmr, bmi, metabolic_age, muscle_mass_kg, resting_hr, notes,
  } = req.body as {
    recorded_at?: string | null; center_id?: string | null;
    weight_kg?: number | null; body_fat_pct?: number | null; visceral_fat?: number | null;
    bmr?: number | null; bmi?: number | null; metabolic_age?: number | null;
    muscle_mass_kg?: number | null; resting_hr?: number | null; notes?: string | null;
  };
  const recAt = recorded_at ? new Date(recorded_at) : new Date();
  const { rows } = await pool.query(
    `INSERT INTO health_records
       (member_id, center_id, recorded_at, weight_kg, body_fat_pct, visceral_fat,
        bmr, bmi, metabolic_age, muscle_mass_kg, resting_hr, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      memberId, center_id ?? null, recAt,
      weight_kg ?? null, body_fat_pct ?? null, visceral_fat ?? null,
      bmr ?? null, bmi ?? null, metabolic_age ?? null,
      muscle_mass_kg ?? null, resting_hr ?? null, notes ?? null,
    ]
  );
  res.status(201).json(rows[0]);
});

// GET /api/members/:id/consumption?date=YYYY-MM-DD
router.get("/members/:id/consumption", async (req, res) => {
  const memberId = Number(req.params.id);
  const date = req.query.date as string | undefined;
  if (date) {
    const { rows } = await pool.query(
      "SELECT * FROM consumption_logs WHERE member_id = $1 AND DATE(logged_at) = $2 ORDER BY logged_at ASC",
      [memberId, date]
    );
    res.json(rows);
  } else {
    const { rows } = await pool.query(
      "SELECT * FROM consumption_logs WHERE member_id = $1 ORDER BY logged_at DESC LIMIT 100",
      [memberId]
    );
    res.json(rows);
  }
});

// POST /api/members/:id/consumption
router.post("/members/:id/consumption", async (req, res) => {
  const memberId = Number(req.params.id);
  const { meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, menu_item_id } = req.body as {
    meal_slot: string; food_item: string;
    quantity_g?: number | null; calories_kcal?: number | null;
    protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null;
    menu_item_id?: number | null;
  };
  if (!meal_slot || !food_item) { res.status(400).json({ error: "meal_slot and food_item are required" }); return; }

  // Validate menu_item_id exists AND belongs to the member's own center (prevents cross-center IDOR)
  if (menu_item_id != null) {
    const { rows: item } = await pool.query(
      `SELECT mi.id FROM menu_items mi
       JOIN member_center_mapping mcm ON mcm.center_id = mi.center_id
       WHERE mi.id = $1 AND mcm.member_id = $2
       LIMIT 1`,
      [menu_item_id, memberId]
    );
    if (!item[0]) { res.status(400).json({ error: "menu_item_id does not exist or does not belong to member's center" }); return; }
  }

  const { rows } = await pool.query(
    `INSERT INTO consumption_logs
       (member_id, logged_at, meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, menu_item_id)
     VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [memberId, meal_slot, food_item, quantity_g ?? null, calories_kcal ?? null,
     protein_g ?? null, carbs_g ?? null, fat_g ?? null, menu_item_id ?? null]
  );
  res.status(201).json(rows[0]);
});

// GET /api/members/:id/summary?date=YYYY-MM-DD
router.get("/members/:id/summary", async (req, res) => {
  const memberId = Number(req.params.id);
  const date = (req.query.date as string) ?? new Date().toISOString().split("T")[0];
  const { rows: logs } = await pool.query(
    "SELECT * FROM consumption_logs WHERE member_id = $1 AND DATE(logged_at) = $2 ORDER BY logged_at ASC",
    [memberId, date]
  ) as { rows: Array<{ id: number; member_id: number; logged_at: string; meal_slot: string; food_item: string; quantity_g: number | null; calories_kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }> };

  const totals = logs.reduce(
    (acc, log) => {
      acc.total_calories += Number(log.calories_kcal ?? 0);
      acc.total_protein += Number(log.protein_g ?? 0);
      acc.total_carbs += Number(log.carbs_g ?? 0);
      acc.total_fat += Number(log.fat_g ?? 0);
      return acc;
    },
    { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0 }
  );

  const logsBySlot: Record<string, typeof logs> = {};
  for (const log of logs) {
    const slot = log.meal_slot ?? "Other";
    if (!logsBySlot[slot]) logsBySlot[slot] = [];
    logsBySlot[slot].push(log);
  }

  res.json({ date, ...totals, target_calories: 2000, logs_by_slot: logsBySlot });
});

// GET /api/members/:id/issuances
router.get("/members/:id/issuances", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM issuances WHERE member_id = $1 ORDER BY issued_at DESC",
    [Number(req.params.id)]
  );
  res.json(rows);
});

export default router;
