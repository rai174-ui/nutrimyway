import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { pool } from "../lib/sqlite";
import { logger } from "../lib/logger";
import { bookAndCheckout } from "../lib/checkout";

const SUPER_ADMIN_EMAIL = process.env["SUPER_ADMIN_EMAIL"] ?? "rai.174@gmail.com";
const APP_URL = process.env["APP_URL"] ?? "http://localhost:8080";

async function getMemberType(memberId: number): Promise<string | undefined> {
  const { rows } = await pool.query("SELECT member_type FROM members WHERE id = $1", [memberId]);
  return rows[0]?.member_type as string | undefined;
}

async function isTrialMemberType(memberId: number): Promise<boolean> {
  const type = await getMemberType(memberId);
  return type === "trial_1day" || type === "trial_3day";
}

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
const DEFAULT_CHECKIN_CAP = 32;
const DEFAULT_RENEWAL_DAYS = 40;

async function getCenterLimits(centerId: string): Promise<{ checkinCap: number; renewalDays: number }> {
  const { rows } = await pool.query("SELECT checkin_cap, renewal_days FROM centers WHERE id = $1", [centerId]);
  return {
    checkinCap: Number(rows[0]?.checkin_cap ?? DEFAULT_CHECKIN_CAP),
    renewalDays: Number(rows[0]?.renewal_days ?? DEFAULT_RENEWAL_DAYS),
  };
}

// Trial 3-Day members always get a fixed renewal/check-in cap override,
// regardless of what the center has configured. Trial 1-Day members and all
// other member types continue to use the center's configured limits.
// These defaults apply only if the `app_settings` row is somehow missing —
// the actual values are editable by the Super Admin (no code deploy needed).
const DEFAULT_TRIAL_3DAY_RENEWAL_DAYS = 5;
const DEFAULT_TRIAL_3DAY_CHECKIN_CAP = 3;

export async function getTrialSettings(): Promise<{ checkinCap: number; renewalDays: number }> {
  const { rows } = await pool.query(
    "SELECT trial_3day_checkin_cap, trial_3day_renewal_days FROM app_settings WHERE id = 'global'"
  );
  return {
    checkinCap: Number(rows[0]?.trial_3day_checkin_cap ?? DEFAULT_TRIAL_3DAY_CHECKIN_CAP),
    renewalDays: Number(rows[0]?.trial_3day_renewal_days ?? DEFAULT_TRIAL_3DAY_RENEWAL_DAYS),
  };
}

async function getEffectiveMemberLimits(centerId: string, memberId: number): Promise<{ checkinCap: number; renewalDays: number }> {
  const [centerLimits, memberType, trialSettings] = await Promise.all([
    getCenterLimits(centerId),
    getMemberType(memberId),
    getTrialSettings(),
  ]);
  if (memberType === "trial_3day") {
    return trialSettings;
  }
  return centerLimits;
}

const VALID_MEMBER_TYPES = new Set(["trial_1day", "trial_3day", "regular", "virtual"]);

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
    `SELECT ca.password_hash, ca.valid_until, ca.terms_accepted_at, c.name, c.is_active
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
  res.json({ token, center_id, center_name: rows[0].name, needs_terms_acceptance: !rows[0].terms_accepted_at });
});

// POST /api/admin/accept-terms — record first-login consent acceptance for the authenticated center admin
router.post("/admin/accept-terms", requireAdmin, async (req, res) => {
  const adminReq = req as AdminRequest;
  await pool.query(
    "UPDATE center_auth SET terms_accepted_at = COALESCE(terms_accepted_at, NOW()) WHERE center_id = $1",
    [adminReq.adminCenterId]
  );
  res.json({ accepted: true });
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

// POST /api/admin/super/centers — create a new center
router.post("/admin/super/centers", requireSuperAdmin, async (req, res) => {
  const { id, name, password } = req.body as { id?: string; name?: string; password?: string };
  const centerId = id?.trim();
  const centerName = name?.trim();
  if (!centerId || !/^[a-z0-9-]+$/.test(centerId)) {
    res.status(400).json({ error: "id is required and must be lowercase letters, numbers and hyphens only" });
    return;
  }
  if (!centerName) { res.status(400).json({ error: "name is required" }); return; }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" }); return;
  }
  const existing = await pool.query("SELECT id FROM centers WHERE id = $1", [centerId]);
  if (existing.rows[0]) { res.status(409).json({ error: "A center with this ID already exists" }); return; }

  const hash = await bcrypt.hash(password, 10);
  await pool.query("INSERT INTO centers (id, name) VALUES ($1, $2)", [centerId, centerName]);
  await pool.query("INSERT INTO center_auth (center_id, password_hash) VALUES ($1, $2)", [centerId, hash]);

  res.status(201).json({ id: centerId, name: centerName, is_active: true, valid_until: null });
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

// GET /api/admin/super/trial-settings — global Trial 3-Day renewal/check-in overrides
router.get("/admin/super/trial-settings", requireSuperAdmin, async (_req, res) => {
  const { checkinCap, renewalDays } = await getTrialSettings();
  res.json({ trial_3day_checkin_cap: checkinCap, trial_3day_renewal_days: renewalDays });
});

// PATCH /api/admin/super/trial-settings
router.patch("/admin/super/trial-settings", requireSuperAdmin, async (req, res) => {
  const { trial_3day_checkin_cap, trial_3day_renewal_days } = req.body as {
    trial_3day_checkin_cap?: unknown; trial_3day_renewal_days?: unknown;
  };
  const updates: string[] = [];
  const values: unknown[] = [];
  if (trial_3day_checkin_cap != null) {
    const cap = Number(trial_3day_checkin_cap);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      res.status(400).json({ error: "trial_3day_checkin_cap must be a whole number between 1 and 500" }); return;
    }
    updates.push(`trial_3day_checkin_cap = $${updates.length + 1}`);
    values.push(cap);
  }
  if (trial_3day_renewal_days != null) {
    const days = Number(trial_3day_renewal_days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      res.status(400).json({ error: "trial_3day_renewal_days must be a whole number between 1 and 365" }); return;
    }
    updates.push(`trial_3day_renewal_days = $${updates.length + 1}`);
    values.push(days);
  }
  if (updates.length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
  await pool.query(`UPDATE app_settings SET ${updates.join(", ")} WHERE id = 'global'`, values);
  const { checkinCap, renewalDays } = await getTrialSettings();
  res.json({ trial_3day_checkin_cap: checkinCap, trial_3day_renewal_days: renewalDays });
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
// PATCH /api/admin/super/centers/:centerId - edit center name
router.patch("/admin/super/centers/:centerId", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { name } = req.body as { name?: string };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  const { rows } = await pool.query(
    "UPDATE centers SET name = $1 WHERE id = $2 RETURNING id, name, is_active",
    [name.trim(), centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json(rows[0]);
});

// PATCH /api/admin/super/centers/:centerId/validity - set/clear access expiry date
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
  const { rows } = await pool.query("SELECT auto_checkout_min, photo_retention_days, checkin_cap, renewal_days FROM centers WHERE id = $1", [centerId]);
  if (!rows[0]) { res.status(404).json({ error: "Center not found" }); return; }
  res.json({
    auto_checkout_min: rows[0].auto_checkout_min as number,
    photo_retention_days: rows[0].photo_retention_days as number ?? 2,
    checkin_cap: rows[0].checkin_cap as number ?? DEFAULT_CHECKIN_CAP,
    renewal_days: rows[0].renewal_days as number ?? DEFAULT_RENEWAL_DAYS,
  });
});

// PATCH /api/admin/centers/:centerId/settings
router.patch("/admin/centers/:centerId/settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { auto_checkout_min, photo_retention_days, checkin_cap, renewal_days } = req.body as {
    auto_checkout_min?: unknown; photo_retention_days?: unknown; checkin_cap?: unknown; renewal_days?: unknown;
  };
  const updates: string[] = [];
  const values: unknown[] = [];
  if (auto_checkout_min != null) {
    const mins = Number(auto_checkout_min);
    if (!Number.isFinite(mins) || mins < 10 || mins > 480) {
      res.status(400).json({ error: "auto_checkout_min must be a number between 10 and 480" }); return;
    }
    updates.push(`auto_checkout_min = $${updates.length + 1}`);
    values.push(mins);
  }
  if (photo_retention_days != null) {
    const days = Number(photo_retention_days);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      res.status(400).json({ error: "photo_retention_days must be between 1 and 30" }); return;
    }
    updates.push(`photo_retention_days = $${updates.length + 1}`);
    values.push(days);
  }
  if (checkin_cap != null) {
    const cap = Number(checkin_cap);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      res.status(400).json({ error: "checkin_cap must be a whole number between 1 and 500" }); return;
    }
    updates.push(`checkin_cap = $${updates.length + 1}`);
    values.push(cap);
  }
  if (renewal_days != null) {
    const days = Number(renewal_days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      res.status(400).json({ error: "renewal_days must be a whole number between 1 and 365" }); return;
    }
    updates.push(`renewal_days = $${updates.length + 1}`);
    values.push(days);
  }
  if (updates.length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }
  values.push(centerId);
  await pool.query(`UPDATE centers SET ${updates.join(", ")} WHERE id = $${values.length}`, values);
  const { rows } = await pool.query("SELECT auto_checkout_min, photo_retention_days, checkin_cap, renewal_days FROM centers WHERE id = $1", [centerId]);
  res.json({
    auto_checkout_min: rows[0].auto_checkout_min as number,
    photo_retention_days: rows[0].photo_retention_days as number,
    checkin_cap: rows[0].checkin_cap as number,
    renewal_days: rows[0].renewal_days as number,
  });
});

// GET /api/admin/centers/:centerId/dashboard
router.get("/admin/centers/:centerId/dashboard", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const { checkinCap } = await getCenterLimits(centerId);

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
       WHERE center_id = $1 AND cancelled = FALSE AND DATE(checked_in_at AT TIME ZONE 'Asia/Kolkata') = $2`,
      [centerId, today]
    ),
    pool.query(
      `SELECT COUNT(*) AS count
       FROM members m
       JOIN member_center_mapping mcm ON mcm.member_id = m.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS used FROM member_check_ins mci
         WHERE mci.member_id = m.id AND mci.cancelled = FALSE AND mci.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz)
       ) ci ON TRUE
       WHERE mcm.center_id = $1
         AND (
           (m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
           OR ($2 - COALESCE(ci.used, 0)) <= 7
         )`,
      [centerId, checkinCap]
    ),
    pool.query(
      `SELECT TO_CHAR(checked_in_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
              COUNT(DISTINCT member_id) AS count
       FROM member_check_ins
       WHERE center_id = $1
         AND cancelled = FALSE
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

  // memberId is optionally provided by the admin visit/check-in panel (members.tsx) to
  // restrict options to trial-eligible items for trial members. When omitted (e.g. the
  // Set Menu master-data page), all items for the center are returned unfiltered.
  const { memberId } = req.query as { memberId?: string };
  const isTrialMember = memberId ? await isTrialMemberType(Number(memberId)) : false;

  const { rows: items } = await pool.query(
    `SELECT mi.id, mi.center_id, mi.name, mi.description, mi.is_mandatory, mi.flavours, mi.available_days, mi.created_at, mi.trial_eligible,
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
       AND (
         $2 = FALSE
         OR mi.is_mandatory = TRUE
         OR mi.trial_eligible = TRUE
       )
     ORDER BY mi.is_mandatory DESC, mi.name`,
    [centerId, isTrialMember]
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

  const { name, description, flavours, available_days, trial_eligible } = req.body as { name?: string; description?: string; flavours?: string; available_days?: string; trial_eligible?: boolean };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "INSERT INTO menu_items (center_id, name, description, flavours, available_days, trial_eligible) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [centerId, name.trim(), description?.trim() ?? null, flavours?.trim() ?? "", available_days?.trim() || "all", trial_eligible ?? false]
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

  const { name, description, flavours, available_days, trial_eligible } = req.body as { name?: string; description?: string; flavours?: string; available_days?: string; trial_eligible?: boolean };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }

  const { rows } = await pool.query(
    "UPDATE menu_items SET name=$1, description=$2, flavours=$3, available_days=$4, trial_eligible=$5 WHERE id=$6 RETURNING *",
    [name.trim(), description?.trim() ?? null, flavours?.trim() ?? "", available_days?.trim() || "all", trial_eligible ?? false, itemId]
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

// GET /api/admin/centers/:centerId/flavours-today — center flavours applicable for today's day-of-week
router.get("/admin/centers/:centerId/flavours-today", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[nowIst.getUTCDay()];

  const { rows } = await pool.query(
    `SELECT id, center_id, name, available_days, created_at
     FROM center_flavours
     WHERE center_id = $1 AND (available_days = 'all' OR available_days LIKE $2)
     ORDER BY name`,
    [centerId, `%${todayDay}%`]
  );
  res.json({ day: todayDay, flavours: rows });
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

  // ── Unified selections CTE: covers both admin-panel (visit_flavour_selections)
  //    and member-app (visit_ingredient_selections) checkin records.
  const { rows: byComponent } = await pool.query(
    `WITH all_selections AS (
       -- Admin panel flavour selections
       SELECT vfs.checkin_id, vfs.ingredient_id
       FROM visit_flavour_selections vfs
       JOIN member_check_ins mci ON mci.id = vfs.checkin_id
       WHERE mci.center_id = $1
         AND mci.checked_out_at IS NOT NULL
         AND mci.cancelled = FALSE
         AND DATE(mci.checked_out_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3

       UNION ALL

       -- Member app ingredient selections
       SELECT vis.checkin_id, vis.ingredient_id
       FROM visit_ingredient_selections vis
       JOIN member_check_ins mci ON mci.id = vis.checkin_id
       WHERE mci.center_id = $1
         AND mci.checked_out_at IS NOT NULL
         AND mci.cancelled = FALSE
         AND DATE(mci.checked_out_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
     )
     SELECT
       i.name          AS ingredient,
       i.pack_unit     AS unit,
       SUM(COALESCE(i.serving_qty, 1))       AS total_quantity,
       COUNT(DISTINCT mci.member_id)         AS member_count,
       COUNT(DISTINCT s.checkin_id)          AS log_count
     FROM all_selections s
     JOIN member_check_ins mci ON mci.id = s.checkin_id
     JOIN ingredients i ON i.id = s.ingredient_id
     GROUP BY i.name, i.pack_unit
     ORDER BY total_quantity DESC`,
    [centerId, from, to]
  );

  // ── By Members: one row per completed checkin, items aggregated
  const { rows: logsRaw } = await pool.query(
    `WITH all_selections AS (
       SELECT vfs.checkin_id, vfs.ingredient_id
       FROM visit_flavour_selections vfs
       JOIN member_check_ins mci ON mci.id = vfs.checkin_id
       WHERE mci.center_id = $1
         AND mci.checked_out_at IS NOT NULL
         AND mci.cancelled = FALSE
         AND DATE(mci.checked_out_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3

       UNION ALL

       SELECT vis.checkin_id, vis.ingredient_id
       FROM visit_ingredient_selections vis
       JOIN member_check_ins mci ON mci.id = vis.checkin_id
       WHERE mci.center_id = $1
         AND mci.checked_out_at IS NOT NULL
         AND mci.cancelled = FALSE
         AND DATE(mci.checked_out_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
     )
     SELECT
       mci.id                                        AS checkin_id,
       mci.member_id,
       m.name                                        AS member_name,
       mci.checked_out_at                            AS logged_at,
       STRING_AGG(
         CASE WHEN i.flavour IS NOT NULL AND i.flavour != ''
              THEN i.name || ' (' || i.flavour || ')'
              ELSE i.name
         END,
         ', ' ORDER BY i.name
       )                                             AS food_item,
       SUM(COALESCE(i.kcal_per_serving, 0))          AS calories_kcal,
       SUM(COALESCE(i.serving_qty, 1))               AS quantity_g,
       NULL::int                                     AS menu_item_id,
       NULL::text                                    AS menu_item_name,
       NULL::text                                    AS meal_slot
     FROM (SELECT DISTINCT checkin_id, ingredient_id FROM all_selections) s
     JOIN member_check_ins mci ON mci.id = s.checkin_id
     JOIN members m ON m.id = mci.member_id
     JOIN ingredients i ON i.id = s.ingredient_id
     GROUP BY mci.id, mci.member_id, m.name, mci.checked_out_at
     ORDER BY mci.checked_out_at DESC`,
    [centerId, from, to]
  );

  // ── Append water logs from member_nutrition_logs
  const { rows: waterAgg } = await pool.query(
    `SELECT SUM(mnl.water_ml) AS total_water, COUNT(DISTINCT mnl.member_id) AS member_count, COUNT(*) AS log_count
     FROM member_nutrition_logs mnl
     JOIN member_center_mapping mcm ON mcm.member_id = mnl.member_id
     WHERE mcm.center_id = $1 AND mnl.water_ml > 0 AND mnl.logged_date BETWEEN $2 AND $3`,
    [centerId, from, to]
  );
  if (waterAgg[0] && waterAgg[0].total_water > 0) {
    byComponent.push({
      ingredient: "Water",
      unit: "ml",
      total_quantity: Number(waterAgg[0].total_water),
      member_count: Number(waterAgg[0].member_count),
      log_count: Number(waterAgg[0].log_count)
    });
  }

  const { rows: waterMembers } = await pool.query(
    `SELECT
       NULL::int AS checkin_id,
       mnl.member_id,
       m.name AS member_name,
       mnl.logged_at,
       'Water' AS food_item,
       0::real AS calories_kcal,
       mnl.water_ml AS quantity_g,
       NULL::int AS menu_item_id,
       NULL::text AS menu_item_name,
       'Hydration' AS meal_slot
     FROM member_nutrition_logs mnl
     JOIN members m ON m.id = mnl.member_id
     JOIN member_center_mapping mcm ON mcm.member_id = mnl.member_id
     WHERE mcm.center_id = $1 AND mnl.water_ml > 0 AND mnl.logged_date BETWEEN $2 AND $3
     ORDER BY mnl.logged_at DESC`,
    [centerId, from, to]
  );

  logsRaw.push(...waterMembers);
  logsRaw.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

  res.json({ from, to, by_component: byComponent, logs: logsRaw });
});




// GET /api/admin/centers/:centerId/member-self-logs?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns meals that members logged themselves outside of center check-ins.
router.get("/admin/centers/:centerId/member-self-logs", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const from = typeof req.query.from === "string" ? req.query.from : today;
  const to   = typeof req.query.to   === "string" ? req.query.to   : today;

  const { rows } = await pool.query(
    `SELECT cl.id, cl.member_id, m.name AS member_name,
            cl.food_item, cl.meal_slot, cl.quantity_g, cl.calories_kcal, cl.logged_at, cl.photo_url
     FROM consumption_logs cl
     JOIN member_center_mapping mcm ON mcm.member_id = cl.member_id
     JOIN members m ON m.id = cl.member_id
     WHERE mcm.center_id = $1
       AND cl.checkin_id IS NULL
       AND DATE(cl.logged_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
     ORDER BY cl.logged_at DESC`,
    [centerId, from, to]
  );

  res.json({ from, to, logs: rows });
});

// ---------------------------------------------------------------------------
// Member management (per-center)
// ---------------------------------------------------------------------------

// GET /api/admin/members/lookup?mobile=...&email=...&membership_no=...
router.get("/admin/members/lookup", requireAdmin, async (req, res) => {
  const { mobile, email, membership_no } = req.query as { mobile?: string; email?: string; membership_no?: string };
  if (!mobile && !email && !membership_no) { res.status(400).json({ error: "mobile, email or membership_no is required" }); return; }

  const cols = "id, name, mobile, email, membership_no, height_cm, gender, date_of_joining";
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

  const [{ checkinCap, renewalDays }, trialSettings] = await Promise.all([
    getCenterLimits(centerId),
    getTrialSettings(),
  ]);

  const { rows } = await pool.query(
    `SELECT
       m.id, m.name, m.date_of_joining, m.height_cm, m.gender, m.mobile, m.email, m.membership_no,
       m.dob, m.age_at_joining, m.valid_until, m.is_active, m.member_type, m.cycle_started_at,
       m.daily_kcal, m.protein_target_g, m.fiber_target_g, m.water_target_ml,
       (
         SELECT COUNT(*) FROM member_check_ins mci3
         WHERE mci3.member_id = m.id AND mci3.cancelled = FALSE AND mci3.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz)
       ) AS checkins_used,
       ci.id          AS checkin_id,
       ci.checked_in_at,
       ci.checked_out_at,
       EXISTS (
         SELECT 1 FROM member_check_ins mci2
         WHERE mci2.member_id = m.id
           AND mci2.center_id = $1
           AND DATE(mci2.checked_in_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
           AND mci2.checked_out_at IS NOT NULL
       ) AS already_consumed_today,
       (
         SELECT water_ml FROM member_nutrition_logs mnl
         WHERE mnl.member_id = m.id
           AND mnl.logged_date = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
       ) AS today_water_ml,
       (
         SELECT water_ml FROM member_nutrition_logs mnl
         WHERE mnl.member_id = m.id
           AND mnl.logged_date = DATE(NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '1 day'
       ) AS yesterday_water_ml

     FROM members m
     JOIN member_center_mapping mcm ON mcm.member_id = m.id
     LEFT JOIN member_check_ins ci
       ON ci.member_id = m.id AND ci.center_id = $1 AND ci.checked_out_at IS NULL
     WHERE mcm.center_id = $1
       ${expiringSoon ? `AND (
         (m.valid_until IS NOT NULL AND DATE(m.valid_until) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')
         OR (
           (SELECT COUNT(*) FROM member_check_ins mci4 WHERE mci4.member_id = m.id AND mci4.cancelled = FALSE AND mci4.checked_in_at >= COALESCE(m.cycle_started_at, NULLIF(m.date_of_joining, '')::timestamptz, '-infinity'::timestamptz))
             >= (CASE WHEN m.member_type = 'trial_3day' THEN $3 ELSE $2 END)
         )
       )` : ""}
     ORDER BY m.valid_until ASC NULLS LAST, m.name`,
    expiringSoon ? [centerId, checkinCap - 7, trialSettings.checkinCap - 7] : [centerId]
  );
  // Trial 3-Day members always use the fixed override, regardless of this
  // center's configured checkin_cap/renewal_days — surface the value that
  // will actually be enforced so the admin UI never shows a misleading number.
  const withEffectiveLimits = rows.map(row => ({
    ...row,
    effective_checkin_cap: row.member_type === "trial_3day" ? trialSettings.checkinCap : checkinCap,
    effective_renewal_days: row.member_type === "trial_3day" ? trialSettings.renewalDays : renewalDays,
  }));
  res.json(withEffectiveLimits);
});

// POST /api/admin/centers/:centerId/members — create & onboard new member
router.post("/admin/centers/:centerId/members", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { name, height_cm, gender, date_of_joining, mobile, email, membership_no, dob, age_at_joining, valid_until, member_type } = req.body as {
    name?: string; height_cm?: number | null; gender?: string | null; date_of_joining?: string | null;
    mobile?: string | null; email?: string | null; membership_no?: string | null;
    dob?: string | null; age_at_joining?: number | null; valid_until?: string | null;
    member_type?: string | null;
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!mobile?.trim() && !email?.trim()) { res.status(400).json({ error: "mobile or email is required" }); return; }
  if (age_at_joining != null && (age_at_joining <= 0 || age_at_joining > 100)) {
    res.status(400).json({ error: "age_at_joining must be between 0 and 100" }); return;
  }
  if (member_type != null && !VALID_MEMBER_TYPES.has(member_type)) {
    res.status(400).json({ error: "invalid member_type" }); return;
  }

  const { rows: memberRows } = await pool.query(
    `INSERT INTO members (name, height_cm, gender, date_of_joining, mobile, email, membership_no, dob, age_at_joining, valid_until, member_type, cycle_started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW()) RETURNING *`,
    [name.trim(), height_cm ?? null, gender?.trim() || null, date_of_joining ?? null, mobile?.trim() || null, email?.trim() || null, membership_no?.trim() || null, dob?.trim() || null, age_at_joining ?? null, valid_until ?? null, member_type ?? "regular"]
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

  const { name, mobile, email, membership_no, height_cm, gender, date_of_joining, dob, age_at_joining, valid_until, daily_kcal, member_type, protein_target_g, fiber_target_g, water_target_ml } = req.body as {
    name?: string; mobile?: string | null; email?: string | null; membership_no?: string | null;
    height_cm?: number | null; gender?: string | null; date_of_joining?: string | null;
    dob?: string | null; age_at_joining?: number | null; valid_until?: string | null; daily_kcal?: number | null;
    member_type?: string | null;
    protein_target_g?: number | null; fiber_target_g?: number | null; water_target_ml?: number | null;
  };
  if (name !== undefined && !name?.trim()) { res.status(400).json({ error: "name cannot be blank" }); return; }
  if (age_at_joining != null && (age_at_joining <= 0 || age_at_joining > 100)) {
    res.status(400).json({ error: "age_at_joining must be between 0 and 100" }); return;
  }
  if (member_type != null && !VALID_MEMBER_TYPES.has(member_type)) {
    res.status(400).json({ error: "invalid member_type" }); return;
  }

  const { rows } = await pool.query(
    `UPDATE members SET
       name           = COALESCE($1, name),
       mobile         = $2,
       email          = $3,
       membership_no  = $4,
       height_cm      = $5,
       gender         = $6,
       date_of_joining= $7,
       dob            = $8,
       age_at_joining = $9,
       valid_until    = $10,
       daily_kcal     = $11,
       member_type    = COALESCE($12, member_type),
       protein_target_g = $13,
       fiber_target_g = $14,
       water_target_ml = $15
     WHERE id = $16 RETURNING *`,
    [
      name?.trim() ?? null,
      mobile?.trim() || null,
      email?.trim() || null,
      membership_no?.trim() || null,
      height_cm ?? null,
      gender?.trim() || null,
      date_of_joining ?? null,
      dob?.trim() || null,
      age_at_joining ?? null,
      valid_until ?? null,
      daily_kcal ?? null,
      member_type ?? null,
      protein_target_g ?? null,
      fiber_target_g ?? null,
      water_target_ml ?? null,
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

// PATCH /api/admin/centers/:centerId/members/:memberId/renew — record payment, extend validity by 40 days, reset check-in cycle
router.patch("/admin/centers/:centerId/members/:memberId/renew", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { payment_method, amount } = req.body as { payment_method?: string; amount?: number };
  if (payment_method !== "cash" && payment_method !== "online") {
    res.status(400).json({ error: "payment_method must be 'cash' or 'online'" }); return;
  }
  if (amount == null || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "amount is required and must be greater than 0" }); return;
  }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { rows: currentRows } = await pool.query(`SELECT valid_until FROM members WHERE id = $1`, [Number(memberId)]);
  const previousValidUntil = currentRows[0]?.valid_until as string | null;

  const { renewalDays } = await getEffectiveMemberLimits(centerId, Number(memberId));

  const { rows } = await pool.query(
    `UPDATE members
     SET valid_until = GREATEST(CURRENT_DATE, COALESCE(valid_until, CURRENT_DATE)) + MAKE_INTERVAL(days => $2),
         cycle_started_at = NOW()
     WHERE id = $1 RETURNING valid_until, cycle_started_at`,
    [Number(memberId), renewalDays]
  );
  const updated = rows[0] as { valid_until: string; cycle_started_at: string };

  await pool.query(
    `INSERT INTO member_renewals (member_id, center_id, payment_method, amount, previous_valid_until, new_valid_until, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [Number(memberId), centerId, payment_method, amount, previousValidUntil, updated.valid_until, centerId]
  );

  res.json({ valid_until: updated.valid_until, cycle_started_at: updated.cycle_started_at });
});

// GET /api/admin/centers/:centerId/members/:memberId/renewals — renewal payment history
router.get("/admin/centers/:centerId/members/:memberId/renewals", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`,
    [Number(memberId), centerId]
  );
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }

  const { rows } = await pool.query(
    `SELECT mr.*, COALESCE(i.name, '') AS ingredient_name
     FROM member_renewals mr
     LEFT JOIN ingredients i ON i.id = mr.ingredient_id
     WHERE mr.member_id = $1 AND mr.center_id = $2
     ORDER BY mr.created_at DESC`,
    [Number(memberId), centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/members/:memberId/payments
router.post("/admin/centers/:centerId/members/:memberId/payments", requireAdmin, async (req, res) => {
  const { centerId, memberId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows: membership } = await pool.query(`SELECT 1 FROM member_center_mapping WHERE member_id = $1 AND center_id = $2`, [Number(memberId), centerId]);
  if (!membership[0]) { res.status(404).json({ error: "Member not found in this center" }); return; }
  const { payment_type, amount, payment_method, ingredient_id, batch_id, quantity, unit, notes, new_valid_until } = req.body as {
    payment_type: string; amount: number; payment_method: string;
    ingredient_id?: number | null; batch_id?: number | null;
    quantity?: number | null; unit?: string | null; notes?: string | null; new_valid_until?: string | null;
  };
  if (!['renewal', 'product_sale', 'product_return'].includes(payment_type)) { res.status(400).json({ error: "Invalid payment_type" }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (payment_type === 'product_sale' && batch_id && quantity) {
      await client.query(`INSERT INTO batch_consumption_logs (batch_id, quantity, notes, recorded_at) VALUES ($1,$2,$3,NOW())`, [batch_id, quantity, `Sale to member ${memberId}`]);
    }
    if (payment_type === 'product_return' && ingredient_id && quantity) {
      const { rows: ingRows } = await client.query(`SELECT pack_unit FROM ingredients WHERE id = $1`, [ingredient_id]);
      const packUnit = (ingRows[0] as { pack_unit?: string } | undefined)?.pack_unit ?? unit ?? 'unit';
      await client.query(`INSERT INTO ingredient_batches (ingredient_id, center_id, total_qty, received_qty, received_unit, status, received_at) VALUES ($1,$2,$3,$3,$4,'open',NOW())`, [ingredient_id, centerId, quantity, packUnit]);
    }
    const { rows } = await client.query(
      `INSERT INTO member_renewals (member_id, center_id, payment_method, amount, new_valid_until, recorded_by, payment_type, ingredient_id, batch_id, quantity, unit, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()) RETURNING *`,
      [Number(memberId), centerId, payment_method, Number(amount), new_valid_until ?? null, 'admin', payment_type, ingredient_id ?? null, batch_id ?? null, quantity ?? null, unit ?? null, notes ?? null]
    );
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Payment recording failed', detail: err instanceof Error ? err.message : String(err) });
  } finally { client.release(); }
});

// GET /api/admin/centers/:centerId/renewals — renewal history report (all members, date range)
router.get("/admin/centers/:centerId/renewals", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { from, to } = req.query as { from?: string; to?: string };

  // Default date range: last 30 days
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(toDate.getTime()) || Number.isNaN(fromDate.getTime())) {
    res.status(400).json({ error: "from/to must be valid dates (YYYY-MM-DD)" }); return;
  }
  toDate.setHours(23, 59, 59, 999);
  fromDate.setHours(0, 0, 0, 0);
  if (fromDate.getTime() > toDate.getTime()) {
    res.status(400).json({ error: "from must be on or before to" }); return;
  }

  const { rows } = await pool.query(
    `SELECT mr.id, mr.member_id, m.name AS member_name, m.mobile AS member_mobile,
            m.membership_no, mr.center_id, mr.payment_method, mr.amount,
            mr.previous_valid_until, mr.new_valid_until, mr.recorded_by, mr.created_at
     FROM member_renewals mr
     JOIN members m ON m.id = mr.member_id
     WHERE mr.center_id = $1
       AND mr.created_at >= $2 AND mr.created_at <= $3
     ORDER BY mr.created_at DESC`,
    [centerId, fromDate, toDate]
  );
  res.json(rows);
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

  const { rows: cycleRows } = await pool.query(`SELECT cycle_started_at FROM members WHERE id = $1`, [Number(memberId)]);
  const cycleStartedAt = cycleRows[0]?.cycle_started_at as string | null;
  if (cycleStartedAt) {
    const { checkinCap } = await getEffectiveMemberLimits(centerId, Number(memberId));
    const { rows: usedRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM member_check_ins WHERE member_id = $1 AND cancelled = FALSE AND checked_in_at >= $2`,
      [Number(memberId), cycleStartedAt]
    );
    if (Number(usedRows[0].count) >= checkinCap) {
      res.status(403).json({ error: `Member has reached the ${checkinCap} check-in limit for this membership cycle. Renew membership to reset.` });
      return;
    }
  }

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
  await pool.query(`DELETE FROM visit_ingredient_selections WHERE checkin_id = $1`, [checkinId]);
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
    "SELECT id, name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving, trial_eligible, created_at FROM ingredients ORDER BY name"
  );
  const { rows: skus } = await pool.query("SELECT * FROM ingredient_skus");
  const result = rows.map((ing) => {
    return {
      ...ing,
      skus: skus.filter(s => s.ingredient_id === ing.id)
    };
  });
  res.json(result);
});

// POST /api/admin/ingredients
router.post("/admin/ingredients", requireAdmin, async (req, res) => {
  const { name, flavour, serving_qty, kcal_per_serving, trial_eligible, skus } = req.body as {
    name?: string; flavour?: string; serving_qty?: number; kcal_per_serving?: number | null; trial_eligible?: boolean;
    skus?: { material_code: string; pack_size: number; pack_unit: string }[];
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!skus || skus.length === 0) { res.status(400).json({ error: "at least one SKU is required" }); return; }

  const fallbackSku = skus[0];

  try {
    await pool.query("BEGIN");
    const { rows } = await pool.query(
      "INSERT INTO ingredients (name, pack_size, pack_unit, material_code, flavour, serving_qty, kcal_per_serving, trial_eligible) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [name.trim(), fallbackSku.pack_size, fallbackSku.pack_unit, fallbackSku.material_code, flavour?.trim() || null, serving_qty ?? 1, kcal_per_serving ?? null, trial_eligible ?? false]
    );
    const ingredientId = rows[0].id;
    const insertedSkus = [];
    for (const sku of skus) {
      const { rows: skuRows } = await pool.query(
        "INSERT INTO ingredient_skus (ingredient_id, material_code, pack_size, pack_unit) VALUES ($1, $2, $3, $4) RETURNING *",
        [ingredientId, sku.material_code.trim(), sku.pack_size, sku.pack_unit.trim()]
      );
      insertedSkus.push(skuRows[0]);
    }
    await pool.query("COMMIT");
    res.status(201).json({ ...rows[0], skus: insertedSkus });
  } catch (error) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create ingredient" });
  }
});

// PUT /api/admin/ingredients/:ingredientId
router.put("/admin/ingredients/:ingredientId", requireAdmin, async (req, res) => {
  const { ingredientId } = req.params;
  const { name, flavour, serving_qty, kcal_per_serving, trial_eligible, skus } = req.body as {
    name?: string; flavour?: string; serving_qty?: number; kcal_per_serving?: number | null; trial_eligible?: boolean;
    skus?: { material_code: string; pack_size: number; pack_unit: string }[];
  };
  if (!name?.trim()) { res.status(400).json({ error: "name is required" }); return; }
  if (!skus || skus.length === 0) { res.status(400).json({ error: "at least one SKU is required" }); return; }

  const fallbackSku = skus[0];

  try {
    await pool.query("BEGIN");
    const { rows } = await pool.query(
      "UPDATE ingredients SET name=$1, pack_size=$2, pack_unit=$3, material_code=$4, flavour=$5, serving_qty=$6, kcal_per_serving=$7, trial_eligible=$8 WHERE id=$9 RETURNING *",
      [name.trim(), fallbackSku.pack_size, fallbackSku.pack_unit, fallbackSku.material_code, flavour?.trim() || null, serving_qty ?? 1, kcal_per_serving ?? null, trial_eligible ?? false, Number(ingredientId)]
    );
    if (!rows[0]) {
      await pool.query("ROLLBACK");
      res.status(404).json({ error: "Not found" });
      return;
    }

    await pool.query("DELETE FROM ingredient_skus WHERE ingredient_id = $1", [Number(ingredientId)]);
    const insertedSkus = [];
    for (const sku of skus) {
      const { rows: skuRows } = await pool.query(
        "INSERT INTO ingredient_skus (ingredient_id, material_code, pack_size, pack_unit) VALUES ($1, $2, $3, $4) RETURNING *",
        [Number(ingredientId), sku.material_code.trim(), sku.pack_size, sku.pack_unit.trim()]
      );
      insertedSkus.push(skuRows[0]);
    }

    await pool.query("COMMIT");
    res.json({ ...rows[0], skus: insertedSkus });
  } catch (error) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: "Failed to update ingredient" });
  }
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

// GET /api/admin/centers/:centerId/depleting-batches — open batches with balance below 80% of capacity
router.get("/admin/centers/:centerId/depleting-batches", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }

  const { rows } = await pool.query(
    `SELECT ib.id, ib.ingredient_id, i.name AS ingredient_name, i.pack_size, i.pack_unit,
            ib.received_qty, ib.received_unit, ib.batch_number, ib.opened_at,
            COALESCE((
              SELECT SUM(bcl.quantity) FROM batch_consumption_logs bcl WHERE bcl.batch_id = ib.id
            ), 0) + COALESCE((
              SELECT SUM(ba.qty_change) FROM batch_adjustments ba WHERE ba.batch_id = ib.id
            ), 0) AS consumed_qty
     FROM ingredient_batches ib
     JOIN ingredients i ON i.id = ib.ingredient_id
     WHERE ib.center_id = $1 AND ib.status = 'open'
     ORDER BY ib.opened_at ASC`,
    [centerId]
  );

  const depleting = rows
    .map((r) => {
      const capacity = Number(r.received_qty ?? r.pack_size);
      const consumed = Number(r.consumed_qty);
      const balance = Math.max(0, capacity - consumed);
      const balancePct = capacity > 0 ? (balance / capacity) * 100 : 0;
      return { ...r, capacity, consumed_qty: consumed, balance, balance_pct: balancePct };
    })
    .filter((r) => r.balance_pct < 80)
    .sort((a, b) => a.balance_pct - b.balance_pct);

  res.json(depleting);
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

  const { sku_id, batch_number, no_of_packs } = req.body as { sku_id?: number; batch_number?: string; no_of_packs?: number };
  if (!sku_id) { res.status(400).json({ error: "sku_id is required" }); return; }
  if (!batch_number?.trim()) { res.status(400).json({ error: "batch_number is required" }); return; }
  const count = no_of_packs && no_of_packs > 0 ? no_of_packs : 1;

  const { rows: skuRows } = await pool.query("SELECT ingredient_id, pack_size, pack_unit FROM ingredient_skus WHERE id = $1", [sku_id]);
  if (!skuRows[0]) { res.status(404).json({ error: "SKU not found" }); return; }

  const { ingredient_id, pack_size, pack_unit } = skuRows[0];

  try {
    await pool.query("BEGIN");
    const inserted = [];
    for (let i = 0; i < count; i++) {
      const { rows } = await pool.query(
        `INSERT INTO ingredient_batches (ingredient_id, sku_id, center_id, batch_number, status, opened_at, assigned_member_id, assigned_member_name, received_qty, received_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          ingredient_id, sku_id, centerId, batch_number.trim(),
          "new", null, null, null, pack_size, pack_unit
        ]
      );
      inserted.push(rows[0]);
    }
    await pool.query("COMMIT");
    res.status(201).json(inserted);
  } catch (error) {
    await pool.query("ROLLBACK");
    res.status(500).json({ error: "Failed to create ingredient batches" });
  }
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
    `SELECT center_id, member_id FROM member_check_ins WHERE id = $1`,
    [Number(checkinId)]
  );
  if (!ciRows[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  const { center_id: centerId, member_id: memberId } = ciRows[0] as { center_id: string; member_id: number };
  if (centerId !== adminReq.adminCenterId) { res.status(403).json({ error: "Forbidden" }); return; }

  const isTrialMember = await isTrialMemberType(memberId);

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayDay = dayNames[nowIst.getUTCDay()];

  const { rows } = await pool.query(
    `SELECT DISTINCT ON (i.id) i.id, i.name, i.flavour, i.pack_unit AS unit,
            cc.id AS category_id, cc.name AS category_name
     FROM ingredients i
     JOIN ingredient_batches ib ON ib.ingredient_id = i.id
     LEFT JOIN checkin_category_ingredients cci ON cci.ingredient_id = i.id
     LEFT JOIN checkin_categories cc ON cc.id = cci.category_id AND cc.center_id = $1
     LEFT JOIN center_flavours cf ON cf.name = i.flavour AND cf.center_id = $1
     WHERE i.flavour IS NOT NULL AND i.flavour != ''
       AND ib.center_id = $1 AND ib.status = 'open'
       AND (
         $3 = TRUE AND i.trial_eligible = TRUE
         OR $3 = FALSE AND (cf.id IS NULL OR cf.available_days = 'all' OR cf.available_days LIKE $2)
       )
     ORDER BY i.id, cc.id, i.name`,
    [centerId, `%${todayDay}%`, isTrialMember]
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

// GET /api/admin/centers/:centerId/broadcast-settings — center-level retention only
router.get("/admin/centers/:centerId/broadcast-settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "SELECT center_id, retention_days, created_at, updated_at FROM center_broadcast_settings WHERE center_id = $1",
    [centerId]
  );
  res.json(rows[0] ?? { center_id: centerId, retention_days: 7 });
});

// PUT /api/admin/centers/:centerId/broadcast-settings — retention only
router.put("/admin/centers/:centerId/broadcast-settings", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { retention_days } = req.body as { retention_days?: number };
  const retention = Number.isFinite(retention_days) ? Math.max(1, Math.min(90, Math.round(retention_days ?? 7))) : 7;
  await pool.query(
    `INSERT INTO center_broadcast_settings (center_id, retention_days, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (center_id) DO UPDATE SET
       retention_days = EXCLUDED.retention_days,
       updated_at = NOW()`,
    [centerId, retention]
  );
  res.json({ center_id: centerId, retention_days: retention });
});

// GET /api/admin/centers/:centerId/broadcast-schedules
router.get("/admin/centers/:centerId/broadcast-schedules", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "SELECT id, center_id, message, schedule_time, is_active, last_sent_at, created_at, updated_at FROM center_broadcast_schedules WHERE center_id = $1 ORDER BY schedule_time",
    [centerId]
  );
  res.json(rows);
});

// POST /api/admin/centers/:centerId/broadcast-schedules
router.post("/admin/centers/:centerId/broadcast-schedules", requireAdmin, async (req, res) => {
  const { centerId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { message, schedule_time } = req.body as { message?: string; schedule_time?: string };
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" }); return;
  }
  const timeStr = typeof schedule_time === "string" ? schedule_time.trim() : "09:00";
  if (!/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
    res.status(400).json({ error: "schedule_time must be HH:MM (24-hour format)" }); return;
  }
  const { rows } = await pool.query(
    `INSERT INTO center_broadcast_schedules (center_id, message, schedule_time, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, TRUE, NOW(), NOW()) RETURNING *`,
    [centerId, message.trim(), timeStr]
  );
  res.status(201).json(rows[0]);
});

// PUT /api/admin/centers/:centerId/broadcast-schedules/:scheduleId
router.put("/admin/centers/:centerId/broadcast-schedules/:scheduleId", requireAdmin, async (req, res) => {
  const { centerId, scheduleId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { message, schedule_time, is_active } = req.body as {
    message?: string; schedule_time?: string; is_active?: boolean;
  };
  const updates: string[] = [];
  const values: (string | boolean | number)[] = [];
  let idx = 1;
  if (message !== undefined) {
    if (typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" }); return;
    }
    updates.push(`message = $${idx++}`);
    values.push(message.trim());
  }
  if (schedule_time !== undefined) {
    const timeStr = typeof schedule_time === "string" ? schedule_time.trim() : "09:00";
    if (!/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(timeStr)) {
      res.status(400).json({ error: "schedule_time must be HH:MM (24-hour format)" }); return;
    }
    updates.push(`schedule_time = $${idx++}`);
    values.push(timeStr);
  }
  if (is_active !== undefined) {
    updates.push(`is_active = $${idx++}`);
    values.push(Boolean(is_active));
  }
  if (updates.length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
  updates.push(`updated_at = NOW()`);
  values.push(Number(scheduleId));
  const { rows } = await pool.query(
    `UPDATE center_broadcast_schedules SET ${updates.join(", ")} WHERE id = $${idx} AND center_id = $${idx + 1} RETURNING *`,
    [...values, centerId]
  );
  if (!rows[0]) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(rows[0]);
});

// DELETE /api/admin/centers/:centerId/broadcast-schedules/:scheduleId
router.delete("/admin/centers/:centerId/broadcast-schedules/:scheduleId", requireAdmin, async (req, res) => {
  const { centerId, scheduleId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rowCount } = await pool.query(
    "DELETE FROM center_broadcast_schedules WHERE id = $1 AND center_id = $2",
    [Number(scheduleId), centerId]
  );
  if (!rowCount) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.status(204).end();
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

// GET /api/admin/centers/:centerId/broadcasts — recent broadcasts (admin sees all; retention only affects member view)
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

// DELETE /api/admin/centers/:centerId/broadcasts/:broadcastId
router.delete("/admin/centers/:centerId/broadcasts/:broadcastId", requireAdmin, async (req, res) => {
  const { centerId, broadcastId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(
    "SELECT center_id FROM member_broadcasts WHERE id = $1",
    [Number(broadcastId)]
  );
  if (!rows[0]) { res.status(404).json({ error: "Broadcast not found" }); return; }
  if ((rows[0] as { center_id: string }).center_id !== centerId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await pool.query("DELETE FROM member_broadcasts WHERE id = $1", [Number(broadcastId)]);
  res.status(204).end();
});

// ── Bulk Uploads ───────────────────────────────────────────────────────────

// POST /api/admin/centers/:centerId/upload/members
// Accepts XLSX/CSV with columns: name, membership_no, email, mobile, height_cm, date_of_joining, dob, age_at_joining, valid_until
// Data integrity: membership_no must be unique; email must be unique when provided.
router.post("/admin/super/centers/:centerId/upload/members", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;

  const { rows, format } = req.body as { rows: Record<string, unknown>[]; format?: string };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" }); return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const name = String(row.name ?? "").trim();
      const membershipNo = String(row.membership_no ?? "").trim();
      if (!name || !membershipNo) {
        results.errors.push(`Row missing name or membership_no`);
        continue;
      }

      // Deduplicate: check membership_no already exists
      const { rows: dup } = await client.query("SELECT id FROM members WHERE membership_no = $1", [membershipNo]);
      if (dup[0]) { results.skipped++; continue; }

      const email = String(row.email ?? "").trim() || null;
      const mobile = String(row.mobile ?? "").trim() || null;
      const heightCm = row.height_cm != null ? Number(row.height_cm) : null;
      const doj = String(row.date_of_joining ?? "").trim() || null;
      const dob = String(row.dob ?? "").trim() || null;
      const age = row.age_at_joining != null ? Number(row.age_at_joining) : null;
      const validUntil = String(row.valid_until ?? "").trim() || null;

      const { rows: m } = await client.query(
        `INSERT INTO members (name, height_cm, date_of_joining, mobile, email, membership_no, dob, age_at_joining, valid_until, cycle_started_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()) RETURNING id`,
        [name, heightCm, doj, mobile, email, membershipNo, dob, age, validUntil]
      );
      await client.query(
        `INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [m[0].id, centerId]
      );
      results.created++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    res.status(500).json({ error: "Bulk insert failed", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  client.release();
  res.json(results);
});

// POST /api/admin/centers/:centerId/upload/inventory
// Accepts XLSX/CSV with columns per row type:
//   ingredient: name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving
//   menu_item: name, description, is_mandatory, flavours, available_days
//   bom: menu_item_name, ingredient_name, quantity, unit, kcal
router.post("/admin/super/centers/:centerId/upload/inventory", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;

  const { rows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" }); return;
  }

  const results = { ingredients: 0, menuItems: 0, bom: 0, errors: [] as string[] };
  const ingredientMap = new Map<string, number>(); // name -> id
  const menuMap = new Map<string, number>(); // name -> id
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Load existing ingredients + menu items for this center (for dedup and linking)
    const { rows: existingIng } = await client.query("SELECT id, name FROM ingredients");
    for (const r of existingIng) ingredientMap.set((r as { name: string; id: number }).name, (r as { name: string; id: number }).id);

    const { rows: existingMi } = await client.query("SELECT id, name FROM menu_items WHERE center_id = $1", [centerId]);
    for (const r of existingMi) menuMap.set((r as { name: string; id: number }).name, (r as { name: string; id: number }).id);

    for (const row of rows) {
      const type = String(row.item_type ?? "").trim().toLowerCase();
      if (!type) { results.errors.push("Missing item_type (ingredient | menu_item | bom)"); continue; }

      if (type === "ingredient") {
        const name = String(row.name ?? "").trim();
        if (!name) { results.errors.push("ingredient missing name"); continue; }
        const mc = String(row.material_code ?? "").trim();
        if (!mc) { results.errors.push(`ingredient "${name}" missing material_code`); continue; }
        if (ingredientMap.has(name)) continue; // dedup
        const { rows: r } = await client.query(
          `INSERT INTO ingredients (name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [
            name,
            Number(row.pack_size ?? 1) || 1,
            String(row.pack_unit ?? "g").trim() || "g",
            mc,
            String(row.description ?? "").trim() || null,
            String(row.flavour ?? "").trim() || null,
            Number(row.serving_qty ?? 1) || 1,
            row.kcal_per_serving != null ? Number(row.kcal_per_serving) : null,
          ]
        );
        ingredientMap.set(name, r[0].id);
        results.ingredients++;

      } else if (type === "menu_item") {
        const name = String(row.name ?? "").trim();
        if (!name) { results.errors.push("menu_item missing name"); continue; }
        if (menuMap.has(name)) continue; // dedup
        const isMandatory = String(row.is_mandatory ?? "").trim().toLowerCase() === "yes";
        const flavours = String(row.flavours ?? "").trim() || null;
        const availableDays = String(row.available_days ?? "").trim() || "all";
        const { rows: r } = await client.query(
          `INSERT INTO menu_items (center_id, name, description, is_mandatory, flavours, available_days)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [centerId, name, String(row.description ?? "").trim() || null, isMandatory, flavours, availableDays]
        );
        menuMap.set(name, r[0].id);
        results.menuItems++;

      } else if (type === "bom") {
        const miName = String(row.menu_item_name ?? "").trim();
        const ingName = String(row.ingredient_name ?? "").trim();
        if (!miName || !ingName) { results.errors.push("bom missing menu_item_name or ingredient_name"); continue; }
        const menuId = menuMap.get(miName);
        const ingId = ingredientMap.get(ingName);
        if (!menuId) { results.errors.push(`BOM references unknown menu_item: ${miName}`); continue; }
        if (!ingId) { results.errors.push(`BOM references unknown ingredient: ${ingName}`); continue; }
        await client.query(
          `INSERT INTO menu_item_bom (menu_item_id, ingredient, ingredient_id, quantity, unit, kcal)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            menuId, ingName,
            ingId,
            Number(row.quantity ?? 0) || 0,
            String(row.unit ?? "g").trim() || "g",
            row.kcal != null ? Number(row.kcal) : null,
          ]
        );
        results.bom++;

      } else {
        results.errors.push(`Unknown item_type: ${type}`);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    res.status(500).json({ error: "Bulk inventory insert failed", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  client.release();
  res.json(results);
});

// POST /api/admin/super/upload/batches
// Columns: CenterID, MaterialCode, BatchLotNumber, Qty, Status (New|Open), ReceiptDate
router.post("/admin/super/upload/batches", requireSuperAdmin, async (req, res) => {
  const { rows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" }); return;
  }

  const results = { batches: 0, errors: [] as string[] };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pre-load ingredient material_code -> id map
    const { rows: ingRows } = await client.query("SELECT id, material_code FROM ingredients WHERE material_code IS NOT NULL");
    const materialMap = new Map<string, number>();
    for (const r of ingRows) {
      if ((r as { material_code: string }).material_code) {
        materialMap.set(String((r as { material_code: string }).material_code).trim().toLowerCase(), (r as { id: number }).id);
      }
    }

    // Pre-load valid center ids
    const { rows: centerRows } = await client.query("SELECT id FROM centers");
    const centerIds = new Set<string>(centerRows.map((r: { id: string }) => String(r.id).trim()));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, row 1 is header

      const centerId = String(row.CenterID ?? "").trim();
      const materialCode = String(row.MaterialCode ?? "").trim();
      const batchLotNumber = String(row.BatchLotNumber ?? "").trim();
      const qty = row.Qty != null ? Number(row.Qty) : null;
      const statusRaw = String(row.Status ?? "").trim().toLowerCase();
      const receiptDateRaw = row.ReceiptDate ?? row.Receipt_Date ?? null;

      if (!centerId) { results.errors.push(`Row ${rowNum}: CenterID is required`); continue; }
      if (!materialCode) { results.errors.push(`Row ${rowNum}: MaterialCode is required`); continue; }
      if (!batchLotNumber) { results.errors.push(`Row ${rowNum}: BatchLotNumber is required`); continue; }
      if (qty === null || isNaN(qty)) { results.errors.push(`Row ${rowNum}: Qty is required and must be a number`); continue; }

      if (!centerIds.has(centerId)) {
        results.errors.push(`Row ${rowNum}: Unknown CenterID "${centerId}"`); continue;
      }

      const ingredientId = materialMap.get(materialCode.toLowerCase());
      if (!ingredientId) {
        results.errors.push(`Row ${rowNum}: No ingredient found with MaterialCode "${materialCode}"`); continue;
      }

      if (statusRaw !== "new" && statusRaw !== "open") {
        results.errors.push(`Row ${rowNum}: Status must be "New" or "Open" (got "${row.Status}")`); continue;
      }
      const status = statusRaw as "new" | "open";

      let receiptDate: Date | null = null;
      if (receiptDateRaw != null && receiptDateRaw !== "") {
        // Handle Excel serial numbers or date strings
        if (typeof receiptDateRaw === "number") {
          // Excel date serial
          receiptDate = new Date(Math.round((receiptDateRaw - 25569) * 86400 * 1000));
        } else {
          receiptDate = new Date(String(receiptDateRaw));
          if (isNaN(receiptDate.getTime())) receiptDate = null;
        }
      }

      const openedAt = status === "open" ? (receiptDate ?? new Date()) : null;

      // Check for duplicate batch_number + ingredient + center
      const { rows: dup } = await client.query(
        "SELECT id FROM ingredient_batches WHERE ingredient_id=$1 AND center_id=$2 AND batch_number=$3 LIMIT 1",
        [ingredientId, centerId, batchLotNumber]
      );
      if (dup.length > 0) continue; // skip silently

      await client.query(
        `INSERT INTO ingredient_batches (ingredient_id, center_id, batch_number, status, received_qty, opened_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ingredientId, centerId, batchLotNumber, status, qty, openedAt, receiptDate ?? new Date()]
      );
      results.batches++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    res.status(500).json({ error: "Batch upload failed", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  client.release();
  res.json(results);
});

// POST /api/admin/super/centers/:centerId/upload/flavours
// Accepts XLSX/CSV with columns: name, available_days, center (required per-row)
// :centerId in the path must be a valid center (the one the dialog was opened from) but is
// only used to validate the request; each row's own "center" value determines where it lands.
// A row's "center" value may be a center ID or a center name (case-insensitive) and can
// target a different center than the one the dialog was opened from. Missing or unrecognized
// center values are reported as per-row errors, never silently defaulted or misassigned.
router.post("/admin/super/centers/:centerId/upload/flavours", requireSuperAdmin, async (req, res) => {
  const defaultCenterId = String(req.params.centerId);

  const { rows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" }); return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: allCenterRows } = await client.query("SELECT id, name FROM centers");
    const centerIds = new Set<string>(allCenterRows.map((r: { id: string }) => String(r.id).trim()));
    const centerNameMap = new Map<string, string>();
    for (const r of allCenterRows as { id: string; name: string }[]) {
      centerNameMap.set(String(r.name).trim().toLowerCase(), String(r.id).trim());
    }

    if (!centerIds.has(defaultCenterId)) {
      await client.query("ROLLBACK");
      client.release();
      res.status(404).json({ error: "Unknown center" });
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, row 1 is header
      const name = String(row.name ?? "").trim();
      if (!name) { results.errors.push(`Row ${rowNum}: name is required`); continue; }
      const availableDays = String(row.available_days ?? "").trim() || "all";

      const centerRaw = String(row.center ?? row.Center ?? row.CenterID ?? "").trim();
      let centerId: string;
      if (!centerRaw) {
        results.errors.push(`Row ${rowNum}: center is required`); continue;
      } else if (centerIds.has(centerRaw)) {
        centerId = centerRaw;
      } else if (centerNameMap.has(centerRaw.toLowerCase())) {
        centerId = centerNameMap.get(centerRaw.toLowerCase())!;
      } else {
        results.errors.push(`Row ${rowNum}: Unknown center "${centerRaw}"`); continue;
      }

      const { rows: r } = await client.query(
        `INSERT INTO center_flavours (center_id, name, available_days)
         VALUES ($1, $2, $3) ON CONFLICT (center_id, name) DO NOTHING RETURNING id`,
        [centerId, name, availableDays]
      );
      if (!r[0]) { results.skipped++; continue; }
      results.created++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    res.status(500).json({ error: "Bulk flavour upload failed", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  client.release();
  res.json(results);
});

// POST /api/admin/super/upload/items
// Accepts XLSX/CSV with columns: name, material_code, pack_size, pack_unit, description, flavour, serving_qty, kcal_per_serving, trial_eligible
// Items (ingredients) are global (not center-scoped). material_code must be unique.
router.post("/admin/super/upload/items", requireSuperAdmin, async (req, res) => {
  const { rows } = req.body as { rows: Record<string, unknown>[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" }); return;
  }

  const results = { created: 0, skipped: 0, errors: [] as string[] };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: existing } = await client.query("SELECT name, material_code FROM ingredients");
    const existingNames = new Set<string>(existing.map((r: { name: string }) => r.name.toLowerCase()));
    const existingCodes = new Set<string>(
      existing
        .filter((r: { material_code: string | null }) => r.material_code)
        .map((r: { material_code: string }) => r.material_code.toLowerCase())
    );

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed, row 1 is header
      const name = String(row.name ?? "").trim();
      const materialCode = String(row.material_code ?? "").trim();
      if (!name) { results.errors.push(`Row ${rowNum}: name is required`); continue; }
      if (!materialCode) { results.errors.push(`Row ${rowNum}: material_code is required`); continue; }

      if (existingNames.has(name.toLowerCase()) || existingCodes.has(materialCode.toLowerCase())) {
        results.skipped++;
        continue;
      }

      const packSize = Number(row.pack_size ?? 1) || 1;
      const packUnit = String(row.pack_unit ?? "g").trim() || "g";
      const description = String(row.description ?? "").trim() || null;
      const flavour = String(row.flavour ?? "").trim() || null;
      const servingQty = Number(row.serving_qty ?? 1) || 1;
      const kcalPerServing = row.kcal_per_serving != null && row.kcal_per_serving !== "" ? Number(row.kcal_per_serving) : null;
      const trialEligibleRaw = String(row.trial_eligible ?? "").trim().toLowerCase();
      const trialEligible = trialEligibleRaw === "yes" || trialEligibleRaw === "true";

      await client.query(
        `INSERT INTO ingredients (name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving, trial_eligible)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [name, packSize, packUnit, materialCode, description, flavour, servingQty, kcalPerServing, trialEligible]
      );
      existingNames.add(name.toLowerCase());
      existingCodes.add(materialCode.toLowerCase());
      results.created++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    client.release();
    res.status(500).json({ error: "Bulk item upload failed", detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  client.release();
  res.json(results);
});

// POST /api/admin/super/reset-transactional-data
// POST /api/admin/super/centers/:centerId/reset
// Selective per-center data reset. Body: { confirm: "RESET", categories: string[] }
// Valid categories: "check_ins" | "consumption" | "inventory" | "health" | "issuances" | "members"
router.post("/admin/super/centers/:centerId/reset", requireSuperAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { confirm, categories } = req.body as { confirm?: string; categories?: string[] };

  if (confirm !== "RESET") {
    res.status(400).json({ error: 'Body must include { "confirm": "RESET" } to proceed.' });
    return;
  }
  if (!Array.isArray(categories) || categories.length === 0) {
    res.status(400).json({ error: "At least one category must be selected." });
    return;
  }

  const valid = new Set(["check_ins", "consumption", "inventory", "health", "issuances", "members", "consent"]);
  const invalid = categories.filter(c => !valid.has(c));
  if (invalid.length > 0) {
    res.status(400).json({ error: `Unknown categories: ${invalid.join(", ")}` });
    return;
  }

  const cats = new Set(categories);
  const client = await pool.connect();
  const deleted: Record<string, number> = {};

  try {
    await client.query("BEGIN");

    // ── check_ins: visit selections + check-in records
    if (cats.has("check_ins")) {
      const { rowCount: vfs } = await client.query(
        `DELETE FROM visit_flavour_selections WHERE checkin_id IN (SELECT id FROM member_check_ins WHERE center_id = $1)`, [centerId]);
      const { rowCount: vis } = await client.query(
        `DELETE FROM visit_ingredient_selections WHERE checkin_id IN (SELECT id FROM member_check_ins WHERE center_id = $1)`, [centerId]);
      const { rowCount: vms } = await client.query(
        `DELETE FROM visit_menu_selections WHERE checkin_id IN (SELECT id FROM member_check_ins WHERE center_id = $1)`, [centerId]);
      const { rowCount: ci } = await client.query(
        `DELETE FROM member_check_ins WHERE center_id = $1`, [centerId]);
      deleted["check_ins"] = (vfs ?? 0) + (vis ?? 0) + (vms ?? 0) + (ci ?? 0);
    }

    // ── consumption: consumption_logs for center members
    if (cats.has("consumption")) {
      const { rowCount: cl } = await client.query(
        `DELETE FROM consumption_logs WHERE member_id IN (SELECT member_id FROM member_center_mapping WHERE center_id = $1)`, [centerId]);
      deleted["consumption"] = cl ?? 0;
    }

    // ── inventory: batches + their logs/adjustments
    if (cats.has("inventory")) {
      const { rowCount: bcl } = await client.query(
        `DELETE FROM batch_consumption_logs WHERE batch_id IN (SELECT id FROM ingredient_batches WHERE center_id = $1)`, [centerId]);
      const { rowCount: ba } = await client.query(
        `DELETE FROM batch_adjustments WHERE batch_id IN (SELECT id FROM ingredient_batches WHERE center_id = $1)`, [centerId]);
      const { rowCount: ib } = await client.query(
        `DELETE FROM ingredient_batches WHERE center_id = $1`, [centerId]);
      deleted["inventory"] = (bcl ?? 0) + (ba ?? 0) + (ib ?? 0);
    }

    // ── health: health_records for this center
    if (cats.has("health")) {
      const { rowCount: hr } = await client.query(
        `DELETE FROM health_records WHERE center_id = $1`, [centerId]);
      deleted["health"] = hr ?? 0;
    }

    // ── issuances: plan issuances + renewals for center members
    if (cats.has("issuances")) {
      const { rowCount: iss } = await client.query(
        `DELETE FROM issuances WHERE member_id IN (SELECT member_id FROM member_center_mapping WHERE center_id = $1)`, [centerId]);
      const { rowCount: ren } = await client.query(
        `DELETE FROM member_renewals WHERE member_id IN (SELECT member_id FROM member_center_mapping WHERE center_id = $1)`, [centerId]);
      // Reset membership cycle start for center members
      await client.query(
        `UPDATE members SET cycle_started_at = NULL WHERE id IN (SELECT member_id FROM member_center_mapping WHERE center_id = $1)`, [centerId]);
      deleted["issuances"] = (iss ?? 0) + (ren ?? 0);
    }

    // ── members: unlink + delete members belonging ONLY to this center
    if (cats.has("members")) {
      // Only delete members who are not mapped to any other center
      const { rowCount: mcm } = await client.query(
        `DELETE FROM member_center_mapping WHERE center_id = $1`, [centerId]);
      const { rowCount: mem } = await client.query(
        `DELETE FROM members WHERE id NOT IN (SELECT DISTINCT member_id FROM member_center_mapping)`);
      deleted["members"] = (mcm ?? 0) + (mem ?? 0);
    }

    // ── consent: reset terms_accepted_at for center and its members
    if (cats.has("consent")) {
      const { rowCount: ca } = await client.query(
        `UPDATE center_auth SET terms_accepted_at = NULL WHERE center_id = $1`, [centerId]);
      const { rowCount: ua } = await client.query(
        `UPDATE user_auth SET terms_accepted_at = NULL WHERE member_id IN (SELECT member_id FROM member_center_mapping WHERE center_id = $1)`, [centerId]);
      deleted["consent"] = (ca ?? 0) + (ua ?? 0);
    }

    await client.query("COMMIT");
    logger.info({ centerId, categories, deleted }, "Super admin reset center data selectively.");
    res.json({ success: true, centerId, categories, deleted });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, centerId }, "Selective center reset failed — rolled back.");
    res.status(500).json({ error: "Reset failed and was rolled back.", detail: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});

// ⚠️  Wipes ALL transactional data — check-ins, consumption logs, inventory batches,
//     renewals, health records, issuances, OTPs — while keeping master data intact.
//     Requires superadmin JWT AND body: { confirm: "RESET" } as a double-guard.
router.post("/admin/super/reset-transactional-data", requireSuperAdmin, async (req, res) => {

  const { confirm } = req.body as { confirm?: string };
  if (confirm !== "RESET") {
    res.status(400).json({ error: 'Body must include { "confirm": "RESET" } to proceed.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM visit_flavour_selections");
    await client.query("DELETE FROM visit_menu_selections");
    await client.query("DELETE FROM member_check_ins");
    await client.query("DELETE FROM consumption_logs");
    await client.query("DELETE FROM batch_adjustments");
    await client.query("DELETE FROM batch_consumption_logs");
    await client.query("DELETE FROM ingredient_batches");
    await client.query("DELETE FROM member_renewals");
    await client.query("DELETE FROM health_records");
    await client.query("DELETE FROM issuances");
    await client.query("DELETE FROM otps");
    await client.query("UPDATE members SET cycle_started_at = NULL");

    await client.query("COMMIT");
    logger.info("Super admin triggered transactional data reset — all transactional tables cleared.");
    res.json({ success: true, message: "All transactional data cleared. Master data preserved." });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Transactional data reset failed — rolled back.");
    res.status(500).json({ error: "Reset failed and was rolled back.", detail: err instanceof Error ? err.message : String(err) });
  } finally {
    client.release();
  }
});

// POST /api/admin/centers/:centerId/checkins/:checkinId/request-health-log
router.post("/admin/centers/:centerId/checkins/:checkinId/request-health-log", requireAdmin, async (req, res) => {
  const { centerId, checkinId } = req.params;
  const adminReq = req as AdminRequest;
  if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
  const { rows } = await pool.query(`UPDATE member_check_ins SET health_log_requested = TRUE WHERE id = $1 AND center_id = $2 RETURNING *`, [Number(checkinId), centerId]);
  if (!rows[0]) { res.status(404).json({ error: "Check-in not found" }); return; }
  res.json(rows[0]);
});

export default router;


  // --- Check-in Categories ---
  router.get("/admin/centers/:centerId/checkin-categories", requireAdmin, async (req, res) => {
    const { centerId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { rows } = await pool.query(
      `SELECT * FROM checkin_categories WHERE center_id = $1 ORDER BY display_order ASC, id ASC`,
      [centerId]
    );
    
    const { rows: mappings } = await pool.query(
      `SELECT ci.category_id, i.id as ingredient_id, i.name, i.flavour, i.serving_qty 
       FROM checkin_category_ingredients ci
       JOIN ingredients i ON i.id = ci.ingredient_id
       JOIN checkin_categories c ON c.id = ci.category_id
       WHERE c.center_id = $1`,
      [centerId]
    );

    const result = rows.map(cat => ({
      ...cat,
      ingredients: mappings.filter(m => m.category_id === cat.id)
    }));
    
    res.json(result);
  });

  router.post("/admin/centers/:centerId/checkin-categories", requireAdmin, async (req, res) => {
    const { centerId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { name, is_mandatory, display_order, ingredients } = req.body as {
      name: string; is_mandatory?: boolean; display_order?: number; ingredients?: number[];
    };
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    
    try {
      await pool.query("BEGIN");
      const { rows } = await pool.query(
        `INSERT INTO checkin_categories (center_id, name, is_mandatory, display_order) VALUES ($1, $2, $3, $4) RETURNING *`,
        [centerId, name.trim(), is_mandatory ?? true, display_order ?? 0]
      );
      const catId = rows[0].id;
      
      const mappedIngredients = [];
      if (Array.isArray(ingredients)) {
        for (const ingId of ingredients) {
          const { rows: ingRes } = await pool.query(
            `INSERT INTO checkin_category_ingredients (category_id, ingredient_id) VALUES ($1, $2) RETURNING ingredient_id`,
            [catId, ingId]
          );
          mappedIngredients.push(ingRes[0].ingredient_id);
        }
      }
      
      await pool.query("COMMIT");
      res.status(201).json({ ...rows[0], ingredients: mappedIngredients });
    } catch(e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  router.put("/admin/centers/:centerId/checkin-categories/:categoryId", requireAdmin, async (req, res) => {
    const { centerId, categoryId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { name, is_mandatory, display_order, ingredients } = req.body as {
      name?: string; is_mandatory?: boolean; display_order?: number; ingredients?: number[];
    };
    
    try {
      await pool.query("BEGIN");
      
      const updates = [];
      const values: any[] = [];
      if (name !== undefined) { updates.push(`name = $${values.length + 1}`); values.push(name.trim()); }
      if (is_mandatory !== undefined) { updates.push(`is_mandatory = $${values.length + 1}`); values.push(Boolean(is_mandatory)); }
      if (display_order !== undefined) { updates.push(`display_order = $${values.length + 1}`); values.push(Number(display_order)); }
      
      let updatedCat = null;
      if (updates.length > 0) {
        values.push(categoryId);
        values.push(centerId);
        const { rows } = await pool.query(
          `UPDATE checkin_categories SET ${updates.join(", ")} WHERE id = $${values.length - 1} AND center_id = $${values.length} RETURNING *`,
          values
        );
        if (!rows[0]) {
          await pool.query("ROLLBACK");
          res.status(404).json({ error: "Category not found" }); return;
        }
        updatedCat = rows[0];
      }
      
      if (Array.isArray(ingredients)) {
        await pool.query(`DELETE FROM checkin_category_ingredients WHERE category_id = $1`, [categoryId]);
        for (const ingId of ingredients) {
          await pool.query(
            `INSERT INTO checkin_category_ingredients (category_id, ingredient_id) VALUES ($1, $2)`,
            [categoryId, ingId]
          );
        }
      }
      
      await pool.query("COMMIT");
      res.json(updatedCat || { id: categoryId, updated: true });
    } catch(e) {
      await pool.query("ROLLBACK");
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  router.delete("/admin/centers/:centerId/checkin-categories/:categoryId", requireAdmin, async (req, res) => {
    const { centerId, categoryId } = req.params;
    const adminReq = req as AdminRequest;
    if (adminReq.adminCenterId !== centerId) { res.status(403).json({ error: "Forbidden" }); return; }
    
    const { rows } = await pool.query(
      `DELETE FROM checkin_categories WHERE id = $1 AND center_id = $2 RETURNING id`,
      [categoryId, centerId]
    );
    if (!rows[0]) { res.status(404).json({ error: "Category not found" }); return; }
    res.json({ success: true });
  });

