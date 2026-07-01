import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { pool } from "../lib/sqlite";
import { logger } from "../lib/logger";

const SUPER_ADMIN_EMAIL = process.env["SUPER_ADMIN_EMAIL"] ?? "rai.174@gmail.com";
const APP_URL = process.env["APP_URL"] ?? "http://localhost:8080";

async function sendSuperAdminResetEmail(resetUrl: string): Promise<void> {
  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  if (!host || !user || !pass) {
    logger.warn({ resetUrl }, "SMTP not configured — reset URL logged (copy it to use)");
    return;
  }
  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465, auth: { user, pass },
  });
  await transporter.sendMail({
    from: `"NutriMyWay Admin" <${user}>`,
    to: SUPER_ADMIN_EMAIL,
    subject: "Super Admin Password Reset",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#0d9488">Password Reset</h2>
      <p>Click the button below to reset your Super Admin password. Link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">If you did not request this, ignore this email.</p>
    </div>`,
  });
}

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

// Shared helper: book consumption for all selections and mark check-in as checked out
function slotForNowIST(): string {
  const h = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

async function bookAndCheckout(checkinId: number, memberId: number, centerId: string): Promise<void> {
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
    // If any tracked ingredient has no open batch, skip this item entirely.
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
    // Deduct BOM quantities from the open ingredient batch (oldest open batch first)
    const { rows: bom } = await pool.query(
      `SELECT mb.ingredient_id, mb.quantity FROM menu_item_bom mb
       WHERE mb.menu_item_id = $1 AND mb.ingredient_id IS NOT NULL`,
      [sel.menu_item_id as number]
    );
    for (const b of bom) {
      // Use received_qty if set, else fall back to ingredient's Item Master pack_size
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
        // Auto-close the batch if the running total has reached or exceeded the actual received qty
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
  // Process direct-order flavour selections (ingredients ordered by flavour at check-in)
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
    // Look up kcal_per_serving for this ingredient to log calories
    const { rows: kcalIngRows } = await pool.query(
      `SELECT kcal_per_serving FROM ingredients WHERE id = $1`,
      [fsel.ingredient_id as number]
    );
    const kcalPerServing = (kcalIngRows[0] as { kcal_per_serving: number | null } | undefined)?.kcal_per_serving ?? null;
    await pool.query(
      `INSERT INTO consumption_logs (member_id, meal_slot, food_item, quantity_g, calories_kcal, checkin_id, logged_at)
       VALUES ($1, $3, $2, $4, $5, $6, NOW())`,
      [memberId, foodLabel, slotForNowIST(), batchRow.serving_qty, kcalPerServing, checkinId]
    );
    // Deduct serving qty from the open batch
    await pool.query(
      `INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at)
       VALUES ($1, $2, 'auto: flavour visit', NOW())`,
      [batchRow.id, batchRow.serving_qty]
    );
    // Auto-close batch if fully consumed
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
  // Mark check-in as checked out
  await pool.query(
    `UPDATE member_check_ins SET checked_out_at = NOW() WHERE id = $1 AND checked_out_at IS NULL`,
    [checkinId]
  );
}

// Auto-checkout sessions older than the center's configured auto_checkout_min
async function autoCheckoutExpired(centerId: string): Promise<void> {
  const { rows: expired } = await pool.query(
    `SELECT mci.id, mci.member_id FROM member_check_ins mci
     JOIN centers c ON c.id = mci.center_id
     WHERE mci.center_id = $1 AND mci.checked_out_at IS NULL
       AND NOW() - mci.checked_in_at > (c.auto_checkout_min || ' minutes')::INTERVAL`,
    [centerId]
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
    `SELECT ca.password_hash, ca.valid_until, c.name, c.is_active
     FROM center_auth ca JOIN centers c ON c.id = ca.center_id WHERE ca.center_id = $1`,
    [center_id]
  );
  if (!rows[0]) { res.status(401).json({ error: "Invalid center or password" }); return; }
  if (!rows[0].is_active) { res.status(403).json({ error: "This center has been deactivated. Contact the super admin." }); return; }
  if (rows[0].valid_until && new Date(rows[0].valid_until as string) < new Date()) {
    res.status(403).json({ error: "This center's access has expired. Contact the super admin." }); return;
  }
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

// GET /api/admin/super/centers — all centers with active status and validity (super admin only)
router.get("/admin/super/centers", requireSuperAdmin, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.is_active, ca.valid_until
    FROM centers c
    LEFT JOIN center_auth ca ON ca.center_id = c.id
    ORDER BY c.name
  `);
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

// PATCH /api/admin/super/centers/:centerId/password — reset a center's password
router.patch("/admin/super/centers/:centerId/password", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { password } = req.body as { password?: string };
  if (!password || password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" }); return;
  }
  const hash = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query(
    "UPDATE center_auth SET password_hash = $1 WHERE center_id = $2",
    [hash, centerId]
  );
  if (!rowCount) { res.status(404).json({ error: "Center not found" }); return; }
  res.json({ ok: true });
});

// PATCH /api/admin/super/centers/:centerId/validity — set/clear access expiry date
router.patch("/admin/super/centers/:centerId/validity", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { valid_until } = req.body as { valid_until?: string | null };
  await pool.query(
    "UPDATE center_auth SET valid_until = $1 WHERE center_id = $2",
    [valid_until ?? null, centerId]
  );
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.is_active, ca.valid_until
     FROM centers c LEFT JOIN center_auth ca ON ca.center_id = c.id WHERE c.id = $1`,
    [centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json(rows[0]);
});

// POST /api/admin/super/forgot-password — generate reset token and email it
router.post("/admin/super/forgot-password", async (_req, res) => {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.query(
    "INSERT INTO super_admin_reset_tokens (token, expires_at) VALUES ($1, $2)",
    [token, expiresAt]
  );
  const resetUrl = `${APP_URL}/admin/super?token=${token}`;
  try {
    await sendSuperAdminResetEmail(resetUrl);
  } catch (err) {
    logger.error({ err }, "Failed to send super admin reset email");
  }
  res.json({ ok: true });
});

// POST /api/admin/super/reset-password — consume token and set new password
router.post("/admin/super/reset-password", async (req, res) => {
  const { token, new_password } = req.body as { token?: string; new_password?: string };
  if (!token || !new_password) {
    res.status(400).json({ error: "token and new_password are required" }); return;
  }
  if (new_password.length < 8) {
    res.status(400).json({ error: "new_password must be at least 8 characters" }); return;
  }
  const { rows } = await pool.query(
    "SELECT token, expires_at, used_at FROM super_admin_reset_tokens WHERE token = $1",
    [token]
  );
  if (!rows[0]) { res.status(400).json({ error: "Invalid or expired reset link" }); return; }
  if (rows[0].used_at) { res.status(400).json({ error: "This reset link has already been used" }); return; }
  if (new Date(rows[0].expires_at as string) < new Date()) {
    res.status(400).json({ error: "Reset link has expired — request a new one" }); return;
  }
  const hash = await bcrypt.hash(new_password, 10);
  await pool.query("UPDATE super_admin_auth SET password_hash = $1 WHERE id = 'superadmin'", [hash]);
  await pool.query("UPDATE super_admin_reset_tokens SET used_at = NOW() WHERE token = $1", [token]);
  res.json({ ok: true });
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

// GET /api/admin/centers/:centerId/settings
router.get("/admin/centers/:centerId/settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query("SELECT auto_checkout_min FROM centers WHERE id = $1", [centerId]);
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json({ auto_checkout_min: rows[0].auto_checkout_min as number });
});

// PATCH /api/admin/centers/:centerId/settings
router.patch("/admin/centers/:centerId/settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { auto_checkout_min } = req.body as { auto_checkout_min?: unknown };
  const mins = Number(auto_checkout_min);
  if (!Number.isFinite(mins) || mins < 10 || mins > 480) {
    res.status(400).json({ error: "auto_checkout_min must be a number between 10 and 480" }); return;
  }
  await pool.query("UPDATE centers SET auto_checkout_min = $1 WHERE id = $2", [mins, centerId]);
  res.json({ auto_checkout_min: mins });
});

// GET /api/admin/centers/:centerId/dashboard
router.get("/admin/centers/:centerId/dashboard", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

  const [memberRes, menuRes, kcalRes, activeRes, expiringRes, weeklyRes] = await Promise.all([
    pool.query("SELECT COUNT(*) as count FROM member_center_mapping WHERE center_id = $1", [centerId]),
    pool.query("SELECT COUNT(*) as count FROM menu_items WHERE center_id = $1", [centerId]),
    pool.query(
      `SELECT COALESCE(SUM(
         COALESCE(
           cl.calories_kcal,
           (SELECT SUM(mb.kcal) FROM menu_item_bom mb WHERE mb.menu_item_id = cl.menu_item_id AND mb.kcal IS NOT NULL)
         )
       ), 0) AS total_calories
       FROM consumption_logs cl
       JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
       WHERE mcm.center_id = $1 AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') = $2`,
      [centerId, today]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT member_id) AS count
       FROM member_check_ins
       WHERE center_id = $1 AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = $2`,
      [centerId, today]
    ),
    pool.query(
      `SELECT COUNT(*) AS count
       FROM members m
       JOIN member_center_mapping mcm ON mcm.member_id = m.id
       WHERE mcm.center_id = $1
         AND m.valid_until IS NOT NULL
         AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '10 days'`,
      [centerId]
    ),
    pool.query(
      `SELECT DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') AS day,
              COUNT(DISTINCT member_id) AS count
       FROM member_check_ins
       WHERE center_id = $1
         AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') >= DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
         AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') <  DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') + INTERVAL '1 month'
       GROUP BY day ORDER BY day`,
      [centerId]
    ),
  ]);

  res.json({
    member_count:          Number(memberRes.rows[0].count),
    menu_item_count:       Number(menuRes.rows[0].count),
    today_calories:        Number(kcalRes.rows[0].total_calories),
    today_active_members:  Number(activeRes.rows[0].count),
    expiring_soon_count:   Number(expiringRes.rows[0].count),
    monthly_checkins:      weeklyRes.rows as Array<{ day: string; count: number }>,
  });
});

// GET /api/admin/centers/:centerId/menu-items
router.get("/admin/centers/:centerId/menu-items", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: items } = await pool.query(
    `SELECT mi.id, mi.center_id, mi.name, mi.description, mi.is_mandatory, mi.flavours, mi.available_days, mi.created_at,
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

  const { name, description, flavours, available_days } = req.body as { name?: string; description?: string; flavours?: string; available_days?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO menu_items (center_id, name, description, flavours, available_days) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [centerId, name.trim(), description?.trim() ?? null, flavours?.trim() ?? "", available_days?.trim() || "all"]
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

  const { name, description, flavours, available_days } = req.body as { name?: string; description?: string; flavours?: string; available_days?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "UPDATE menu_items SET name=$1, description=$2, flavours=$3, available_days=$4 WHERE id=$5 RETURNING *",
    [name.trim(), description?.trim() ?? null, flavours?.trim() ?? "", available_days?.trim() || "all", itemId]
  );
  res.json(rows[0]);
});

// GET /api/admin/centers/:centerId/open-flavours — flavours from open ingredient batches
router.get("/admin/centers/:centerId/open-flavours", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    `SELECT DISTINCT i.flavour, i.name AS ingredient_name, i.id AS ingredient_id
     FROM ingredients i
     JOIN ingredient_batches ib ON ib.ingredient_id = i.id
     WHERE i.flavour IS NOT NULL AND i.flavour != ''
       AND ib.center_id = $1 AND ib.status = 'open'
     ORDER BY i.flavour`,
    [centerId]
  );
  res.json(rows);
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
         AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
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

  // Logs breakdown: ALL logs for this center in the date range.
  // Each row carries a resolved menu_item_id+name (null = self-logged by member, not via check-in).
  // qty and kcal fall back to BOM totals when the stored value is NULL (BOM-based check-in logs).
  const { rows: logsRaw } = await pool.query(
    `SELECT cl.id, cl.member_id, m.name AS member_name, cl.logged_at, cl.meal_slot,
            cl.food_item, cl.checkin_id,
            COALESCE(
              cl.quantity_g,
              (SELECT SUM(mb.quantity) FROM menu_item_bom mb
               WHERE mb.menu_item_id = cl.menu_item_id)
            ) AS quantity_g,
            COALESCE(
              cl.calories_kcal,
              (SELECT SUM(mb.kcal) FROM menu_item_bom mb
               WHERE mb.menu_item_id = cl.menu_item_id AND mb.kcal IS NOT NULL)
            ) AS calories_kcal,
            COALESCE(
              (SELECT mi.id FROM menu_items mi
               WHERE mi.id = cl.menu_item_id AND mi.center_id = $1 LIMIT 1),
              (SELECT mi2.id FROM menu_items mi2
               WHERE mi2.center_id = $1
                 AND LOWER(mi2.name) = LOWER(cl.food_item)
               LIMIT 1)
            ) AS menu_item_id,
            COALESCE(
              (SELECT mi.name FROM menu_items mi
               WHERE mi.id = cl.menu_item_id AND mi.center_id = $1 LIMIT 1),
              (SELECT mi2.name FROM menu_items mi2
               WHERE mi2.center_id = $1
                 AND LOWER(mi2.name) = LOWER(cl.food_item)
               LIMIT 1)
            ) AS menu_item_name
     FROM consumption_logs cl
     JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
     JOIN members m ON m.id = cl.member_id
     WHERE mcm.center_id = $1
       AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
     ORDER BY cl.logged_at DESC`,
    [centerId, from, to]
  );

  res.json({ from, to, by_component: byComponent, logs: logsRaw });
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

  const expiringSoon = req.query.expiring_soon === "true";

  // Auto-checkout any sessions that have exceeded the time limit
  await autoCheckoutExpired(centerId);

  const { rows } = await pool.query(
    `SELECT
       m.id, m.name, m.date_of_joining, m.height_cm, m.mobile, m.email, m.membership_no,
       m.dob, m.age_at_joining, m.valid_until, m.is_active,
       ci.id          AS checkin_id,
       ci.checked_in_at,
       ci.checked_out_at,
       EXISTS (
         SELECT 1 FROM member_check_ins mci2
         WHERE mci2.member_id = m.id
           AND mci2.center_id = $1
           AND DATE(mci2.checked_in_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
           AND mci2.checked_out_at IS NOT NULL
       ) AS already_consumed_today
     FROM members m
     JOIN member_center_mapping mcm ON mcm.member_id = m.id
     LEFT JOIN member_check_ins ci
       ON ci.member_id = m.id AND ci.center_id = $1 AND ci.checked_out_at IS NULL
     WHERE mcm.center_id = $1
       ${expiringSoon ? "AND m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '10 days'" : ""}
     ORDER BY m.valid_until ASC NULLS LAST, m.name`,
    [centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/members — create & onboard new member
router.post("/admin/centers/:centerId/members", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, height_cm, date_of_joining, mobile, email, membership_no, dob, age_at_joining, valid_until } = req.body as {
    name?: string; height_cm?: number | null; date_of_joining?: string | null;
    mobile?: string | null; email?: string | null; membership_no?: string | null;
    dob?: string | null; age_at_joining?: number | null; valid_until?: string | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!mobile?.trim() && !email?.trim()) { res.status(400).json({ error: "mobile or email is required" }); return; }
  if (age_at_joining != null && (age_at_joining <= 0 || age_at_joining > 100)) {
    res.status(400).json({ error: "age_at_joining must be between 0 and 100" }); return;
  }

  const { rows: memberRows } = await pool.query(
    `INSERT INTO members (name, height_cm, date_of_joining, mobile, email, membership_no, dob, age_at_joining, valid_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [name.trim(), height_cm ?? null, date_of_joining ?? null, mobile?.trim() || null, email?.trim() || null, membership_no?.trim() || null, dob?.trim() || null, age_at_joining ?? null, valid_until ?? null]
  );
  const member = memberRows[0];
  await pool.query(
    `INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [member.id, centerId]
  );
  res.status(201).json(member);
});

// PATCH /api/admin/centers/:centerId/members/:memberId — update member details
router.patch("/admin/centers/:centerId/members/:memberId", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { name, mobile, email, membership_no, height_cm, date_of_joining, dob, age_at_joining, valid_until } = req.body as {
    name?: string; mobile?: string | null; email?: string | null; membership_no?: string | null;
    height_cm?: number | null; date_of_joining?: string | null;
    dob?: string | null; age_at_joining?: number | null; valid_until?: string | null;
  };
  if (name !== undefined && !name?.trim()) { res.status(400).json({ error: "name cannot be blank" }); return; }
  if (age_at_joining != null && (age_at_joining <= 0 || age_at_joining > 100)) {
    res.status(400).json({ error: "age_at_joining must be between 0 and 100" }); return;
  }

  const { rows } = await pool.query(
    `UPDATE members SET
       name           = COALESCE($1, name),
       mobile         = $2,
       email          = $3,
       membership_no  = $4,
       height_cm      = $5,
       date_of_joining= $6,
       dob            = $7,
       age_at_joining = $8,
       valid_until    = $9
     WHERE id = $10 RETURNING *`,
    [
      name?.trim() ?? null,
      mobile?.trim() || null,
      email?.trim() || null,
      membership_no?.trim() || null,
      height_cm ?? null,
      date_of_joining ?? null,
      dob?.trim() || null,
      age_at_joining ?? null,
      valid_until ?? null,
      Number(memberId),
    ]
  );
  res.json(rows[0]);
});

// PATCH /api/admin/centers/:centerId/members/:memberId/status — toggle active/inactive
router.patch("/admin/centers/:centerId/members/:memberId/status", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { rows } = await pool.query(
    `UPDATE members SET is_active = NOT is_active WHERE id = $1 RETURNING id, is_active`,
    [Number(memberId)]
  );
  res.json(rows[0]);
});

// DELETE /api/admin/centers/:centerId/members/:memberId/hard-delete — permanently delete member
router.delete("/admin/centers/:centerId/members/:memberId/hard-delete", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const mid = Number(memberId);
  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [mid, centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  // Delete in dependency order to avoid FK violations
  await pool.query(`DELETE FROM visit_menu_selections WHERE checkin_id IN (SELECT id FROM member_check_ins WHERE member_id = $1)`, [mid]);
  await pool.query(`DELETE FROM member_check_ins WHERE member_id = $1`, [mid]);
  await pool.query(`DELETE FROM consumption_logs WHERE member_id = $1`, [mid]);
  await pool.query(`DELETE FROM issuances WHERE member_id = $1`, [mid]);
  await pool.query(`DELETE FROM health_records WHERE member_id = $1`, [mid]);
  await pool.query(`DELETE FROM member_center_mapping WHERE member_id = $1`, [mid]);
  // Remove user_auth entries matching this member
  await pool.query(`DELETE FROM user_auth WHERE member_id = $1`, [mid]);
  await pool.query(`DELETE FROM members WHERE id = $1`, [mid]);
  res.status(204).send();
});

// PATCH /api/admin/centers/:centerId/members/:memberId/renew — extend validity by 32 days
router.patch("/admin/centers/:centerId/members/:memberId/renew", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { rows } = await pool.query(
    `UPDATE members SET valid_until = CURRENT_DATE + INTERVAL '32 days' WHERE id = $1 RETURNING valid_until`,
    [Number(memberId)]
  );
  res.json({ valid_until: rows[0].valid_until });
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

  // Check if the member already completed a center visit today (to avoid re-adding mandatory items)
  const { rows: todayLogs } = await pool.query(
    `SELECT 1 FROM member_check_ins
     WHERE member_id = $1
       AND center_id = $2
       AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
       AND checked_out_at IS NOT NULL
     LIMIT 1`,
    [Number(memberId), centerId]
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

// POST /api/admin/centers/:centerId/members/:memberId/cancel-checkin
// Checkout without booking any consumption — visit is recorded as cancelled
router.post("/admin/centers/:centerId/members/:memberId/cancel-checkin", requireAdmin, async (req, res) => {
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

  // Remove all pending menu selections so nothing is consumed
  await pool.query(`DELETE FROM visit_menu_selections WHERE checkin_id = $1`, [checkinId]);
  // Mark as checked out and cancelled — no consumption logs created
  await pool.query(
    `UPDATE member_check_ins SET checked_out_at = NOW(), cancelled = TRUE WHERE id = $1`,
    [checkinId]
  );
  res.json({ cancelled: true, checkin_id: checkinId });
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

// GET /api/admin/centers/:centerId/health-records — bulk report (multi-member, date range)
router.get("/admin/centers/:centerId/health-records", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { from, to, member_ids } = req.query as {
    from?: string; to?: string; member_ids?: string;
  };

  // Default date range: last 30 days
  const toDate = to ? new Date(to) : new Date();
  toDate.setHours(23, 59, 59, 999);
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  fromDate.setHours(0, 0, 0, 0);

  // Parse optional member_ids filter
  const memberIdList = member_ids
    ? member_ids.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    : [];

  let query: string;
  let params: (string | number | Date)[];

  if (memberIdList.length > 0) {
    const placeholders = memberIdList.map((_, i) => `$${i + 4}`).join(",");
    query = `
      SELECT hr.id, hr.member_id, m.name AS member_name,
             hr.center_id, hr.recorded_at,
             hr.weight_kg, hr.bmi, hr.body_fat_pct, hr.visceral_fat,
             hr.bmr, hr.metabolic_age, hr.muscle_mass_kg, hr.resting_hr, hr.notes
      FROM health_records hr
      JOIN members m ON m.id = hr.member_id
      JOIN member_center_mapping mcm ON mcm.member_id = hr.member_id
      WHERE hr.center_id = $1
        AND hr.recorded_at >= $2 AND hr.recorded_at <= $3
        AND hr.member_id IN (${placeholders})
        AND mcm.center_id = $1
      ORDER BY hr.recorded_at DESC`;
    params = [centerId, fromDate, toDate, ...memberIdList];
  } else {
    query = `
      SELECT hr.id, hr.member_id, m.name AS member_name,
             hr.center_id, hr.recorded_at,
             hr.weight_kg, hr.bmi, hr.body_fat_pct, hr.visceral_fat,
             hr.bmr, hr.metabolic_age, hr.muscle_mass_kg, hr.resting_hr, hr.notes
      FROM health_records hr
      JOIN members m ON m.id = hr.member_id
      JOIN member_center_mapping mcm ON mcm.member_id = hr.member_id
      WHERE hr.center_id = $1
        AND hr.recorded_at >= $2 AND hr.recorded_at <= $3
        AND mcm.center_id = $1
      ORDER BY hr.recorded_at DESC`;
    params = [centerId, fromDate, toDate];
  }

  const { rows } = await pool.query(query, params);
  res.json(rows);
});

// ── Ingredient Catalog ──────────────────────────────────────────────────────

// GET /api/admin/centers/:centerId/flavours
router.get("/admin/centers/:centerId/flavours", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "SELECT id, center_id, name, serving_qty, available_days, created_at FROM center_flavours WHERE center_id = $1 ORDER BY name",
    [centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/flavours
router.post("/admin/centers/:centerId/flavours", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, available_days } = req.body as { name?: string; available_days?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "INSERT INTO center_flavours (center_id, name, available_days) VALUES ($1, $2, $3) ON CONFLICT (center_id, name) DO NOTHING RETURNING *",
    [centerId, name.trim(), available_days ?? "all"]
  );
  if (!rows[0]) { res.status(409).json({ error: "Flavour already exists" }); return; }
  res.status(201).json(rows[0]);
});

// PATCH /api/admin/centers/:centerId/flavours/:flavourId
router.patch("/admin/centers/:centerId/flavours/:flavourId", requireAdmin, async (req, res) => {
  const { centerId, flavourId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { available_days } = req.body as { available_days?: string };
  const { rows } = await pool.query(
    `UPDATE center_flavours
     SET available_days = COALESCE($1, available_days)
     WHERE id = $2 AND center_id = $3
     RETURNING *`,
    [available_days ?? null, Number(flavourId), centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json(rows[0]);
});

// DELETE /api/admin/centers/:centerId/flavours/:flavourId
router.delete("/admin/centers/:centerId/flavours/:flavourId", requireAdmin, async (req, res) => {
  const { centerId, flavourId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM center_flavours WHERE id = $1 AND center_id = $2", [Number(flavourId), centerId]);
  res.status(204).end();
});

// GET /api/admin/ingredients
router.get("/admin/ingredients", requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving, created_at FROM ingredients ORDER BY name"
  );
  res.json(rows);
});

// POST /api/admin/ingredients
router.post("/admin/ingredients", requireAdmin, async (req, res) => {
  const { name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving } = req.body as {
    name?: string; pack_size?: number; pack_unit?: string;
    material_code?: string; description?: string; flavour?: string; serving_qty?: number; kcal_per_serving?: number | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "INSERT INTO ingredients (name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [name.trim(), pack_size ?? 1, pack_unit?.trim() ?? "g", material_code?.trim() || null, description?.trim() || null, flavour?.trim() || null, serving_qty ?? 1, kcal_per_serving ?? null]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/ingredients/:ingredientId
router.put("/admin/ingredients/:ingredientId", requireAdmin, async (req, res) => {
  const { ingredientId } = req.params;
  const { name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving } = req.body as {
    name?: string; pack_size?: number; pack_unit?: string;
    material_code?: string; description?: string; flavour?: string; serving_qty?: number; kcal_per_serving?: number | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "UPDATE ingredients SET name=$1, pack_size=$2, pack_unit=$3, material_code=$4, description=$5, flavour=$6, serving_qty=$7, kcal_per_serving=$8 WHERE id=$9 RETURNING *",
    [name.trim(), pack_size ?? 1, pack_unit?.trim() ?? "g", material_code?.trim() || null, description?.trim() || null, flavour?.trim() || null, serving_qty ?? 1, kcal_per_serving ?? null, Number(ingredientId)]
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
            ib.received_qty, ib.received_unit,
            ib.center_id, ib.batch_number, ib.status, ib.opened_at, ib.consumed_at, ib.created_at,
            ib.assigned_member_id, ib.assigned_member_name,
            COALESCE((
              SELECT SUM(bcl.quantity)
              FROM batch_consumption_logs bcl
              WHERE bcl.batch_id = ib.id
            ), 0) + COALESCE((
              SELECT SUM(ba.qty_change)
              FROM batch_adjustments ba
              WHERE ba.batch_id = ib.id
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

  const { ingredient_id, batch_number, assigned_member_id, assigned_member_name, received_qty, received_unit } =
    req.body as { ingredient_id?: number; batch_number?: string; assigned_member_id?: number; assigned_member_name?: string; received_qty?: number; received_unit?: string };
  if (!ingredient_id) { res.status(400).json({ error: "ingredient_id is required" }); return; }
  if (!batch_number?.trim()) { res.status(400).json({ error: "batch_number is required" }); return; }

  // Member packs are immediately opened (they're "in use" by the member right away)
  const isMemberPack = assigned_member_id != null;
  const { rows } = await pool.query(
    `INSERT INTO ingredient_batches (ingredient_id, center_id, batch_number, status, opened_at, assigned_member_id, assigned_member_name, received_qty, received_unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      ingredient_id, centerId, batch_number.trim(),
      isMemberPack ? "open" : "new",
      isMemberPack ? new Date() : null,
      assigned_member_id ?? null,
      assigned_member_name?.trim() ?? null,
      received_qty ?? null,
      received_unit?.trim() ?? null,
    ]
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

  // Enforce: no other open center-stock batch for this ingredient (member packs are exempt)
  if (!existing[0].assigned_member_id) {
    const { rows: openCheck } = await pool.query(
      "SELECT id FROM ingredient_batches WHERE ingredient_id=$1 AND center_id=$2 AND status='open' AND assigned_member_id IS NULL",
      [existing[0].ingredient_id, existing[0].center_id]
    );
    if (openCheck.length > 0) {
      res.status(409).json({ error: "There is already an open batch for this ingredient. Mark it as consumed first." });
      return;
    }
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

// ── Batch Adjustments ──────────────────────────────────────────────────────────

// POST /api/admin/ingredient-batches/:batchId/adjust  — log a ± adjustment
router.post("/admin/ingredient-batches/:batchId/adjust", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: batch } = await pool.query("SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]);
  if (!batch[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (batch[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  if (batch[0].status !== "open") { res.status(409).json({ error: "Adjustments can only be made to open batches" }); return; }

  const { qty_change, note } = req.body as { qty_change?: number; note?: string };
  if (qty_change === undefined || qty_change === null) { res.status(400).json({ error: "qty_change is required" }); return; }
  if (qty_change === 0) { res.status(400).json({ error: "qty_change must be non-zero" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO batch_adjustments (batch_id, qty_change, note) VALUES ($1,$2,$3) RETURNING *",
    [Number(batchId), qty_change, note?.trim() ?? null]
  );
  res.status(201).json(rows[0]);
});

// GET /api/admin/ingredient-batches/:batchId/adjustments  — list adjustments
router.get("/admin/ingredient-batches/:batchId/adjustments", requireAdmin, async (req, res) => {
  const { batchId } = req.params;
  const adminReq = req as AdminRequest;

  const { rows: batch } = await pool.query("SELECT * FROM ingredient_batches WHERE id=$1", [Number(batchId)]);
  if (!batch[0]) { res.status(404).json({ error: "Batch not found" }); return; }
  if (batch[0].center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    "SELECT id, batch_id, qty_change, note, adjusted_at FROM batch_adjustments WHERE batch_id=$1 ORDER BY adjusted_at DESC",
    [Number(batchId)]
  );
  res.json(rows);
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

  // Enforce: item must have all tracked BOM ingredients with an open batch
  const { rows: avail } = await pool.query(
    `SELECT NOT EXISTS (
       SELECT 1 FROM menu_item_bom mb
       WHERE mb.menu_item_id = $1 AND mb.ingredient_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM ingredient_batches ib
           WHERE ib.ingredient_id = mb.ingredient_id AND ib.center_id = $2 AND ib.status = 'open'
         )
     ) AS is_available`,
    [menu_item_id, adminReq.adminCenterId]
  );
  if (!(avail[0] as { is_available: boolean }).is_available) {
    res.status(409).json({ error: "Cannot add this item: one or more ingredients have no open batch. Open a batch in Inventory first." });
    return;
  }

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

// GET /api/admin/checkins/:checkinId/flavour-options — available direct-flavour items for this visit's center today
router.get("/admin/checkins/:checkinId/flavour-options", requireAdmin, async (req, res) => {
  const { checkinId } = req.params;
  const adminReq = req as AdminRequest;
  const { rows: ciRows } = await pool.query(
    `SELECT center_id FROM member_check_ins WHERE id = $1`,
    [Number(checkinId)]
  );
  if (!ciRows[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  const centerId = (ciRows[0] as { center_id: string }).center_id;
  if (centerId !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[nowIst.getUTCDay()];

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (i.id) i.id, i.name, i.flavour, i.pack_unit AS unit
     FROM ingredients i
     JOIN ingredient_batches ib ON ib.ingredient_id = i.id
     LEFT JOIN center_flavours cf ON cf.name = i.flavour AND cf.center_id = $1
     WHERE i.flavour IS NOT NULL AND i.flavour != ''
       AND ib.center_id = $1 AND ib.status = 'open'
       AND (cf.id IS NULL OR cf.available_days = 'all' OR cf.available_days LIKE $2)
     ORDER BY i.id, i.name`,
    [centerId, `%${todayDay}%`]
  );
  res.json(rows);
});

// GET /api/admin/checkins/:checkinId/flavour-selections
router.get("/admin/checkins/:checkinId/flavour-selections", requireAdmin, async (req, res) => {
  const { checkinId } = req.params;
  const adminReq = req as AdminRequest;
  const { rows: ciRows } = await pool.query(
    `SELECT center_id FROM member_check_ins WHERE id = $1`,
    [Number(checkinId)]
  );
  if (!ciRows[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  if ((ciRows[0] as { center_id: string }).center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    `SELECT id, checkin_id, ingredient_id, flavour, created_at FROM visit_flavour_selections WHERE checkin_id = $1`,
    [Number(checkinId)]
  );
  res.json(rows);
});

// POST /api/admin/checkins/:checkinId/flavour-selections
router.post("/admin/checkins/:checkinId/flavour-selections", requireAdmin, async (req, res) => {
  const { checkinId } = req.params;
  const adminReq = req as AdminRequest;
  const { rows: ciRows } = await pool.query(
    `SELECT center_id FROM member_check_ins WHERE id = $1`,
    [Number(checkinId)]
  );
  if (!ciRows[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  if ((ciRows[0] as { center_id: string }).center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { ingredient_id, flavour } = req.body as { ingredient_id?: number; flavour?: string };
  if (!ingredient_id || !flavour) { res.status(400).json({ error: "ingredient_id and flavour are required" }); return; }
  const { rows } = await pool.query(
    `INSERT INTO visit_flavour_selections (checkin_id, ingredient_id, flavour)
     VALUES ($1, $2, $3) RETURNING *`,
    [Number(checkinId), ingredient_id, flavour]
  );
  res.status(201).json(rows[0]);
});

// DELETE /api/admin/flavour-selections/:selId
router.delete("/admin/flavour-selections/:selId", requireAdmin, async (req, res) => {
  const { selId } = req.params;
  const adminReq = req as AdminRequest;
  const { rows } = await pool.query(
    `SELECT vfs.id, mci.center_id
     FROM visit_flavour_selections vfs
     JOIN member_check_ins mci ON mci.id = vfs.checkin_id
     WHERE vfs.id = $1`,
    [Number(selId)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  if ((rows[0] as { center_id: string }).center_id !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }
  await pool.query("DELETE FROM visit_flavour_selections WHERE id = $1", [Number(selId)]);
  res.status(204).end();
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

// ── Broadcast Settings ──────────────────────────────────────────────────────

// GET /api/admin/centers/:centerId/broadcast-settings
router.get("/admin/centers/:centerId/broadcast-settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "SELECT center_id, message, schedule_time, is_active, created_at, updated_at FROM center_broadcast_settings WHERE center_id = $1",
    [centerId]
  );
  if (!rows[0]) {
    res.json({ center_id: centerId, message: "", schedule_time: "09:00", is_active: false });
    return;
  }
  res.json(rows[0]);
});

// PUT /api/admin/centers/:centerId/broadcast-settings
router.put("/admin/centers/:centerId/broadcast-settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { message, schedule_time, is_active } = req.body as {
    message?: string; schedule_time?: string; is_active?: boolean;
  };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" }); return;
  }
  const timeStr = typeof schedule_time === "string" ? schedule_time.trim() : "09:00";
  if (!/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
    res.status(400).json({ error: "schedule_time must be HH:MM (24-hour format)" }); return;
  }
  const active = Boolean(is_active);
  await pool.query(
    `INSERT INTO center_broadcast_settings (center_id, message, schedule_time, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (center_id) DO UPDATE SET
       message = EXCLUDED.message,
       schedule_time = EXCLUDED.schedule_time,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()`,
    [centerId, message.trim(), timeStr, active]
  );
  res.json({ center_id: centerId, message: message.trim(), schedule_time: timeStr, is_active: active });
});

// POST /api/admin/centers/:centerId/broadcasts — ad-hoc broadcast to all active members
router.post("/admin/centers/:centerId/broadcasts", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" }); return;
  }
  const trimmed = message.trim();
  // Insert the broadcast
  const { rows } = await pool.query(
    `INSERT INTO member_broadcasts (center_id, message, sent_at, sent_by)
     VALUES ($1, $2, NOW(), 'manual') RETURNING id`,
    [centerId, trimmed]
  );
  const broadcastId = (rows[0] as { id: number }).id;
  res.json({ id: broadcastId, message: trimmed, sent_at: new Date().toISOString(), sent_by: "manual" });
});

// GET /api/admin/centers/:centerId/broadcasts — recent broadcasts
router.get("/admin/centers/:centerId/broadcasts", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { rows } = await pool.query(
    `SELECT id, center_id, message, sent_at, sent_by
     FROM member_broadcasts WHERE center_id = $1
     ORDER BY sent_at DESC LIMIT $2`,
    [centerId, limit]
  );
  res.json(rows);
});

export default router;
