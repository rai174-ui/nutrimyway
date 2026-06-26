import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/sqlite";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const OTP_TTL_MIN = 10;

type ContactKind = "mobile" | "email";

interface ContactInfo {
  kind: ContactKind;
  value: string;
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signToken(memberId: number, contact: ContactInfo): string {
  return jwt.sign({ memberId, [contact.kind]: contact.value }, JWT_SECRET, { expiresIn: "30d" });
}

function parseContact(body: Record<string, unknown>): ContactInfo | null {
  const mobile = typeof body.mobile === "string" ? body.mobile.replace(/\s+/g, "") : null;
  const email  = typeof body.email  === "string" ? body.email.trim().toLowerCase()  : null;

  if (mobile && /^\d{7,15}$/.test(mobile)) return { kind: "mobile", value: mobile };
  if (email  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: "email", value: email };
  return null;
}

// POST /api/auth/request-otp
router.post("/auth/request-otp", async (req, res) => {
  const contact = parseContact(req.body as Record<string, unknown>);
  if (!contact) {
    res.status(400).json({ error: "A valid mobile number or email address is required" });
    return;
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

  if (contact.kind === "mobile") {
    await pool.query("UPDATE otps SET used = TRUE WHERE mobile = $1 AND used = FALSE", [contact.value]);
    await pool.query("INSERT INTO otps (mobile, otp, expires_at) VALUES ($1,$2,$3)", [contact.value, otp, expiresAt]);
  } else {
    await pool.query("UPDATE otps SET used = TRUE WHERE email = $1 AND used = FALSE", [contact.value]);
    await pool.query("INSERT INTO otps (email, otp, expires_at) VALUES ($1,$2,$3)", [contact.value, otp, expiresAt]);
  }

  // In production: send SMS / email. For demo, return otp_preview.
  res.json({ message: "OTP sent", otp_preview: otp });
});

// POST /api/auth/verify-otp
router.post("/auth/verify-otp", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const contact = parseContact(body);
  const otp = typeof body.otp === "string" ? body.otp.trim() : null;

  if (!contact || !otp) {
    res.status(400).json({ error: "Contact (mobile or email) and OTP are required" });
    return;
  }

  const col = contact.kind;
  const { rows } = await pool.query(
    `SELECT * FROM otps WHERE ${col} = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [contact.value, otp]
  );
  if (!rows[0]) { res.status(401).json({ error: "Invalid or expired OTP" }); return; }
  await pool.query("UPDATE otps SET used = TRUE WHERE id = $1", [rows[0].id]);

  // Check user_auth record
  const { rows: authRows } = await pool.query(
    `SELECT * FROM user_auth WHERE ${col} = $1`, [contact.value]
  );
  if (authRows[0]?.member_id) {
    const token = signToken(authRows[0].member_id, contact);
    res.json({ token, member_id: authRows[0].member_id, is_new_user: false });
    return;
  }

  // Check pre-seeded member
  const { rows: memberRows } = await pool.query(
    `SELECT * FROM members WHERE ${col} = $1`, [contact.value]
  );
  if (memberRows[0]) {
    await pool.query(
      `INSERT INTO user_auth (${col}, member_id) VALUES ($1,$2)
       ON CONFLICT (${col}) DO UPDATE SET member_id = $2`,
      [contact.value, memberRows[0].id]
    );
    const token = signToken(memberRows[0].id, contact);
    res.json({ token, member_id: memberRows[0].id, is_new_user: false });
    return;
  }

  // New user — partial token
  const partialToken = jwt.sign(
    { [col]: contact.value, pending: true },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
  res.json({ token: partialToken, member_id: null, is_new_user: true });
});

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const { token, name, center_ids } = req.body as {
    token?: string; name?: string; center_ids?: string[];
  };
  if (!token || !name || !center_ids?.length) {
    res.status(400).json({ error: "token, name, and at least one center_id required" });
    return;
  }

  let payload: { mobile?: string; email?: string; pending: boolean };
  try {
    payload = jwt.verify(token, JWT_SECRET) as typeof payload;
    if (!payload.pending) throw new Error("not a registration token");
  } catch {
    res.status(401).json({ error: "Invalid or expired registration token" });
    return;
  }

  const contact: ContactInfo = payload.email
    ? { kind: "email", value: payload.email }
    : { kind: "mobile", value: payload.mobile! };

  const col = contact.kind;

  // Already registered?
  const { rows: existing } = await pool.query(
    `SELECT * FROM user_auth WHERE ${col} = $1`, [contact.value]
  );
  if (existing[0]?.member_id) {
    const fullToken = signToken(existing[0].member_id, contact);
    res.json({ token: fullToken, member_id: existing[0].member_id });
    return;
  }

  // Create member
  const { rows: memberRows } = await pool.query(
    `INSERT INTO members (name, ${col}) VALUES ($1,$2) RETURNING *`,
    [name.trim(), contact.value]
  );
  const memberId = memberRows[0].id;

  // Link centers
  for (const cid of center_ids) {
    await pool.query("INSERT INTO centers (id, name) VALUES ($1,$1) ON CONFLICT DO NOTHING", [cid]);
    await pool.query(
      "INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [memberId, cid]
    );
  }

  await pool.query(
    `INSERT INTO user_auth (${col}, member_id) VALUES ($1,$2)
     ON CONFLICT (${col}) DO UPDATE SET member_id = $2`,
    [contact.value, memberId]
  );

  const fullToken = signToken(memberId, contact);
  res.status(201).json({ token: fullToken, member_id: memberId });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { memberId: number };
    const { rows } = await pool.query("SELECT * FROM members WHERE id = $1", [payload.memberId]);
    if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
