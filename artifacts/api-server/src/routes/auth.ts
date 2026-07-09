import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
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


async function sendOtpEmail(to: string, otp: string): Promise<boolean> {
  const htmlContent = `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#0d9488">Login Code</h2>
        <p>Use the following 6-digit code to log in to your NutriMyWay account:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:0.2em;color:#0d9488;padding:16px 24px;background:#f0fdfa;border-radius:8px;display:inline-block;margin:8px 0">${otp}</div>
        <p style="color:#6b7280;font-size:13px;margin-top:16px">This code expires in ${OTP_TTL_MIN} minutes.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:16px">If you did not request this code, please ignore this email.</p>
      </div>`;
  const subject = "Your NutriMyWay Login Code";

  // 1. Try SMTP first if configured
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
      logger.error({ err }, "Error sending OTP via SMTP");
      return false;
    }
  }

  // 2. Fall back to Resend if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const { data, error } = await resend.emails.send({
        from: "NutriMyWay <onboarding@resend.dev>",
        to: [to],
        subject,
        html: htmlContent,
      });

      if (error) {
        logger.warn(
          { to, error },
          "Resend API returned an error processing the email",
        );
        return false;
      }

      return true;
    } catch (err) {
      logger.error({ err }, "Error sending OTP via Resend");
      return false;
    }
  }

  // 3. Fall back to DEV MODE preview
  logger.warn({ to }, "No SMTP or RESEND_API_KEY configured — OTP email skipped");
  return false;
}

// POST /api/auth/request-otp
// Body: { email: string, membership_no: string }
router.post("/auth/request-otp", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const membershipNo =
    typeof body.membership_no === "string" ? body.membership_no.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }
  if (!membershipNo) {
    res.status(400).json({ error: "Membership number is required" });
    return;
  }

  // Find member by membership_no (unique) and verify email + validity
  const { rows: memberRows } = await pool.query(
    "SELECT id, name, email, membership_no, is_active, valid_until FROM members WHERE membership_no = $1",
    [membershipNo],
  );
  if (!memberRows[0]) {
    res
      .status(404)
      .json({
        error:
          "No member found with this membership number. Please contact your wellness center.",
      });
    return;
  }
  const member = memberRows[0] as {
    id: number;
    name: string;
    email: string | null;
    membership_no: string;
    is_active: boolean;
    valid_until: string | null;
  };
  if (!member.is_active) {
    res
      .status(403)
      .json({
        error:
          "Your membership is inactive. Please contact your wellness center.",
      });
    return;
  }
  if (member.valid_until && new Date(member.valid_until) < new Date()) {
    res
      .status(403)
      .json({
        error:
          "Your membership has expired. Please contact your wellness center to renew.",
      });
    return;
  }
  if (member.email !== email) {
    res
      .status(401)
      .json({
        error:
          "Email does not match the membership number. Please contact your wellness center.",
      });
    return;
  }

  const otp = generateOtp();
  const otpToken = generateOtpToken();

  // Invalidate any previous unused OTPs for this member
  await pool.query(
    "UPDATE otps SET used = TRUE WHERE member_id = $1 AND used = FALSE",
    [member.id],
  );
  // Store new OTP
  await pool.query(
    `INSERT INTO otps (member_id, email, otp, otp_token, expires_at) VALUES ($1,$2,$3,$4, NOW() + INTERVAL '${OTP_TTL_MIN} minutes')`,
    [member.id, email, otp, otpToken],
  );

  if (process.env.NODE_ENV === "development") {
    logger.info({ email, otp }, "DEV MODE: OTP generated");
  }

  // If no email providers are configured, use Dev Mode fallback immediately
  if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) {
    logger.warn({ email }, "No email provider configured — returning OTP preview in response");
    res.json({ message: "OTP sent", otp_token: otpToken, otp_preview: otp });
    return;
  }

  // Otherwise, send the email in the background without blocking the HTTP response.
  // This prevents the frontend from timing out if the SMTP connection is slow (e.g., Gmail on Railway).
  sendOtpEmail(email, otp).catch(err => {
    logger.error({ err, email }, "Failed to send OTP email in background");
  });

  res.json({ message: "OTP sent", otp_token: otpToken });
});

// POST /api/auth/verify-otp
// Body: { otp_token: string, otp: string }
router.post("/auth/verify-otp", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const otpToken =
    typeof body.otp_token === "string" ? body.otp_token.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";

  if (!otpToken || !otp) {
    res.status(400).json({ error: "OTP token and OTP are required" });
    return;
  }

  const { rows } = await pool.query(
    `SELECT * FROM otps
     WHERE otp_token = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [otpToken, otp],
  );
  if (!rows[0]) {
    res.status(401).json({ error: "Invalid or expired OTP" });
    return;
  }
  const otpRow = rows[0] as { id: number; member_id: number; email: string };
  await pool.query("UPDATE otps SET used = TRUE WHERE id = $1", [otpRow.id]);

  const memberId = otpRow.member_id;
  const email = otpRow.email;

  // Re-check member validity before issuing token
  const { rows: memberRows } = await pool.query(
    "SELECT is_active, valid_until FROM members WHERE id = $1",
    [memberId],
  );
  const member = memberRows[0] as
    | { is_active: boolean; valid_until: string | null }
    | undefined;
  if (!member?.is_active) {
    res
      .status(403)
      .json({
        error:
          "Your membership is inactive. Please contact your wellness center.",
      });
    return;
  }
  if (member.valid_until && new Date(member.valid_until) < new Date()) {
    res
      .status(403)
      .json({
        error:
          "Your membership has expired. Please contact your wellness center to renew.",
      });
    return;
  }

  // Ensure user_auth record exists for this member
  const { rows: authRows } = await pool.query(
    "SELECT id FROM user_auth WHERE member_id = $1",
    [memberId],
  );
  if (!authRows[0]) {
    await pool.query(
      "INSERT INTO user_auth (member_id, email, created_at) VALUES ($1,$2,NOW())",
      [memberId, email],
    );
  }

  const { rows: consentRows } = await pool.query(
    "SELECT terms_accepted_at FROM user_auth WHERE member_id = $1",
    [memberId],
  );
  const needsTermsAcceptance = !consentRows[0]?.terms_accepted_at;

  const token = signToken(memberId, email);
  res.json({
    token,
    member_id: memberId,
    needs_terms_acceptance: needsTermsAcceptance,
  });
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
