import { Router } from "express";
import { pool } from "../lib/sqlite";
import { requireMember, type MemberRequest } from "./auth";
import { bookAndCheckout } from "../lib/checkout";

const router = Router();
router.use("/members", requireMember);

// Ensure that member routes cannot access data belonging to other members
router.param("id", (req, res, next, id) => {
  if ((req as unknown as MemberRequest).authMemberId !== Number(id)) {
    res.status(403).json({ error: "Forbidden: Cannot access other member's data" });
    return;
  }
  next();
});

router.param("memberId", (req, res, next, id) => {
  if ((req as unknown as MemberRequest).authMemberId !== Number(id)) {
    res.status(403).json({ error: "Forbidden: Cannot access other member's data" });
    return;
  }
  next();
});

const DEFAULT_CHECKIN_CAP = 32;

// Trial 3-Day members always get a fixed check-in cap, overriding whatever
// the center(s) have configured. Trial 1-Day members and all other member
// types continue to use the center's configured cap. The value itself is a
// global, super-admin-editable setting (see app_settings table) rather than
// a hardcoded constant, so it can be tuned without a code deploy.
const DEFAULT_TRIAL_3DAY_CHECKIN_CAP = 3;

async function getTrialCheckinCap(): Promise<number> {
  const { rows } = await pool.query("SELECT trial_3day_checkin_cap FROM app_settings WHERE id = 'global'");
  return Number(rows[0]?.trial_3day_checkin_cap ?? DEFAULT_TRIAL_3DAY_CHECKIN_CAP);
}

async function getMemberType(memberId: number): Promise<string | undefined> {
  const { rows } = await pool.query("SELECT member_type FROM members WHERE id = $1", [memberId]);
  return rows[0]?.member_type as string | undefined;
}

async function isTrialMemberType(memberId: number): Promise<boolean> {
  const type = await getMemberType(memberId);
  return type === "trial_1day" || type === "trial_3day";
}

// A member can be mapped to more than one center; use the strictest (lowest)
// check-in cap among their centers so no single center's limit is exceeded.
// Trial 3-Day members always use the fixed override regardless of center config.
async function getMemberCheckinCap(memberId: number): Promise<number> {
  const memberType = await getMemberType(memberId);
  if (memberType === "trial_3day") return getTrialCheckinCap();

  const { rows } = await pool.query(
    `SELECT MIN(c.checkin_cap) AS cap
     FROM member_center_mapping mcm
     JOIN centers c ON c.id = mcm.center_id
     WHERE mcm.member_id = $1`,
    [memberId]
  );
  const cap = rows[0]?.cap as number | null;
  return cap ?? DEFAULT_CHECKIN_CAP;
}

async function getCenterCheckinCap(centerId: string): Promise<number> {
  const { rows } = await pool.query("SELECT checkin_cap FROM centers WHERE id = $1", [centerId]);
  return Number(rows[0]?.checkin_cap ?? DEFAULT_CHECKIN_CAP);
}

// GET /api/members/:id
router.get("/members/:id", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM members WHERE id = $1", [Number(req.params.id)]);
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
  res.json(rows[0]);
});

// GET /api/members/:id/status — check-in usage and validity expiry warnings
router.get("/members/:id/status", async (req, res) => {
  const memberId = Number(req.params.id);
  const { rows } = await pool.query(
    `SELECT m.valid_until,
            m.cycle_started_at,
            (SELECT COUNT(*) FROM member_check_ins mci
             WHERE mci.member_id = m.id
               AND mci.cancelled = FALSE
               AND (m.cycle_started_at IS NULL OR mci.checked_in_at >= m.cycle_started_at)
            ) AS checkins_used,
            (m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS expiring_by_date,
            CASE WHEN m.valid_until IS NOT NULL
              THEN (DATE(m.valid_until) - CURRENT_DATE)
              ELSE NULL
            END AS days_until_expiry
     FROM members m
     WHERE m.id = $1`,
    [memberId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }

  const row = rows[0] as {
    valid_until: string | null;
    checkins_used: string;
    expiring_by_date: boolean;
    days_until_expiry: number | null;
  };
  const checkinCap = await getMemberCheckinCap(memberId);
  const checkinsUsed = Number(row.checkins_used);
  const checkinsRemaining = Math.max(checkinCap - checkinsUsed, 0);
  const isExpiringSoon = row.expiring_by_date || checkinsRemaining <= 7;

  res.json({
    checkin_cap: checkinCap,
    checkins_used: checkinsUsed,
    checkins_remaining: checkinsRemaining,
    valid_until: row.valid_until,
    days_until_expiry: row.days_until_expiry,
    is_expiring_soon: isExpiringSoon,
  });
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
  const { meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, fiber_g, menu_item_id, photo_url } = req.body as {
    meal_slot: string; food_item: string;
    quantity_g?: number | null; calories_kcal?: number | null;
    protein_g?: number | null; carbs_g?: number | null; fat_g?: number | null; fiber_g?: number | null;
    menu_item_id?: number | null;
    photo_url?: string | null;
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
       (member_id, logged_at, meal_slot, food_item, quantity_g, calories_kcal, protein_g, carbs_g, fat_g, menu_item_id, photo_url, photo_uploaded_at)
     VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [memberId, meal_slot, food_item, quantity_g ?? null, calories_kcal ?? null,
     protein_g ?? null, carbs_g ?? null, fat_g ?? null, menu_item_id ?? null,
     photo_url ?? null, photo_url ? new Date().toISOString() : null]
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
  ) as { rows: Array<{ id: number; member_id: number; logged_at: string; meal_slot: string; food_item: string; quantity_g: number | null; calories_kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }> };

  const totals = logs.reduce(
    (acc, log) => {
      acc.total_calories += Number(log.calories_kcal ?? 0);
      acc.total_protein += Number(log.protein_g ?? 0);
      acc.total_carbs += Number(log.carbs_g ?? 0);
      acc.total_fat += Number(log.fat_g ?? 0);
      acc.total_fiber += Number(log.fiber_g ?? 0);
      return acc;
    },
    { total_calories: 0, total_protein: 0, total_carbs: 0, total_fat: 0, total_fiber: 0 }
  );

  const logsBySlot: Record<string, typeof logs> = {};
  for (const log of logs) {
    const slot = log.meal_slot ?? "Other";
    if (!logsBySlot[slot]) logsBySlot[slot] = [];
    logsBySlot[slot].push(log);
  }

  // Get member targets
  const { rows: memberRows } = await pool.query("SELECT daily_kcal, protein_target_g, fiber_target_g, water_target_ml FROM members WHERE id = $1", [memberId]);
  const m = memberRows[0] as { daily_kcal: number | null; protein_target_g: number | null; fiber_target_g: number | null; water_target_ml: number | null } | undefined;

  // Get self-logged nutrition (water)
  const { rows: nutRows } = await pool.query(
    "SELECT water_ml FROM member_nutrition_logs WHERE member_id = $1 AND logged_date = $2",
    [memberId, date]
  );
  const totalWater = nutRows[0]?.water_ml ?? 0;

  res.json({
    date,
    ...totals,
    total_water: totalWater,
    target_calories: m?.daily_kcal ?? 2000,
    protein_target_g: m?.protein_target_g,
    fiber_target_g: m?.fiber_target_g,
    water_target_ml: m?.water_target_ml,
    logs_by_slot: logsBySlot
  });
});

// POST /api/members/:id/water
router.post("/members/:id/water", async (req, res) => {
  const memberId = Number(req.params.id);
  const { water_ml } = req.body as { water_ml: number };
  const date = todayIST();

  if (typeof water_ml !== "number" || isNaN(water_ml) || water_ml < 0) {
    res.status(400).json({ error: "Invalid water_ml" });
    return;
  }

  try {
    await pool.query(
      `INSERT INTO member_nutrition_logs (member_id, logged_date, water_ml)
       VALUES ($1, $2, $3)
       ON CONFLICT (member_id, logged_date)
       DO UPDATE SET water_ml = EXCLUDED.water_ml, logged_at = NOW()`,
      [memberId, date, water_ml]
    );
    res.json({ success: true, water_ml });
  } catch (err) {
    res.status(500).json({ error: "Failed to log water" });
  }
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
  const isTrialMember = await isTrialMemberType(memberId);

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
       AND (
         $3 = TRUE AND mi.trial_eligible = TRUE
         OR $3 = FALSE AND (mi.available_days = 'all' OR mi.available_days LIKE $2)
       )
     GROUP BY mi.id, mi.name, mi.description, mi.flavours, mi.available_days, mi.created_at
     ORDER BY mi.created_at`,
    [centerId, `%${todayDay}%`, isTrialMember]
  );
  res.json(rows);
});

// POST /api/members/:id/checkin — self check-in (body: { center_id, weight_kg })
router.post("/members/:id/checkin", async (req, res) => {
  const memberId = Number(req.params.id);
  const { center_id, weight_kg } = req.body as { center_id?: string; weight_kg?: number };
  if (!center_id) { res.status(400).json({ error: "center_id is required" }); return; }
  if (!weight_kg || weight_kg <= 0) { res.status(400).json({ error: "weight_kg is required for check-in" }); return; }

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

  const { rows: cycleRows } = await pool.query(`SELECT cycle_started_at FROM members WHERE id = $1`, [memberId]);
  const cycleStartedAt = cycleRows[0]?.cycle_started_at as string | null;
  if (cycleStartedAt) {
    const memberType = await getMemberType(memberId);
    const checkinCap = memberType === "trial_3day" ? await getTrialCheckinCap() : await getCenterCheckinCap(center_id);
    const { rows: usedRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM member_check_ins WHERE member_id = $1 AND cancelled = FALSE AND checked_in_at >= $2`,
      [memberId, cycleStartedAt]
    );
    if (Number(usedRows[0].count) >= checkinCap) {
      res.status(403).json({ error: `You've reached the ${checkinCap} check-in limit for this membership cycle. Please renew your membership at your center to continue.` });
      return;
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO member_check_ins (member_id, center_id) VALUES ($1,$2) RETURNING *`,
    [memberId, center_id]
  );

  // Also record it as a formal health record for the day
  await pool.query(
    `INSERT INTO health_records (member_id, center_id, weight_kg, recorded_at) VALUES ($1,$2,$3,NOW())`,
    [memberId, center_id, weight_kg]
  );

  res.status(201).json(rows[0]);
});

// POST /api/members/:id/checkout — self check-out
router.post("/members/:id/checkout", async (req, res) => {
  const memberId = Number(req.params.id);

  // Fetch active check-in first so we can deduct flavour consumption before closing
  const { rows: ciRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins
     WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!ciRows[0]) { res.status(404).json({ error: "No active check-in found" }); return; }
  const checkin = ciRows[0] as { id: number; center_id: string };

  await bookAndCheckout(checkin.id, memberId, checkin.center_id);

  const { rows } = await pool.query(
    `SELECT * FROM member_check_ins WHERE id = $1`,
    [checkin.id]
  );
  res.json(rows[0]);
});

// GET /api/members/:id/checkin-menu
router.get("/members/:id/checkin-menu", async (req, res) => {
  const memberId = Number(req.params.id);
  
  const { rows: checkinRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) { res.status(409).json({ error: "No active check-in" }); return; }
  const centerId = checkinRows[0].center_id;
  const checkinId = checkinRows[0].id;

  const { rows: categories } = await pool.query(
    `SELECT * FROM checkin_categories WHERE center_id = $1 ORDER BY display_order ASC, id ASC`,
    [centerId]
  );
  
  const { rows: mappings } = await pool.query(
    `SELECT ci.category_id, i.id as ingredient_id, i.name, i.flavour 
     FROM checkin_category_ingredients ci
     JOIN ingredients i ON i.id = ci.ingredient_id
     JOIN checkin_categories c ON c.id = ci.category_id
     WHERE c.center_id = $1`,
    [centerId]
  );
  
  const { rows: selections } = await pool.query(
    `SELECT category_id, ingredient_id FROM visit_ingredient_selections WHERE checkin_id = $1`,
    [checkinId]
  );

  const result = categories.map(cat => ({
    ...cat,
    ingredients: mappings.filter(m => m.category_id === cat.id)
  }));
  
  res.json({ categories: result, selections });
});

// POST /api/members/:id/checkin/selections
router.post("/members/:id/checkin/selections", async (req, res) => {
  const memberId = Number(req.params.id);
  
  const { rows: checkinRows } = await pool.query(
    `SELECT id, center_id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL LIMIT 1`,
    [memberId]
  );
  if (!checkinRows[0]) { res.status(409).json({ error: "No active check-in" }); return; }
  const checkinId = checkinRows[0].id;

  const { items } = req.body as { items?: { category_id?: number; ingredient_id: number }[] };
  
  if (!Array.isArray(items)) { res.status(400).json({ error: "items array required" }); return; }

  await pool.query("BEGIN");
  try {
    await pool.query(`DELETE FROM visit_ingredient_selections WHERE checkin_id = $1`, [checkinId]);
    for (const item of items) {
      if (item.ingredient_id) {
        await pool.query(
          `INSERT INTO visit_ingredient_selections (checkin_id, category_id, ingredient_id) VALUES ($1, $2, $3)`,
          [checkinId, item.category_id ?? null, item.ingredient_id]
        );
      }
    }
    await pool.query("COMMIT");
    res.json({ success: true, count: items.length });
  } catch (e) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: "Failed to save selections" });
  }
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

// ── AI Food Photo Analysis ────────────────────────────────────────────────

// In-memory sliding-window rate limiter — max 15 requests/min globally.
// No DB required; resets on server restart (acceptable for this use case).
const rateWindow: number[] = [];
const RATE_LIMIT_RPM = 15;

function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  while (rateWindow.length && rateWindow[0] < oneMinuteAgo) rateWindow.shift();
  if (rateWindow.length >= RATE_LIMIT_RPM) return false;
  rateWindow.push(now);
  return true;
}

// POST /api/members/:id/analyze-food-photo
// Key priority: 1) member's own key (DB)  2) server GEMINI_API_KEY env  3) 402
router.post("/members/:id/analyze-food-photo", async (req, res) => {
  const memberId = Number(req.params.id);
  const { image_base64, mime_type } = req.body as { image_base64?: string; mime_type?: string };

  if (!image_base64 || !mime_type) {
    res.status(400).json({ error: "image_base64 and mime_type are required" });
    return;
  }

  if (!checkRateLimit()) {
    res.status(429).json({ error: "AI is busy right now — try again in a moment. Your photo is saved." });
    return;
  }

  const { rows } = await pool.query(
    "SELECT gemini_api_key FROM members WHERE id = $1",
    [memberId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }

  // Resolve which API key to use: member's own key → server key → error
  const memberKey = rows[0].gemini_api_key as string | null;
  const serverKey = process.env.GEMINI_API_KEY ?? null;
  const apiKey = memberKey || serverKey;

  if (!apiKey) {
    res.status(402).json({
      error: "AI Food Scan is not configured. Please ask your wellness center to set up the Gemini API key.",
    });
    return;
  }

  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `Analyse this food image and respond with ONLY a valid JSON object, no markdown, no explanation:
{
  "food_item": "<name of the food>",
  "calories_kcal": <estimated kcal as a number or null>,
  "protein_g": <estimated protein in grams as a number or null>,
  "fiber_g": <estimated fiber in grams as a number or null>
}
If you cannot identify food, return: {"error": "No food detected"}`;

  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-image",
    "gemini-3-flash-preview",
    "gemini-2.5-flash-image",
    "gemini-3.1-flash",
    "gemini-3.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b"
  ];

  let text: string | null = null;
  let lastError: unknown = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        prompt,
        { inlineData: { data: image_base64, mimeType: mime_type } },
      ]);
      text = result.response.text().trim().replace(/^```json\s*|```\s*$/g, "");
      break; // Success, exit the loop
    } catch (err: any) {
      lastError = err;
      // If it's a 404 (model not found), try the next model. Otherwise, break and handle the error (e.g. auth, quota).
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.includes("not found")) {
        req.log.info({ model: modelName, err: msg }, "Model not found, trying fallback...");
        continue;
      }
      break;
    }
  }

  if (text === null) {

    const err = lastError;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key not valid") || msg.includes("API_KEY_INVALID") || msg.includes("permission")) {
      res.status(403).json({ error: "Gemini API key is not valid. Please contact your wellness center." });
    } else {
      res.status(422).json({ error: "Unable to process please enter manually or retry" });
    }
    req.log.error({ err: msg }, "Gemini API call failed");
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    res.status(422).json({ error: "Unable to process please enter manually or retry" });
    return;
  }

  if (parsed.error) {
    res.status(422).json({ error: "Unable to process please enter manually or retry" });
    return;
  }

  res.json({
    food_item: String(parsed.food_item ?? ""),
    calories_kcal: parsed.calories_kcal != null ? Number(parsed.calories_kcal) : null,
    protein_g: parsed.protein_g != null ? Number(parsed.protein_g) : null,
    fiber_g: parsed.fiber_g != null ? Number(parsed.fiber_g) : null,
  });
});

// ── Member Broadcasts ─────────────────────────────────────────────────────

// GET /api/members/:memberId/broadcasts — broadcasts for this member's centers, with read status, respecting center retention
router.get("/members/:memberId/broadcasts", async (req, res) => {
  const memberId = Number(req.params.memberId);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { rows: centers } = await pool.query(
    "SELECT center_id FROM member_center_mapping WHERE member_id = $1",
    [memberId]
  );
  if (centers.length === 0) { res.json([]); return; }
  const centerIds = centers.map((c: { center_id: string }) => c.center_id);
  const placeholders = centerIds.map((_: unknown, i: number) => "$" + (i + 2)).join(",");
  const { rows } = await pool.query(
    `SELECT b.id, b.center_id, b.message, b.sent_at, b.sent_by,
            EXISTS(SELECT 1 FROM member_broadcast_reads r WHERE r.broadcast_id = b.id AND r.member_id = $1) AS is_read
     FROM member_broadcasts b
     WHERE b.center_id IN (${placeholders})
       AND b.sent_at >= NOW() - COALESCE(
         (SELECT NULLIF(cbs.retention_days, 0) FROM center_broadcast_settings cbs WHERE cbs.center_id = b.center_id),
         1
       ) * INTERVAL '1 day'
     ORDER BY b.sent_at DESC
     LIMIT $${centerIds.length + 2}`,
    [memberId, ...centerIds, limit]
  );
  res.json(rows);
});

// POST /api/members/:memberId/broadcasts/:broadcastId/read
router.post("/members/:memberId/broadcasts/:broadcastId/read", async (req, res) => {
  const memberId = Number(req.params.memberId);
  const broadcastId = Number(req.params.broadcastId);
  await pool.query(
    `INSERT INTO member_broadcast_reads (member_id, broadcast_id, read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (member_id, broadcast_id) DO NOTHING`,
    [memberId, broadcastId]
  );
  res.json({ success: true });
});

// PUT /api/members/:id/push-token — register or update FCM push token
router.put("/members/:id/push-token", async (req, res) => {
  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token) { res.status(400).json({ error: "token is required" }); return; }
  await pool.query(
    "UPDATE members SET push_token = $1, push_platform = $2 WHERE id = $3",
    [token, platform ?? "android", Number(req.params.id)]
  );
  res.json({ success: true });
});

export default router;
