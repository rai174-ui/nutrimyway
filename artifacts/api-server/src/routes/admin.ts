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

// POST /api/admin/centers/:centerId/change-password
router.post("/admin/centers/:centerId/change-password", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { current_password, new_password } = req.body as { current_password?: string; new_password?: string };
  if (!current_password || !new_password) {
    res.status(400).json({ error: "current_password and new_password are required" }); return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" }); return;
  }
  const { rows } = await pool.query("SELECT password_hash FROM center_auth WHERE center_id = $1", [centerId]);
  if (!rows[0]) { res.status(404).json({ error: "Center auth not found" }); return; }
  const ok = await bcrypt.compare(current_password, rows[0].password_hash as string);
  if (!ok) { res.status(401).json({ error: "Current password is incorrect" }); return; }
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query("UPDATE center_auth SET password_hash = $1 WHERE center_id = $2", [hash, centerId]);
  res.json({ success: true });
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
    "SELECT id, center_id, name, description, created_at FROM menu_items WHERE center_id = $1 ORDER BY created_at",
    [centerId]
  );
  // Attach BOM for each item
  const result = await Promise.all(items.map(async (item) => {
    const { rows: bom } = await pool.query(
      "SELECT id, ingredient, quantity, unit FROM menu_item_bom WHERE menu_item_id = $1 ORDER BY id",
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

  await pool.query("DELETE FROM menu_items WHERE id = $1", [itemId]);
  res.status(204).send();
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
    "SELECT id, ingredient, quantity, unit FROM menu_item_bom WHERE menu_item_id = $1 ORDER BY id",
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

  const { ingredient, quantity, unit } = req.body as { ingredient?: string; quantity?: number; unit?: string };
  if (!ingredient?.trim()) { res.status(400).json({ error: "ingredient is required" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO menu_item_bom (menu_item_id, ingredient, quantity, unit) VALUES ($1,$2,$3,$4) RETURNING *",
    [itemId, ingredient.trim(), quantity ?? 0, unit?.trim() ?? "g"]
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

  const { ingredient, quantity, unit } = req.body as { ingredient?: string; quantity?: number; unit?: string };
  if (!ingredient?.trim()) { res.status(400).json({ error: "ingredient is required" }); return; }

  const { rows } = await pool.query(
    "UPDATE menu_item_bom SET ingredient=$1, quantity=$2, unit=$3 WHERE id=$4 RETURNING *",
    [ingredient.trim(), quantity ?? 0, unit?.trim() ?? "g", bomId]
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

export default router;
