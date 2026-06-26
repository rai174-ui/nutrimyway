import { Router } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../lib/sqlite";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const OTP_TTL_MIN = 10;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function signToken(memberId: number, mobile: string): string {
  return jwt.sign({ memberId, mobile }, JWT_SECRET, { expiresIn: "30d" });
}

// POST /api/auth/request-otp
router.post("/auth/request-otp", async (req, res) => {
  const { mobile } = req.body as { mobile?: string };
  if (!mobile || !/^\d{7,15}$/.test(mobile.replace(/\s+/g, ""))) {
    res.status(400).json({ error: "Valid mobile number required" });
    return;
  }
  const clean = mobile.replace(/\s+/g, "");
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
  // invalidate old OTPs for this number
  await pool.query("UPDATE otps SET used = TRUE WHERE mobile = $1 AND used = FALSE", [clean]);
  await pool.query("INSERT INTO otps (mobile, otp, expires_at) VALUES ($1,$2,$3)", [clean, otp, expiresAt]);
  // In production send SMS; for now return otp_preview for demo
  res.json({ message: "OTP sent", otp_preview: otp });
});

// POST /api/auth/verify-otp
router.post("/auth/verify-otp", async (req, res) => {
  const { mobile, otp } = req.body as { mobile?: string; otp?: string };
  if (!mobile || !otp) { res.status(400).json({ error: "mobile and otp required" }); return; }
  const clean = mobile.replace(/\s+/g, "");

  const { rows } = await pool.query(
    `SELECT * FROM otps WHERE mobile = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [clean, otp]
  );
  if (!rows[0]) { res.status(401).json({ error: "Invalid or expired OTP" }); return; }
  await pool.query("UPDATE otps SET used = TRUE WHERE id = $1", [rows[0].id]);

  // Check if user_auth record exists
  const { rows: authRows } = await pool.query("SELECT * FROM user_auth WHERE mobile = $1", [clean]);
  if (authRows[0]?.member_id) {
    const token = signToken(authRows[0].member_id, clean);
    res.json({ token, member_id: authRows[0].member_id, is_new_user: false });
    return;
  }

  // Check if a member with this mobile exists (pre-seeded)
  const { rows: memberRows } = await pool.query("SELECT * FROM members WHERE mobile = $1", [clean]);
  if (memberRows[0]) {
    await pool.query(
      "INSERT INTO user_auth (mobile, member_id) VALUES ($1,$2) ON CONFLICT (mobile) DO UPDATE SET member_id = $2",
      [clean, memberRows[0].id]
    );
    const token = signToken(memberRows[0].id, clean);
    res.json({ token, member_id: memberRows[0].id, is_new_user: false });
    return;
  }

  // New user — return partial token without member_id so they can complete registration
  const partialToken = jwt.sign({ mobile: clean, pending: true }, JWT_SECRET, { expiresIn: "30m" });
  res.json({ token: partialToken, member_id: null, is_new_user: true });
});

// POST /api/auth/register  — complete new-user onboarding
router.post("/auth/register", async (req, res) => {
  const { token, name, center_ids } = req.body as {
    token?: string; name?: string; center_ids?: string[];
  };
  if (!token || !name || !center_ids?.length) {
    res.status(400).json({ error: "token, name, and at least one center_id required" });
    return;
  }
  let payload: { mobile: string; pending: boolean };
  try {
    payload = jwt.verify(token, JWT_SECRET) as typeof payload;
    if (!payload.pending) throw new Error("not a registration token");
  } catch {
    res.status(401).json({ error: "Invalid or expired registration token" });
    return;
  }
  const { mobile } = payload;

  // Check not already registered
  const { rows: existing } = await pool.query("SELECT * FROM user_auth WHERE mobile = $1", [mobile]);
  if (existing[0]?.member_id) {
    const fullToken = signToken(existing[0].member_id, mobile);
    res.json({ token: fullToken, member_id: existing[0].member_id });
    return;
  }

  // Create member row
  const { rows: memberRows } = await pool.query(
    "INSERT INTO members (name, mobile) VALUES ($1,$2) RETURNING *",
    [name, mobile]
  );
  const memberId = memberRows[0].id;

  // Ensure centers exist and link them
  for (const cid of center_ids) {
    await pool.query("INSERT INTO centers (id, name) VALUES ($1,$1) ON CONFLICT DO NOTHING", [cid]);
    await pool.query(
      "INSERT INTO member_center_mapping (member_id, center_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [memberId, cid]
    );
  }

  await pool.query(
    "INSERT INTO user_auth (mobile, member_id) VALUES ($1,$2) ON CONFLICT (mobile) DO UPDATE SET member_id = $2",
    [mobile, memberId]
  );

  const fullToken = signToken(memberId, mobile);
  res.status(201).json({ token: fullToken, member_id: memberId });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { memberId: number; mobile: string };
    const { rows } = await pool.query("SELECT * FROM members WHERE id = $1", [payload.memberId]);
    if (!rows[0]) { res.status(404).json({ error: "Member not found" }); return; }
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
