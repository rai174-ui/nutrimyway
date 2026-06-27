import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "../lib/sqlite";

const router = Router();
const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";

interface AdminJwt {
  centerId: string;
  role: "admin";
}

interface SuperAdminJwt {
  role: "superadmin";
}

interface AdminRequest extends Request {
  adminCenterId: string;
}

function signAdminToken(centerId: string): string {
  return jwt.sign({ centerId, role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

function signSuperAdminToken(): string {
  return jwt.sign({ role: "superadmin" }, JWT_SECRET, { expiresIn: "12h" });
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as AdminJwt;
    if (payload.role !== "admin") throw new Error("not admin");
    (req as AdminRequest).adminCenterId = payload.centerId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as SuperAdminJwt;
    if (payload.role !== "superadmin") throw new Error("not superadmin");
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired super admin token" });
  }
}

const AUTO_CHECKOUT_MINUTES = 180;

// Shared helper: book consumption for all selections and mark check-in as checked out
async function bookAndCheckout(checkinId: number, memberId: number, centerId: string): Promise<void> {
  // Fetch all selections (mandatory + optional) for this visit
  const { rows: selections } = await pool.query(
    `SELECT vms.menu_item_id, mi.name
     FROM visit_menu_selections vms
     JOIN menu_items mi ON mi.id = vms.menu_item_id
     WHERE vms.checkin_id = $1`,
    [checkinId]
  );
  // Book each selection as a consumption log entry + deduct from ingredient batches
  for (const sel of selections) {
    await pool.query(
      `INSERT INTO consumption_logs (member_id, meal_slot, food_item, menu_item_id, logged_at)
       VALUES ($1, 'center_visit', $2, $3, NOW())`,
      [memberId, sel.name as string, sel.menu_item_id as number]
    );
    // Deduct BOM quantities from the open ingredient batch (oldest open batch first)
    const { rows: bom } = await pool.query(
      `SELECT mb.ingredient_id, mb.quantity FROM menu_item_bom mb
       WHERE mb.menu_item_id = $1 AND mb.ingredient_id IS NOT NULL`,
      [sel.menu_item_id as number]
    );
    for (const b of bom) {
      const { rows: batches } = await pool.query(
        `SELECT id FROM ingredient_batches
         WHERE ingredient_id = $1 AND center_id = $2 AND status = 'open'
         ORDER BY opened_at ASC LIMIT 1`,
        [b.ingredient_id as number, centerId]
      );
      if (batches[0]) {
        await pool.query(
          `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
           VALUES ($1, $2, 'auto: member visit', NOW())`,
          [(batches[0] as { id: number }).id, b.quantity as number]
        );
      }
    }
  }
  // Mark check-in as checked out
  await pool.query(
    `UPDATE member_check_ins SET checked_out_at = NOW() WHERE id = $1 AND checked_out_at IS NULL`,
    [checkinId]
  );
}

// Auto-checkout sessions older than AUTO_CHECKOUT_MINUTES at a given center
async function autoCheckoutExpired(centerId: string): Promise<void> {
  const { rows: expired } = await pool.query(
    `SELECT id, member_id FROM member_check_ins
     WHERE center_id = $1 AND checked_out_at IS NULL
       AND NOW() - checked_in_at > ($2 || ' minutes')::INTERVAL`,
    [centerId, AUTO_CHECKOUT_MINUTES]
  );
  for (const ci of expired) {
    await bookAndCheckout(ci.id as number, ci.member_id as number, centerId);
  }
}

// POST /api/admin/login
router.post("/admin/login", async (req, res) => {
  const { center_id, password } = req.body as { center_id?: string; password?: string };
  if (!center_id || !password) {
    res.status(400).json({ error: "center_id and password are required" });
    return;
  }
  const { rows } = await pool.query(
    `SELECT ca.password_hash, c.name, c.is_active
     FROM center_auth ca JOIN centers c ON c.id = ca.center_id WHERE ca.center_id = $1`,
    [center_id]
  );
  if (!rows[0]) { res.status(401).json({ error: "Invalid center or password" }); return; }
  if (!rows[0].is_active) { res.status(403).json({ error: "This center has been deactivated. Contact the super admin." }); return; }
  const ok = await bcrypt.compare(password, rows[0].password_hash as string);
  if (!ok) { res.status(401).json({ error: "Invalid center or password" }); return; }
  const token = signAdminToken(center_id);
  res.json({ token, center_id, center_name: rows[0].name });
});

// POST /api/admin/super/login
router.post("/admin/super/login", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) { res.status(400).json({ error: "password is required" }); return; }
  const { rows } = await pool.query("SELECT password_hash FROM super_admin_auth WHERE id = 'superadmin'");
  if (!rows[0]) { res.status(401).json({ error: "Invalid password" }); return; }
  const ok = await bcrypt.compare(password, rows[0].password_hash as string);
  if (!ok) { res.status(401).json({ error: "Invalid password" }); return; }
  res.json({ token: signSuperAdminToken() });
});

// GET /api/admin/super/centers — all centers with active status (super admin only)
router.get("/admin/super/centers", requireSuperAdmin, async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name, is_active FROM centers ORDER BY name");
  res.json(rows);
});

// PATCH /api/admin/super/centers/:centerId/activate
router.patch("/admin/super/centers/:centerId/activate", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { rows } = await pool.query(
    "UPDATE centers SET is_active = TRUE WHERE id = $1 RETURNING id, name, is_active",
    [centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json(rows[0]);
});

// PATCH /api/admin/super/centers/:centerId/deactivate
router.patch("/admin/super/centers/:centerId/deactivate", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { rows } = await pool.query(
    "UPDATE centers SET is_active = FALSE WHERE id = $1 RETURNING id, name, is_active",
    [centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json(rows[0]);
});

// POST /api/admin/me/password — change password for the authenticated center
router.post("/admin/me/password", requireAdmin, async (req, res) => {
  const { current_password, new_password } = req.body as { current_password?: string; new_password?: string };
  if (!current_password || !new_password) {
    res.status(400).json({ error: "current_password and new_password are required" });
    return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const centerId = (req as AdminRequest).adminCenterId;
  const { rows } = await pool.query(
    "SELECT password_hash FROM center_auth WHERE center_id = $1",
    [centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  const ok = await bcrypt.compare(current_password, rows[0].password_hash as string);
  if (!ok) { res.status(401).json({ error: "Current password is incorrect" }); return; }
  const newHash = await bcrypt.hash(new_password, 10);
  await pool.query("UPDATE center_auth SET password_hash = $1 WHERE center_id = $2", [newHash, centerId]);
  res.status(204).end();
});

// GET /api/admin/centers — list active centers only (public, needed on login page)
router.get("/admin/centers", async (_req, res) => {
  const { rows } = await pool.query("SELECT id, name FROM centers WHERE is_active = TRUE ORDER BY name");
  res.json(rows);
});

// GET /api/admin/centers/:centerId/dashboard
router.get("/admin/centers/:centerId/dashboard", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Date().toISOString().slice(0, 10);

  const [memberRes, menuRes, consumptionRes] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM member_center_mapping WHERE center_id = $1", [centerId]),
    pool.query("SELECT COUNT(*) as count FROM menu_items WHERE center_id = $1", [centerId]),
    pool.query(
      `SELECT COALESCE(SUM(cl.calories_kcal), 0) as total_calories, COUNT(DISTINCT cl.member_id) as active_members
       FROM consumption_logs cl
       JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
       WHERE mcm.center_id = $1 AND DATE(cl.logged_at) = $2`,
      [centerId, today]
    ),
  ]);

  res.json({
    member_count: Number(memberRes.rows[0].count),
    menu_item_count: Number(menuRes.rows[0].count),
    today_calories: Number(consumptionRes.rows[0].total_calories),
    today_active_members: Number(consumptionRes.rows[0].active_members),
  });
});

// GET /api/admin/centers/:centerId/menu-items
router.get("/admin/centers/:centerId/menu-items", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: items } = await pool.query(
    `SELECT mi.id, mi.center_id, mi.name, mi.description, mi.is_mandatory, mi.created_at,
       NOT EXISTS (
         SELECT 1 FROM menu_item_bom mb
         WHERE mb.menu_item_id = mi.id AND mb.ingredient_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM ingredient_batches ib
             WHERE ib.ingredient_id = mb.ingredient_id AND ib.center_id = $1 AND ib.status = 'open'
           )
       ) AS is_available
     FROM menu_items mi
     WHERE mi.center_id = $1
     ORDER BY mi.is_mandatory DESC, mi.name`,
    [centerId]
  );
  // Attach BOM for each item
  const result = await Promise.all(items.map(async (item) => {
    const { rows: bom } = await pool.query(
      "SELECT id, ingredient, ingredient_id, quantity, unit, kcal FROM menu_item_bom WHERE menu_item_id = $1 ORDER BY id",
      [item.id]
    );
    return { ...item, bom };
  }));
  res.json(result);
});

// POST /api/admin/centers/:centerId/menu-items
router.post("/admin/centers/:centerId/menu-items", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO menu_items (center_id, name, description) VALUES ($1,$2,$3) RETURNING *",
    [centerId, name.trim(), description?.trim() ?? null]
  );
  res.status(201).json({ ...rows[0], bom: [] });
});

// PUT /api/admin/menu-items/:itemId
router.put("/admin/menu-items/:itemId", requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query("SELECT center_id FROM menu_items WHERE id = $1", [itemId]);
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, description } = req.body as { name?: string; description?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "UPDATE menu_items SET name=$1, description=$2 WHERE id=$3 RETURNING *",
    [name.trim(), description?.trim() ?? null, itemId]
  );
  res.json(rows[0]);
});

// DELETE /api/admin/menu-items/:itemId
router.delete("/admin/menu-items/:itemId", requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query("SELECT center_id FROM menu_items WHERE id = $1", [itemId]);
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  // Null out FK references in consumption_logs before deleting to avoid constraint violation
  await pool.query("UPDATE consumption_logs SET menu_item_id = NULL WHERE menu_item_id = $1", [itemId]);
  await pool.query("DELETE FROM menu_items WHERE id = $1", [itemId]);
  res.status(204).send();
});

// PATCH /api/admin/menu-items/:itemId/toggle-mandatory
router.patch("/admin/menu-items/:itemId/toggle-mandatory", requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const adminReq = req as AdminRequest;
  const { rows: existing } = await pool.query("SELECT center_id, is_mandatory FROM menu_items WHERE id = $1", [itemId]);
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "UPDATE menu_items SET is_mandatory = NOT is_mandatory WHERE id = $1 RETURNING *",
    [itemId]
  );
  res.json(rows[0]);
});

// GET /api/admin/menu-items/:itemId/bom
router.get("/admin/menu-items/:itemId/bom", requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const adminReq = req as AdminRequest;

  // Verify item belongs to the authenticated center (IDOR guard)
  const { rows: item } = await pool.query(
    "SELECT center_id FROM menu_items WHERE id = $1", [itemId]
  );
  if (!item[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (item[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    "SELECT id, ingredient, ingredient_id, quantity, unit, kcal FROM menu_item_bom WHERE menu_item_id = $1 ORDER BY id",
    [itemId]
  );
  res.json(rows);
});

// POST /api/admin/menu-items/:itemId/bom
router.post("/admin/menu-items/:itemId/bom", requireAdmin, async (req, res) => {
  const { itemId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: item } = await pool.query("SELECT center_id FROM menu_items WHERE id = $1", [itemId]);
  if (!item[0]) { res.status(404).json({ error: "Menu item not found" }); return; }
  if (item[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { ingredient_id, ingredient, quantity, unit, kcal } = req.body as {
    ingredient_id?: number | null; ingredient?: string; quantity?: number; unit?: string; kcal?: number | null;
  };

  let resolvedName = ingredient?.trim() ?? "";
  if (ingredient_id) {
    const { rows: ing } = await pool.query("SELECT name FROM ingredients WHERE id=$1", [ingredient_id]);
    if (!ing[0]) { res.status(400).json({ error: "Ingredient not found in master" }); return; }
    resolvedName = ing[0].name as string;
  }
  if (!resolvedName) { res.status(400).json({ error: "ingredient or ingredient_id is required" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO menu_item_bom (menu_item_id, ingredient, ingredient_id, quantity, unit, kcal) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [itemId, resolvedName, ingredient_id ?? null, quantity ?? 0, unit?.trim() ?? "g", kcal ?? null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/menu-items/:itemId/bom/:bomId
router.put("/admin/menu-items/:itemId/bom/:bomId", requireAdmin, async (req, res) => {
  const { itemId, bomId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query(
    `SELECT mb.id, mi.center_id FROM menu_item_bom mb
     JOIN menu_items mi ON mi.id = mb.menu_item_id
     WHERE mb.id = $1 AND mb.menu_item_id = $2`,
    [bomId, itemId]
  );
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { ingredient_id, ingredient, quantity, unit, kcal } = req.body as {
    ingredient_id?: number | null; ingredient?: string; quantity?: number; unit?: string; kcal?: number | null;
  };

  let resolvedName = ingredient?.trim() ?? "";
  if (ingredient_id) {
    const { rows: ing } = await pool.query("SELECT name FROM ingredients WHERE id=$1", [ingredient_id]);
    if (!ing[0]) { res.status(400).json({ error: "Ingredient not found in master" }); return; }
    resolvedName = ing[0].name as string;
  }
  if (!resolvedName) { res.status(400).json({ error: "ingredient or ingredient_id is required" }); return; }

  const { rows } = await pool.query(
    "UPDATE menu_item_bom SET ingredient=$1, ingredient_id=$2, quantity=$3, unit=$4, kcal=$5 WHERE id=$6 RETURNING *",
    [resolvedName, ingredient_id ?? null, quantity ?? 0, unit?.trim() ?? "g", kcal ?? null, bomId]
  );
  res.json(rows[0]);
});

// DELETE /api/admin/menu-items/:itemId/bom/:bomId
router.delete("/admin/menu-items/:itemId/bom/:bomId", requireAdmin, async (req, res) => {
  const { itemId, bomId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query(
    `SELECT mb.id, mi.center_id FROM menu_item_bom mb
     JOIN menu_items mi ON mi.id = mb.menu_item_id
     WHERE mb.id = $1 AND mb.menu_item_id = $2`,
    [bomId, itemId]
  );
  if (!existing[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  await pool.query("DELETE FROM menu_item_bom WHERE id = $1", [bomId]);
  res.status(204).send();
});

// GET /api/admin/centers/:centerId/consumption?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/admin/centers/:centerId/consumption", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const from = typeof req.query.from === "string" ? req.query.from : today;
  const to   = typeof req.query.to   === "string" ? req.query.to   : today;

  // Resolve each log to a menu_item_id that belongs to THIS center:
  //   1. Prefer the stored FK only if the referenced menu_item belongs to centerId.
  //   2. Fall back to a case-insensitive name match within the center for legacy logs.
  // Both paths enforce center ownership — cross-center menu_item_id is silently ignored.
  const { rows: byComponent } = await pool.query(
    `WITH resolved AS (
       SELECT
         cl.id,
         cl.member_id,
         COALESCE(
           -- FK path: only trust it if the item actually belongs to this center
           (SELECT mi.id FROM menu_items mi
            WHERE mi.id = cl.menu_item_id AND mi.center_id = $1
            LIMIT 1),
           -- Name-fallback for legacy logs
           (SELECT mi2.id FROM menu_items mi2
            WHERE mi2.center_id = $1
              AND LOWER(mi2.name) = LOWER(cl.food_item)
            LIMIT 1)
         ) AS menu_item_id
       FROM consumption_logs cl
       JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
       WHERE mcm.center_id = $1
         AND DATE(cl.logged_at) BETWEEN $2 AND $3
     )
     SELECT
       mb.ingredient,
       mb.unit,
       SUM(mb.quantity)         AS total_quantity,
       COUNT(DISTINCT r.member_id) AS member_count,
       COUNT(DISTINCT r.id)     AS log_count
     FROM resolved r
     JOIN menu_item_bom mb ON mb.menu_item_id = r.menu_item_id
     WHERE r.menu_item_id IS NOT NULL
     GROUP BY mb.ingredient, mb.unit
     ORDER BY total_quantity DESC`,
    [centerId, from, to]
  );

  // Logs breakdown: only entries that resolved to a THIS-center menu item
  const { rows: logs } = await pool.query(
    `SELECT cl.id, cl.member_id, m.name AS member_name, cl.logged_at, cl.meal_slot,
            cl.food_item, cl.quantity_g, cl.calories_kcal,
            COALESCE(
              (SELECT mi.id FROM menu_items mi
               WHERE mi.id = cl.menu_item_id AND mi.center_id = $1 LIMIT 1),
              (SELECT mi2.id FROM menu_items mi2
               WHERE mi2.center_id = $1
                 AND LOWER(mi2.name) = LOWER(cl.food_item)
               LIMIT 1)
            ) AS resolved_menu_item_id
     FROM consumption_logs cl
     JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
     JOIN members m ON m.id = cl.member_id
     WHERE mcm.center_id = $1
       AND DATE(cl.logged_at) BETWEEN $2 AND $3
       AND (
         EXISTS (SELECT 1 FROM menu_items mi WHERE mi.id = cl.menu_item_id AND mi.center_id = $1)
         OR EXISTS (
           SELECT 1 FROM menu_items mi3
           WHERE mi3.center_id = $1
             AND LOWER(mi3.name) = LOWER(cl.food_item)
         )
       )
     ORDER BY cl.logged_at DESC`,
    [centerId, from, to]
  );

  res.json({ from, to, by_component: byComponent, logs });
});

// ---------------------------------------------------------------------------
// Member management (per-center)
// ---------------------------------------------------------------------------

// GET /api/admin/members/lookup?mobile=...&email=...&membership_no=...
router.get("/admin/members/lookup", requireAdmin, async (req, res) => {
  const { mobile, email, membership_no } = req.query as { mobile?: string; email?: string; membership_no?: string };
  if (!mobile && !email && !membership_no) { res.status(400).json({ error: "mobile, email or membership_no is required" }); return; }

  const cols = "id, name, mobile, email, membership_no, height_cm, date_of_joining";
  let row: Record<string, unknown> | undefined;
  if (mobile) {
    const { rows } = await pool.query(`SELECT ${cols} FROM members WHERE mobile = $1 LIMIT 1`, [mobile.trim()]);
    row = rows[0];
  }
  if (!row && email) {
    const { rows } = await pool.query(`SELECT ${cols} FROM members WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email.trim()]);
    row = rows[0];
  }
  if (!row && membership_no) {
    const { rows } = await pool.query(`SELECT ${cols} FROM members WHERE membership_no = $1 LIMIT 1`, [membership_no.trim()]);
    row = rows[0];
  }
  res.json(row ?? null);
});

// POST /api/admin/centers/:centerId/members/link — link an existing member to this center
router.post("/admin/centers/:centerId/members/link", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { member_id } = req.body as { member_id?: number };
  if (!member_id) { res.status(400).json({ error: "member_id is required" }); return; }

  const { rows: member } = await pool.query("SELECT id, name FROM members WHERE id = $1", [member_id]);
  if (!member[0]) { res.status(404).json({ error: "Member not found" }); return; }

  await pool.query(
    `INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [member_id, centerId]
  );
  res.status(201).json(member[0]);
});

// GET /api/admin/centers/:centerId/checkin-logs?from=YYYY-MM-DD&to=YYYY-MM-DD (default: today)
router.get("/admin/centers/:centerId/checkin-logs", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const from = (req.query.from as string | undefined) ?? today;
  const to   = (req.query.to   as string | undefined) ?? today;
  const { rows } = await pool.query(
    `SELECT ci.id,
            ci.member_id,
            m.name         AS member_name,
            m.mobile       AS member_mobile,
            ci.checked_in_at,
            ci.checked_out_at,
            EXTRACT(EPOCH FROM (COALESCE(ci.checked_out_at, NOW()) - ci.checked_in_at)) / 60 AS duration_min
     FROM member_check_ins ci
     JOIN members m ON m.id = ci.member_id
     WHERE ci.center_id = $1
       AND DATE(ci.checked_in_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
     ORDER BY ci.checked_in_at DESC`,
    [centerId, from, to]
  );
  res.json(rows);
});

// GET /api/admin/centers/:centerId/members
router.get("/admin/centers/:centerId/members", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  // Auto-checkout any sessions that have exceeded the time limit
  await autoCheckoutExpired(centerId);

  const { rows } = await pool.query(
    `SELECT
       m.id, m.name, m.date_of_joining, m.height_cm, m.mobile, m.email, m.membership_no,
       ci.id          AS checkin_id,
       ci.checked_in_at,
       ci.checked_out_at,
       EXISTS (
         SELECT 1 FROM consumption_logs cl
         WHERE cl.member_id = m.id
           AND cl.meal_slot = 'center_visit'
           AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
       ) AS already_consumed_today
     FROM members m
     JOIN member_center_mapping mcm ON mcm.member_id = m.id
     LEFT JOIN member_check_ins ci
       ON ci.member_id = m.id AND ci.center_id = $1 AND ci.checked_out_at IS NULL
     WHERE mcm.center_id = $1
     ORDER BY m.name`,
    [centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/members — create & onboard new member
router.post("/admin/centers/:centerId/members", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, height_cm, date_of_joining, mobile, email, membership_no } = req.body as {
    name?: string; height_cm?: number | null; date_of_joining?: string | null;
    mobile?: string | null; email?: string | null; membership_no?: string | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!mobile?.trim() && !email?.trim()) { res.status(400).json({ error: "mobile or email is required" }); return; }

  const { rows: memberRows } = await pool.query(
    `INSERT INTO members (name, height_cm, date_of_joining, mobile, email, membership_no)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name.trim(), height_cm ?? null, date_of_joining ?? null, mobile?.trim() || null, email?.trim() || null, membership_no?.trim() || null]
  );
  const member = memberRows[0];
  await pool.query(
    `INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [member.id, centerId]
  );
  res.status(201).json(member);
});

// DELETE /api/admin/centers/:centerId/members/:memberId — unlink member from center
router.delete("/admin/centers/:centerId/members/:memberId", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  await pool.query(
    `DELETE FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  res.status(204).send();
});

// POST /api/admin/centers/:centerId/members/:memberId/checkin
router.post("/admin/centers/:centerId/members/:memberId/checkin", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { rows: existing } = await pool.query(
    `SELECT id FROM member_check_ins WHERE member_id = $1 AND checked_out_at IS NULL`,
    [Number(memberId)]
  );
  if (existing[0]) { res.status(409).json({ error: "Member is already checked in" }); return; }

  const { weight_kg } = req.body as { weight_kg?: number };

  const { rows } = await pool.query(
    `INSERT INTO member_check_ins (member_id, center_id) VALUES ($1,$2) RETURNING *`,
    [Number(memberId), centerId]
  );
  const checkin = rows[0] as { id: number };

  // Save weight to health_records if provided
  if (weight_kg !== undefined && weight_kg > 0) {
    await pool.query(
      `INSERT INTO health_records (member_id, center_id, weight_kg, recorded_at) VALUES ($1,$2,$3,NOW())`,
      [Number(memberId), centerId, weight_kg]
    );
  }

  // Check if the member already had a center_visit consumption booked today
  const { rows: todayLogs } = await pool.query(
    `SELECT 1 FROM consumption_logs
     WHERE member_id = $1
       AND meal_slot = 'center_visit'
       AND DATE(logged_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
     LIMIT 1`,
    [Number(memberId)]
  );
  const alreadyConsumedToday = !!todayLogs[0];

  // Only auto-add mandatory items on the member's first visit of the day,
  // and only if ALL tracked BOM ingredients have an open batch at this center.
  if (!alreadyConsumedToday) {
    const { rows: mandatory } = await pool.query(
      `SELECT mi.id FROM menu_items mi
       WHERE mi.center_id = $1 AND mi.is_mandatory = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM menu_item_bom mb
           WHERE mb.menu_item_id = mi.id AND mb.ingredient_id IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM ingredient_batches ib
               WHERE ib.ingredient_id = mb.ingredient_id
                 AND ib.center_id = $1 AND ib.status = 'open'
             )
         )`,
      [centerId]
    );
    for (const mi of mandatory) {
      await pool.query(
        `INSERT INTO visit_menu_selections (checkin_id, menu_item_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [checkin.id, mi.id as number]
      );
    }
  }

  res.status(201).json({ ...checkin, already_consumed_today: alreadyConsumedToday });
});

// POST /api/admin/centers/:centerId/members/:memberId/checkout
router.post("/admin/centers/:centerId/members/:memberId/checkout", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    `SELECT id FROM member_check_ins
     WHERE member_id = $1 AND center_id = $2 AND checked_out_at IS NULL`,
    [Number(memberId), centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "No active check-in found" }); return; }
  const checkinId = (rows[0] as { id: number }).id;
  await bookAndCheckout(checkinId, Number(memberId), centerId);
  res.json({ checked_out: true, checkin_id: checkinId });
});

// ── Health Records ───────────────────────────────────────────────────────────

// GET /api/admin/centers/:centerId/members/:memberId/health-records
router.get("/admin/centers/:centerId/members/:memberId/health-records", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    `SELECT id, member_id, center_id, recorded_at,
            weight_kg, bmi, body_fat_pct, visceral_fat,
            bmr, metabolic_age, muscle_mass_kg, resting_hr, notes
     FROM health_records
     WHERE member_id = $1 AND center_id = $2
     ORDER BY recorded_at DESC`,
    [Number(memberId), centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/members/:memberId/health-records
router.post("/admin/centers/:centerId/members/:memberId/health-records", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const {
    recorded_at, weight_kg, bmi, body_fat_pct, visceral_fat,
    bmr, metabolic_age, muscle_mass_kg, resting_hr, notes,
  } = req.body as {
    recorded_at?: string; weight_kg?: number; bmi?: number; body_fat_pct?: number;
    visceral_fat?: number; bmr?: number; metabolic_age?: number; muscle_mass_kg?: number;
    resting_hr?: number; notes?: string;
  };
  const { rows } = await pool.query(
    `INSERT INTO health_records
       (member_id, center_id, recorded_at, weight_kg, bmi, body_fat_pct, visceral_fat,
        bmr, metabolic_age, muscle_mass_kg, resting_hr, notes)
     VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      Number(memberId), centerId,
      recorded_at ? new Date(recorded_at).toISOString() : new Date().toISOString(),
      weight_kg ?? null, bmi ?? null, body_fat_pct ?? null, visceral_fat ?? null,
      bmr ?? null, metabolic_age ?? null, muscle_mass_kg ?? null, resting_hr ?? null,
      notes ?? null,
    ]
  );
  res.status(201).json(rows[0]);
});

// ── Ingredient Catalog ──────────────────────────────────────────────────────

// GET /api/admin/ingredients
router.get("/admin/ingredients", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, pack_size, pack_unit, created_at FROM ingredients ORDER BY name"
  );
  res.json(rows);
});

// POST /api/admin/ingredients
router.post("/admin/ingredients", requireAdmin, async (req, res) => {
  const { name, pack_size, pack_unit } = req.body as { name?: string; pack_size?: number; pack_unit?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "INSERT INTO ingredients (name, pack_size, pack_unit) VALUES ($1,$2,$3) RETURNING *",
    [name.trim(), pack_size ?? 1, pack_unit?.trim() ?? "g"]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/ingredients/:ingredientId
router.put("/admin/ingredients/:ingredientId", requireAdmin, async (req, res) => {
  const { ingredientId } = req.params;
  const { name, pack_size, pack_unit } = req.body as { name?: string; pack_size?: number; pack_unit?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "UPDATE ingredients SET name=$1, pack_size=$2, pack_unit=$3 WHERE id=$4 RETURNING *",
    [name.trim(), pack_size ?? 1, pack_unit?.trim() ?? "g", Number(ingredientId)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// DELETE /api/admin/ingredients/:ingredientId
router.delete("/admin/ingredients/:ingredientId", requireAdmin, async (req, res) => {
  const { ingredientId } = req.params;
  await pool.query("DELETE FROM ingredients WHERE id=$1", [Number(ingredientId)]);
  res.status(204).end();
});

// ── Ingredient Batches ──────────────────────────────────────────────────────

// GET /api/admin/centers/:centerId/ingredient-batches
router.get("/admin/centers/:centerId/ingredient-batches", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    `SELECT ib.id, ib.ingredient_id, i.name AS ingredient_name, i.pack_size, i.pack_unit,
            ib.center_id, ib.batch_number, ib.status, ib.opened_at, ib.consumed_at, ib.created_at,
            COALESCE((
              SELECT SUM(bcl.quantity)
              FROM batch_consumption_logs bcl
              WHERE bcl.batch_id = ib.id
            ), 0) AS consumed_qty
     FROM ingredient_batches ib
     JOIN ingredients i ON i.id = ib.ingredient_id
     WHERE ib.center_id = $1
     ORDER BY i.name, ib.status DESC, ib.created_at DESC`,
    [centerId]
  );
  res.json(rows);
});

// GET /api/admin/centers/:centerId/ingredient-requirements — BOM qty per ingredient at this center
router.get("/admin/centers/:centerId/ingredient-requirements", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    `SELECT mb.ingredient_id, i.name AS ingredient_name, i.pack_unit,
            COALESCE(SUM(mb.quantity), 0) AS min_serving_qty
     FROM menu_item_bom mb
     JOIN ingredients i ON i.id = mb.ingredient_id
     JOIN menu_items mi ON mi.id = mb.menu_item_id
     WHERE mi.center_id = $1 AND mb.ingredient_id IS NOT NULL
     GROUP BY mb.ingredient_id, i.name, i.pack_unit
     ORDER BY i.name`,
    [centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/ingredient-batches  — add new batch
router.post("/admin/centers/:centerId/ingredient-batches", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { ingredient_id, batch_number } = req.body as { ingredient_id?: number; batch_number?: string };
  if (!ingredient_id) { res.status(400).json({ error: "ingredient_id is required" }); return; }
  if (!batch_number?.trim()) { res.status(400).json({ error: "batch_number is required" }); return; }

  const { rows } = await pool.query(
    `INSERT INTO ingredient_batches (ingredient_id, center_id, batch_number, status)
     VALUES ($1, $2, $3, 'new') RETURNING *`,
    [ingredient_id, centerId, batch_number.trim()]
  );
  res.status(201).json(rows[0]);
});

// PATCH /api/admin/ingredient-batches/:batchId/open  — new → open
router.patch("/admin/ingredient-batches/:batchId/open", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query(
    "SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]
  );
  if (!existing[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing[0].status !== "new") { res.status(409).json({ error: "Only a 'new' batch can be opened" }); return; }

  // Enforce: no other open batch for this ingredient at this center
  const { rows: openCheck } = await pool.query(
    "SELECT id FROM ingredient_batches WHERE ingredient_id=$1 AND center_id=$2 AND status='open'",
    [existing[0].ingredient_id, existing[0].center_id]
  );
  if (openCheck.length > 0) {
    res.status(409).json({ error: "There is already an open batch for this ingredient. Mark it as consumed first." });
    return;
  }

  const { rows } = await pool.query(
    "UPDATE ingredient_batches SET status='open', opened_at=NOW() WHERE id=$1 RETURNING *",
    [Number(batchId)]
  );
  res.json(rows[0]);
});

// PATCH /api/admin/ingredient-batches/:batchId/consume  — open → consumed
router.patch("/admin/ingredient-batches/:batchId/consume", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query(
    "SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]
  );
  if (!existing[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing[0].status !== "open") { res.status(409).json({ error: "Only an 'open' batch can be marked as consumed" }); return; }

  const { rows } = await pool.query(
    "UPDATE ingredient_batches SET status='consumed', consumed_at=NOW() WHERE id=$1 RETURNING *",
    [Number(batchId)]
  );
  res.json(rows[0]);
});

// DELETE /api/admin/ingredient-batches/:batchId  — only 'new' batches
router.delete("/admin/ingredient-batches/:batchId", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: existing } = await pool.query(
    "SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]
  );
  if (!existing[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (existing[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (existing[0].status !== "new") { res.status(409).json({ error: "Only 'new' batches can be deleted" }); return; }

  await pool.query("DELETE FROM ingredient_batches WHERE id=$1", [Number(batchId)]);
  res.status(204).end();
});

// ── Batch Consumption Logs ──────────────────────────────────────────────────

// GET /api/admin/ingredient-batches/:batchId/consumption-logs
router.get("/admin/ingredient-batches/:batchId/consumption-logs", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: batch } = await pool.query("SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]);
  if (!batch[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (batch[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    "SELECT id, batch_id, quantity, notes, recorded_at FROM batch_consumption_logs WHERE batch_id=$1 ORDER BY recorded_at DESC",
    [Number(batchId)]
  );
  res.json(rows);
});

// POST /api/admin/ingredient-batches/:batchId/consumption-logs
router.post("/admin/ingredient-batches/:batchId/consumption-logs", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: batch } = await pool.query("SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]);
  if (!batch[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (batch[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (batch[0].status !== "open") { res.status(409).json({ error: "Consumption can only be recorded for an open batch" }); return; }

  const { quantity, notes } = req.body as { quantity?: number; notes?: string };
  if (!quantity || quantity <= 0) { res.status(400).json({ error: "quantity must be a positive number" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO batch_consumption_logs (batch_id, quantity, notes) VALUES ($1,$2,$3) RETURNING *",
    [Number(batchId), quantity, notes?.trim() ?? null]
  );
  res.status(201).json(rows[0]);
});

// DELETE /api/admin/consumption-logs/:logId
router.delete("/admin/consumption-logs/:logId", requireAdmin, async (req, res) => {
  const { logId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows } = await pool.query(
    `SELECT bcl.*, ib.center_id FROM batch_consumption_logs bcl
     JOIN ingredient_batches ib ON ib.id = bcl.batch_id
     WHERE bcl.id=$1`,
    [Number(logId)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (rows[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  await pool.query("DELETE FROM batch_consumption_logs WHERE id=$1", [Number(logId)]);
  res.status(204).end();
});

// ── Visit Menu Selections ────────────────────────────────────────────────────

// GET /api/admin/checkins/:checkinId/menu-selections
router.get("/admin/checkins/:checkinId/menu-selections", requireAdmin, async (req, res) => {
  const { checkinId } = req.params;
  const adminReq = req as AdminRequest;
  // Verify the checkin belongs to the admin's center
  const { rows: ci } = await pool.query(
    `SELECT ci.center_id FROM member_check_ins ci WHERE ci.id = $1`,
    [Number(checkinId)]
  );
  if (!ci[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  if ((ci[0] as { center_id: string }).center_id !== adminReq.adminCenterId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const { rows } = await pool.query(
    `SELECT vms.id, vms.checkin_id, vms.menu_item_id, mi.name AS menu_item_name,
            mi.is_mandatory, vms.created_at
     FROM visit_menu_selections vms
     JOIN menu_items mi ON mi.id = vms.menu_item_id
     WHERE vms.checkin_id = $1
     ORDER BY mi.is_mandatory DESC, mi.name`,
    [Number(checkinId)]
  );
  res.json(rows);
});

// POST /api/admin/checkins/:checkinId/menu-selections
router.post("/admin/checkins/:checkinId/menu-selections", requireAdmin, async (req, res) => {
  const { checkinId } = req.params;
  const adminReq = req as AdminRequest;
  const { menu_item_id } = req.body as { menu_item_id?: number };
  if (!menu_item_id) { res.status(400).json({ error: "menu_item_id is required" }); return; }

  // Verify checkin belongs to admin's center
  const { rows: ci } = await pool.query(
    `SELECT ci.center_id, ci.checked_out_at FROM member_check_ins ci WHERE ci.id = $1`,
    [Number(checkinId)]
  );
  if (!ci[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  const ciRow = ci[0] as { center_id: string; checked_out_at: string | null };
  if (ciRow.center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (ciRow.checked_out_at) { res.status(409).json({ error: "Session already checked out" }); return; }

  // Verify the menu item belongs to the same center
  const { rows: mi } = await pool.query(
    `SELECT id, name, is_mandatory FROM menu_items WHERE id = $1 AND center_id = $2`,
    [menu_item_id, adminReq.adminCenterId]
  );
  if (!mi[0]) { res.status(404).json({ error: "Menu item not found in this center" }); return; }

  const { rows } = await pool.query(
    `INSERT INTO visit_menu_selections (checkin_id, menu_item_id)
     VALUES ($1, $2)
     ON CONFLICT (checkin_id, menu_item_id) DO NOTHING
     RETURNING id, checkin_id, menu_item_id, created_at`,
    [Number(checkinId), menu_item_id]
  );
  const miRow = mi[0] as { id: number; name: string; is_mandatory: boolean };
  const result = rows[0]
    ? { ...rows[0], menu_item_name: miRow.name, is_mandatory: miRow.is_mandatory }
    : null;
  res.status(201).json(result);
});

// DELETE /api/admin/checkin-selections/:selectionId
router.delete("/admin/checkin-selections/:selectionId", requireAdmin, async (req, res) => {
  const { selectionId } = req.params;
  const adminReq = req as AdminRequest;
  // Verify the selection belongs to the admin's center
  const { rows } = await pool.query(
    `SELECT vms.id, mi.is_mandatory, ci.center_id
     FROM visit_menu_selections vms
     JOIN menu_items mi ON mi.id = vms.menu_item_id
     JOIN member_check_ins ci ON ci.id = vms.checkin_id
     WHERE vms.id = $1`,
    [Number(selectionId)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  const row = rows[0] as { center_id: string; is_mandatory: boolean };
  if (row.center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (row.is_mandatory) { res.status(400).json({ error: "Cannot remove a mandatory item" }); return; }
  await pool.query("DELETE FROM visit_menu_selections WHERE id = $1", [Number(selectionId)]);
  res.status(204).end();
});

export default router;
