import { Router, type Request, type Response } from "express";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "../lib/logger";
import { pool } from "../lib/sqlite";

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

router.post("/contact", async (req: Request, res: Response) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    res.status(400).json({ error: "Name, email, and message are required." });
    return;
  }

  // Save to database first so we never lose a lead
  try {
    await pool.query(
      "INSERT INTO inquiries (name, email, message) VALUES ($1, $2, $3)",
      [name, email, message]
    );
  } catch (err) {
    logger.error({ err }, "Failed to save inquiry to database");
  }

  const subject = `New Inquiry from ${name}`;
  const htmlContent = `<div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#0d9488">New Website Inquiry</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <blockquote style="border-left: 4px solid #0d9488; padding-left: 16px; color: #4b5563;">
          ${message.replace(/\n/g, "<br>")}
        </blockquote>
      </div>`;

  const to = process.env.INQUIRY_TO_EMAIL || "support@nutrimyway.com";

  let sent = false;
  let smtpError: any = null;
  let resendError: any = null;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_PORT === "465",
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || "NutriMyWay"}" <${process.env.SMTP_USER}>`,
        replyTo: email,
        to,
        subject,
        html: htmlContent,
      });
      sent = true;
    } catch (err: any) {
      smtpError = err?.message || String(err);
      logger.error({ err }, "Error sending inquiry email via SMTP");
    }
  }

  if (!sent && process.env.RESEND_API_KEY) {
    try {
      const { error } = await resend.emails.send({
        from: "NutriMyWay <onboarding@resend.dev>",
        replyTo: email,
        to: [to],
        subject,
        html: htmlContent,
      });
      if (error) {
        resendError = error.message || String(error);
        logger.warn({ to, error }, "Resend API error");
      } else {
        sent = true;
      }
    } catch (err: any) {
      resendError = err?.message || String(err);
      logger.error({ err }, "Error sending inquiry email via Resend");
    }
  }

  if (!sent) {
    const errorDetails = [
      smtpError ? `SMTP Error: ${smtpError}` : null,
      resendError ? `Resend Error: ${resendError}` : null
    ].filter(Boolean).join(" | ");
    
    logger.warn({ to, subject, smtpError, resendError }, "No email provider configured or failed — inquiry email skipped.");
    res.status(500).json({ error: `Failed to send email. ${errorDetails || "No valid email configuration found."}` });
    return;
  }

  res.json({ success: true });
});

export default router;
