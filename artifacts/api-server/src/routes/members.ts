import { Router } from "express";
import { pool } from "../lib/sqlite";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
      "SELECT * FROM consumption_logs WHERE member_id = $1 AND DATE(logged_at AT TIME ZONE 'Asia/Kolkata') = $2 ORDER BY logged_at ASC",
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

function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

// GET /api/members/:id/summary?date=YYYY-MM-DD
router.get("/members/:id/summary", async (req, res) => {
  const memberId = Number(req.params.id);
  const date = (req.query.date as string) ?? todayIST();
  const { rows: logs } = await pool.query(
    "SELECT * FROM consumption_logs WHERE member_id = $1 AND DATE(logged_at AT TIME ZONE 'Asia/Kolkata') = $2 ORDER BY logged_at ASC",
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

// GET /api/members/:id/checkin/active — current active check-in with center info
router.get("/members/:id/checkin/active", async (req, res) => {
  const memberId = Number(req.params.id);
  const { rows } = await pool.query(
    `SELECT mci.id, mci.member_id, mci.center_id, mci.checked_in_at, mci.checked_out_at,
            c.name AS center_name
     FROM member_check_ins mci
     JOIN centers c ON c.id = mci.center_id
     WHERE mci.member_id = $1 AND mci.checked_out_at IS NULL
     ORDER BY mci.checked_in_at DESC LIMIT 1`,
    [memberId]
  );
  res.json(rows[0] ?? null);
});

// GET /api/members/:id/center-menu — menu items for the member's active check-in center
router.get("/members/:id/center-menu", async (req, res) => {
  const memberId = Number(req.params.id);
  const { rows: checkin } = await pool.query(
    `SELECT center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkin[0]) { res.json([]); return; }

  const centerId = checkin[0].center_id as string;

  // Determine today's day abbreviation in IST (Asia/Kolkata = UTC+5:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[nowIst.getUTCDay()];

  const { rows } = await pool.query(
    `SELECT mi.id, mi.name, mi.description, mi.flavours, mi.available_days,
       COALESCE(
         json_agg(
           json_build_object('id', mib.id, 'ingredient', mib.ingredient, 'quantity', mib.quantity, 'unit', mib.unit, 'kcal', mib.kcal)
           ORDER BY mib.id
         ) FILTER (WHERE mib.id IS NOT NULL),
         '[]'::json
       ) AS bom
     FROM menu_items mi
     LEFT JOIN menu_item_bom mib ON mib.menu_item_id = mi.id
     WHERE mi.center_id = $1
       AND (mi.available_days = 'all' OR mi.available_days LIKE $2)
     GROUP BY mi.id, mi.name, mi.description, mi.flavours, mi.available_days, mi.created_at
     ORDER BY mi.created_at`,
    [centerId, `%${todayDay}%`]
  );
  res.json(rows);
});

// POST /api/members/:id/checkin — self check-in (body: { center_id })
router.post("/members/:id/checkin", async (req, res) => {
  const memberId = Number(req.params.id);
  const { center_id } = req.body as { center_id?: string };
  if (!center_id) { res.status(400).json({ error: "center_id is required" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [memberId, center_id]
  );
  if (!membership[0]) { res.status(403).json({ error: "Not a member of this center" }); return; }

  const { rows: existing } = await pool.query(
    `SELECT id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL`,
    [memberId]
  );
  if (existing[0]) { res.status(409).json({ error: "Already checked in" }); return; }

  const { rows } = await pool.query(
    `INSERT INTO member_check_ins (member_id, center_id) VALUES ($1,$2) RETURNING *`,
    [memberId, center_id]
  );
  res.status(201).json(rows[0]);
});

// POST /api/members/:id/checkout — self check-out
router.post("/members/:id/checkout", async (req, res) => {
  const memberId = Number(req.params.id);
  const { rows } = await pool.query(
    `UPDATE member_check_ins SET checked_out_at = NOW()
     WHERE member_id = $1 AND checked_out_at IS NULL
     RETURNING *`,
    [memberId]
  );
  if (!rows[0]) { res.status(404).json({ error: "No active check-in found" }); return; }
  res.json(rows[0]);
});

// GET /api/members/:id/checkin-options — menu items + direct-flavour items + current selections
router.get("/members/:id/checkin-options", async (req, res) => {
  const memberId = Number(req.params.id);

  const { rows: checkinRows } = await pool.query(
    `SELECT mci.id, mci.center_id, c.name AS center_name, mci.checked_in_at
     FROM member_check_ins mci
     JOIN centers c ON c.id = mci.center_id
     WHERE mci.member_id = $1 AND mci.checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) {
    res.json({ checkin: null, menuItems: [], directFlavours: [], selections: [] });
    return;
  }
  const checkin = checkinRows[0] as { id: number; center_id: string; center_name: string; checked_in_at: string };
  const centerId = checkin.center_id;

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[nowIst.getUTCDay()];

  const { rows: menuItems } = await pool.query(
    `SELECT mi.id, mi.name, mi.description, mi.flavours, mi.available_days,
       COALESCE(
         json_agg(
           json_build_object('id', mib.id, 'ingredient', mib.ingredient, 'quantity', mib.quantity, 'unit', mib.unit, 'kcal', mib.kcal)
           ORDER BY mib.id
         ) FILTER (WHERE mib.id IS NOT NULL),
         '[]'::json
       ) AS bom
     FROM menu_items mi
     LEFT JOIN menu_item_bom mib ON mib.menu_item_id = mi.id
     WHERE mi.center_id = $1
       AND (mi.available_days = 'all' OR mi.available_days LIKE $2)
     GROUP BY mi.id, mi.name, mi.description, mi.flavours, mi.available_days, mi.created_at
     ORDER BY mi.created_at`,
    [centerId, `%${todayDay}%`]
  );

  const { rows: directFlavours } = await pool.query(
    `SELECT DISTINCT ON (i.id) i.id, i.name, i.flavour, i.unit
     FROM ingredients i
     JOIN ingredient_batches ib ON ib.ingredient_id = i.id
     WHERE i.flavour IS NOT NULL AND i.flavour != ''
       AND ib.center_id = $1 AND ib.status = 'open'
     ORDER BY i.id, i.name`,
    [centerId]
  );

  const { rows: menuSels } = await pool.query(
    `SELECT vms.menu_item_id, mi.name, vms.selected_flavour
     FROM visit_menu_selections vms
     JOIN menu_items mi ON mi.id = vms.menu_item_id
     WHERE vms.checkin_id = $1`,
    [checkin.id]
  );
  const { rows: flavourSels } = await pool.query(
    `SELECT vfs.ingredient_id, i.name, vfs.flavour
     FROM visit_flavour_selections vfs
     JOIN ingredients i ON i.id = vfs.ingredient_id
     WHERE vfs.checkin_id = $1`,
    [checkin.id]
  );

  const selections = [
    ...menuSels.map(s => ({ type: "menu_item" as const, menu_item_id: s.menu_item_id as number, name: s.name as string, selected_flavour: s.selected_flavour as string | null })),
    ...flavourSels.map(s => ({ type: "direct_flavour" as const, ingredient_id: s.ingredient_id as number, name: s.name as string, flavour: s.flavour as string })),
  ];

  res.json({ checkin: { id: checkin.id, center_id: centerId }, menuItems, directFlavours, selections });
});

// POST /api/members/:id/checkin/selections — save up to 3 item selections for current visit
router.post("/members/:id/checkin/selections", async (req, res) => {
  const memberId = Number(req.params.id);

  const { rows: checkinRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) { res.status(409).json({ error: "No active check-in" }); return; }
  const checkin = checkinRows[0] as { id: number; center_id: string };

  type RawItem =
    | { type: "menu_item"; menu_item_id: number; selected_flavour?: string | null }
    | { type: "direct_flavour"; ingredient_id: number; flavour: string };
  const { items } = req.body as { items?: RawItem[] };

  if (!Array.isArray(items)) { res.status(400).json({ error: "items array required" }); return; }
  if (items.length > 3) { res.status(400).json({ error: "Max 3 items allowed" }); return; }

  await pool.query(`DELETE FROM visit_menu_selections WHERE checkin_id = $1`, [checkin.id]);
  await pool.query(`DELETE FROM visit_flavour_selections WHERE checkin_id = $1`, [checkin.id]);

  for (const item of items) {
    if (item.type === "menu_item") {
      await pool.query(
        `INSERT INTO visit_menu_selections (checkin_id, menu_item_id, selected_flavour) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [checkin.id, item.menu_item_id, item.selected_flavour ?? null]
      );
    } else if (item.type === "direct_flavour") {
      await pool.query(
        `INSERT INTO visit_flavour_selections (checkin_id, ingredient_id, flavour) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [checkin.id, item.ingredient_id, item.flavour]
      );
    }
  }

  res.json({ saved: items.length });
});

// GET /api/members/:id/checkin-logs — member's own visit history (last 30 entries)
router.get("/members/:id/checkin-logs", async (req, res) => {
  const memberId = Number(req.params.id);
  const { rows } = await pool.query(
    `SELECT ci.id,
            ci.center_id,
            c.name          AS center_name,
            ci.checked_in_at,
            ci.checked_out_at,
            EXTRACT(EPOCH FROM (COALESCE(ci.checked_out_at, NOW()) - ci.checked_in_at)) / 60 AS duration_min
     FROM member_check_ins ci
     JOIN centers c ON c.id = ci.center_id
     WHERE ci.member_id = $1
     ORDER BY ci.checked_in_at DESC
     LIMIT 30`,
    [memberId]
  );
  res.json(rows);
});

// GET /api/members/:id/gemini-key — returns whether a key is set (never exposes the raw key)
router.get("/members/:id/gemini-key", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT gemini_api_key FROM members WHERE id = $1",
    [Number(req.params.id)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ has_key: !!rows[0].gemini_api_key });
});

// PUT /api/members/:id/gemini-key — save or clear the member's Gemini API key
router.put("/members/:id/gemini-key", async (req, res) => {
  const { key } = req.body as { key?: string };
  const normalized = (key ?? "").trim();
  await pool.query(
    "UPDATE members SET gemini_api_key = $1 WHERE id = $2",
    [normalized || null, Number(req.params.id)]
  );
  res.json({ has_key: !!normalized });
});

// POST /api/members/:id/analyze-food-photo — AI calorie estimation via member's own Gemini key
router.post("/members/:id/analyze-food-photo", async (req, res) => {
  const memberId = Number(req.params.id);
  const { image_base64, mime_type } = req.body as { image_base64?: string; mime_type?: string };

  if (!image_base64 || !mime_type) {
    res.status(400).json({ error: "image_base64 and mime_type are required" });
    return;
  }

  const { rows } = await pool.query(
    "SELECT gemini_api_key FROM members WHERE id = $1",
    [memberId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
  if (!rows[0].gemini_api_key) {
    res.status(402).json({ error: "No Gemini API key set. Add your key in Profile → AI Food Scan." });
    return;
  }

  const genAI = new GoogleGenerativeAI(rows[0].gemini_api_key as string);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Analyse this food image and respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "food_item": "<name of the food>",
  "calories_kcal": <estimated kcal as a number or null>,
  "protein_g": <estimated protein in grams as a number or null>
}
If you cannot identify food, return: {"error": "No food detected"}`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: image_base64, mimeType: mime_type } },
  ]);

  const text = result.response.text().trim().replace(/^```json\s*|```\s*$/g, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    res.status(422).json({ error: "Could not parse AI response. Try a clearer photo." });
    return;
  }

  if (parsed.error) {
    res.status(422).json({ error: String(parsed.error) });
    return;
  }

  res.json({
    food_item: String(parsed.food_item ?? ""),
    calories_kcal: parsed.calories_kcal != null ? Number(parsed.calories_kcal) : null,
    protein_g: parsed.protein_g != null ? Number(parsed.protein_g) : null,
  });
});

export default router;
