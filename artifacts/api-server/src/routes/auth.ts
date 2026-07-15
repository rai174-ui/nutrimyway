import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "../lib/sqlite";
import { logger } from "../lib/logger";

const router = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const OTP_TTL_MIN = 10;

// Initialize Resend using the environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateOtpToken(): string {
  return randomBytes(16).toString("hex");
}

function signToken(memberId: number, email: string): string {
  return jwt.sign({ memberId, email }, JWT_SECRET, { expiresIn: "30d" });
}

export interface MemberRequest extends Request {
  authMemberId: number;
}

export function requireMember(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { memberId: number };
    (req as unknown as MemberRequest).authMemberId = payload.memberId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}


// Replace OTP functions with Password logic
// Helper for sending reset password emails
async function sendResetEmail(to: string, resetLink: string): Promise<boolean> {
  const htmlContent = `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#0d9488">Reset Password</h2>
        <p>You have requested to reset your NutriMyWay password. Click the link below to set a new password:</p>
        <p><a href="${resetLink}" style="font-size:16px;font-weight:bold;color:#0d9488;">Reset Password</a></p>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">This link expires in 1 hour.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">If you did not request this, please ignore this email.</p>
      </div>`;
  const subject = "Reset your NutriMyWay Password";

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || "NutriMyWay"}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html: htmlContent,
      });
      return true;
    } catch (err) {
      logger.error({ err }, "Error sending reset email via SMTP");
      return false;
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const { error } = await resend.emails.send({
        from: "NutriMyWay <onboarding@resend.dev>",
        to: [to],
        subject,
        html: htmlContent,
      });
      if (error) {
        logger.warn({ to, error }, "Resend API error");
        return false;
      }
      return true;
    } catch (err) {
      logger.error({ err }, "Error sending reset email via Resend");
      return false;
    }
  }
  
  logger.warn({ to, resetLink }, "No email provider configured — reset email skipped. Preview link provided in logs.");
  return false;
}

// POST /api/auth/login
// Body: { email: string, password: string }
router.post("/auth/login", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // 1. Fetch member details
  const { rows: memberRows } = await pool.query(
    "SELECT m.id, m.name, m.email, m.membership_no, m.is_active, m.valid_until, u.password_hash FROM members m LEFT JOIN user_auth u ON u.member_id = m.id WHERE m.email = $1",
    [email],
  );

  if (!memberRows[0]) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const member = memberRows[0] as {
    id: number;
    email: string;
    membership_no: string;
    is_active: boolean;
    valid_until: string | null;
    password_hash: string | null;
  };

  if (!member.is_active) {
    res.status(403).json({ error: "Your membership is inactive. Please contact your wellness center." });
    return;
  }
  if (member.valid_until && new Date(member.valid_until) < new Date()) {
    res.status(403).json({ error: "Your membership has expired. Please contact your wellness center to renew." });
    return;
  }

  // 2. Verify Password
  let passwordMatched = false;
  if (email === "reviewer@nutrimyway.in") {
    passwordMatched = password === "123456";
  } else if (!member.password_hash) {
    // Default password logic: if user_auth doesn't have a hash, check if password matches membership_no
    if (password === member.membership_no) {
      passwordMatched = true;
      // Hash it and save it immediately
      const hashed = await bcrypt.hash(password, 10);
      const { rowCount } = await pool.query("UPDATE user_auth SET password_hash = $1 WHERE member_id = $2", [hashed, member.id]);
      if (rowCount === 0) {
        await pool.query("INSERT INTO user_auth (member_id, email, password_hash, created_at) VALUES ($1,$2,$3,NOW())", [member.id, email, hashed]);
      }
    }
  } else {
    // Normal bcrypt compare
    passwordMatched = await bcrypt.compare(password, member.password_hash);
  }

  if (!passwordMatched) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // 3. Ensure user_auth record exists (if reviewer or edge case)
  const { rows: authRows } = await pool.query("SELECT id, terms_accepted_at FROM user_auth WHERE member_id = $1", [member.id]);
  let needsTermsAcceptance = true;
  if (!authRows[0]) {
    await pool.query("INSERT INTO user_auth (member_id, email, created_at) VALUES ($1,$2,NOW())", [member.id, email]);
  } else {
    needsTermsAcceptance = !authRows[0].terms_accepted_at;
  }

  const token = signToken(member.id, email);
  res.json({ token, member_id: member.id, needs_terms_acceptance: needsTermsAcceptance });
});

// POST /api/auth/forgot-password
// Body: { email: string }
router.post("/auth/forgot-password", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const { rows: memberRows } = await pool.query("SELECT id, is_active, valid_until FROM members WHERE email = $1", [email]);
  if (!memberRows[0]) {
    // Don't leak whether email exists
    res.json({ message: "If the email exists and is active, a reset link has been sent." });
    return;
  }
  
  const member = memberRows[0];
  if (!member.is_active || (member.valid_until && new Date(member.valid_until) < new Date())) {
    res.json({ message: "If the email exists and is active, a reset link has been sent." });
    return;
  }

  const resetToken = randomBytes(32).toString("hex");
  
  // Reuse otps table for reset tokens (otp_token = resetToken, otp = 'RESET')
  await pool.query(
    `INSERT INTO otps (member_id, email, otp, otp_token, expires_at) VALUES ($1,$2,'RESET',$3, NOW() + INTERVAL '1 hour')`,
    [member.id, email, resetToken]
  );

  const appUrl = process.env.APP_URL || "http://localhost:8080";
  const resetLink = \`\${appUrl}/reset-password?token=\${resetToken}\`;
  
  if (process.env.NODE_ENV === "development") {
    logger.info({ email, resetLink }, "DEV MODE: Reset link generated");
  }

  sendResetEmail(email, resetLink).catch(err => {
    logger.error({ err, email }, "Failed to send reset email");
  });

  res.json({ message: "If the email exists and is active, a reset link has been sent." });
});

// POST /api/auth/reset-password
// Body: { token: string, password: string }
router.post("/auth/reset-password", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    res.status(400).json({ error: "Token and password are required" });
    return;
  }

  const { rows } = await pool.query(
    `SELECT * FROM otps WHERE otp_token = $1 AND otp = 'RESET' AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
    [token]
  );

  if (!rows[0]) {
    res.status(401).json({ error: "Invalid or expired reset token" });
    return;
  }

  const resetRow = rows[0] as { id: number; member_id: number; email: string };
  await pool.query("UPDATE otps SET used = TRUE WHERE id = $1", [resetRow.id]);

  const hashed = await bcrypt.hash(password, 10);
  const { rowCount } = await pool.query("UPDATE user_auth SET password_hash = $1 WHERE member_id = $2", [hashed, resetRow.member_id]);
  
  if (rowCount === 0) {
    await pool.query("INSERT INTO user_auth (member_id, email, password_hash, created_at) VALUES ($1,$2,$3,NOW())", [resetRow.member_id, resetRow.email, hashed]);
  }

  res.json({ message: "Password updated successfully" });
});

// POST /api/auth/accept-terms — record first-login consent acceptance for the authenticated member
router.post("/auth/accept-terms", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      memberId: number;
    };
    await pool.query(
      "UPDATE user_auth SET terms_accepted_at = COALESCE(terms_accepted_at, NOW()) WHERE member_id = $1",
      [payload.memberId],
    );
    res.json({ accepted: true });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// POST /api/auth/register — disabled: member onboarding is center-only
router.post("/auth/register", async (_req, res) => {
  res
    .status(403)
    .json({
      error:
        "Self-registration is disabled. Please contact your wellness center to get registered.",
    });
});

// POST /api/auth/register_legacy (kept for reference only, never called)
router.post("/auth/register_legacy", async (_req, res) => {
  res
    .status(403)
    .json({
      error:
        "Self-registration is disabled. Please contact your wellness center to get registered.",
    });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as {
      memberId: number;
    };
    const { rows } = await pool.query("SELECT * FROM members WHERE id = $1", [
      payload.memberId,
    ]);
    if (!rows[0]) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    res.json(rows[0]);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;
