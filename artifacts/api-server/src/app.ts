import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "./lib/sqlite";
import { ObjectStorageService } from "./lib/objectStorage";
import { ObjectNotFoundError } from "./lib/objectStorage";
import { sendPushNotification } from "./lib/push";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Allow browser, Capacitor (Android/iOS), and dev origins
// Allow browser, Capacitor (Android/iOS), and dev origins
const ALLOWED_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
  "ionic://localhost",
  "https://nutrimyway.in",
  "https://nutrimyway-production.up.railway.app",
];

app.use(
  cors({
    origin: function (origin, cb) {
      // No origin = same-origin or server-to-server — allow
      if (!origin) return cb(null, true);

      // Allow exact matches from our list
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      // Allow local development ports (e.g., localhost:5173)
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("https://localhost:")
      ) {
        return cb(null, true);
      }

      cb(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// ── Static frontend serving ──────────────────────────────────────────────
// Railway runs this as a single service on one domain — there is no
// separate web server for static files, so this Express process must serve
// the built frontend(s) itself.
//
// Bundled layout (populated at deploy time, see `public/` next to index.mjs):
//   public/index.html, public/assets/*        → main frontend (served at "/")
//   public/admin/index.html, public/admin/*   → admin frontend (served at "/admin")
//
// ADMIN_STATIC can override the admin frontend location for local/ngrok dev.
const bundledPublicDir = path.resolve(__dirname, "public");
const adminStaticOverride = process.env.ADMIN_STATIC;
const adminDir = adminStaticOverride
  ? path.resolve(adminStaticOverride)
  : path.join(bundledPublicDir, "admin");

if (existsSync(adminDir)) {
  app.use("/admin", express.static(adminDir));
  // SPA fallback — all /admin/* routes serve index.html
  app.get("/admin/*splat", (_req, res) => {
    res.sendFile(path.join(adminDir, "index.html"));
  });
  logger.info({ adminDir }, "Serving admin static files");
} else if (adminStaticOverride) {
  logger.warn(
    { adminDir },
    "ADMIN_STATIC set but directory does not exist; skipping admin static serving",
  );
}

if (existsSync(bundledPublicDir)) {
  app.use(express.static(bundledPublicDir));
  // SPA fallback for the main frontend — must come last so it doesn't
  // shadow /api or /admin routes registered above.
  app.get("*splat", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/admin")) {
      next();
      return;
    }
    res.sendFile(path.join(bundledPublicDir, "index.html"));
  });
  logger.info({ bundledPublicDir }, "Serving main frontend static files");
}

// ── Scheduled broadcast runner ────────────────────────────────────────────

/** Check every minute and send any broadcast schedules whose time has arrived today. */
export function startBroadcastScheduler(): void {
  async function tick() {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { rows: schedules } = await pool.query(
        `SELECT id, center_id, message, schedule_time, last_sent_at
         FROM center_broadcast_schedules
         WHERE is_active = TRUE
           AND schedule_time <= $1
           AND (last_sent_at IS NULL OR last_sent_at < $2)`,
        [timeStr, todayStart.toISOString()],
      );
      for (const s of schedules as Array<{
        id: number;
        center_id: string;
        message: string;
      }>) {
        await pool.query("BEGIN");
        try {
          // Double-check inside transaction to avoid duplicate sends on race
          const { rows: fresh } = await pool.query(
            `SELECT last_sent_at FROM center_broadcast_schedules WHERE id = $1 FOR UPDATE`,
            [s.id],
          );
          const last = (fresh[0] as { last_sent_at: string | null })
            .last_sent_at;
          if (last && new Date(last) >= todayStart) {
            await pool.query("ROLLBACK");
            continue;
          }
          // Insert broadcast
          await pool.query(
            `INSERT INTO member_broadcasts (center_id, message, sent_at, sent_by)
             VALUES ($1, $2, NOW(), 'scheduled')`,
            [s.center_id, s.message],
          );
          // Mark schedule as sent today
          await pool.query(
            `UPDATE center_broadcast_schedules SET last_sent_at = NOW() WHERE id = $1`,
            [s.id],
          );
          await pool.query("COMMIT");
          logger.info(
            { scheduleId: s.id, centerId: s.center_id, time: timeStr },
            "Scheduled broadcast sent",
          );

          // Send push notification asynchronously
          pool.query(
            `SELECT push_token FROM members m
             JOIN member_center_mapping mcm ON mcm.member_id = m.id
             WHERE mcm.center_id = $1 AND m.is_active = TRUE AND m.push_token IS NOT NULL`,
            [s.center_id]
          ).then(res => {
            const tokens = res.rows.map(r => r.push_token as string);
            if (tokens.length > 0) {
              sendPushNotification(tokens, "Scheduled Broadcast", s.message).catch(err => {
                logger.error({ err }, "Failed to send scheduled broadcast push notifications");
              });
            }
          }).catch(err => logger.error({ err }, "Failed to query push tokens for scheduled broadcast"));
        } catch (err) {
          await pool.query("ROLLBACK");
          logger.error({ err, scheduleId: s.id }, "Scheduled broadcast failed");
        }
      }
    } catch (err) {
      logger.error({ err }, "Broadcast scheduler tick failed");
    }
  }

  // Run immediately on startup, then every 60s
  tick();
  setInterval(tick, 60_000);
  logger.info("Broadcast scheduler started (checking every 60s)");
}

// ── Photo cleanup scheduler ─────────────────────────────────────────────

/** Run every hour and delete meal photos older than each center's retention setting. */
export function startPhotoCleanupScheduler(): void {
  const objectStorageService = new ObjectStorageService();

  async function tick() {
    try {
      const { rows: centers } = await pool.query(
        `SELECT id, photo_retention_days FROM centers WHERE photo_retention_days IS NOT NULL`,
      );
      for (const c of centers as Array<{
        id: string;
        photo_retention_days: number;
      }>) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - c.photo_retention_days);
        const { rows: expired } = await pool.query(
          `SELECT id, photo_url
           FROM consumption_logs
           WHERE photo_url IS NOT NULL
             AND photo_uploaded_at IS NOT NULL
             AND photo_uploaded_at < $1
             AND EXISTS (
               SELECT 1 FROM member_center_mapping mcm
               WHERE mcm.member_id = consumption_logs.member_id
                 AND mcm.center_id = $2
             )`,
          [cutoff.toISOString(), c.id],
        );
        const ids: number[] = [];
        for (const row of expired as Array<{ id: number; photo_url: string }>) {
          try {
            await objectStorageService.deleteObjectEntity(row.photo_url);
            logger.info(
              { logId: row.id, photo_url: row.photo_url },
              "Deleted expired meal photo",
            );
          } catch (err) {
            if (err instanceof ObjectNotFoundError) {
              logger.info(
                { logId: row.id },
                "Photo already missing in object storage, clearing DB reference",
              );
            } else {
              logger.error(
                { err, logId: row.id },
                "Failed to delete expired meal photo, skipping",
              );
              continue;
            }
          }
          ids.push(row.id);
        }
        if (ids.length > 0) {
          await pool.query(
            `UPDATE consumption_logs SET photo_url = NULL, photo_uploaded_at = NULL WHERE id = ANY($1)`,
            [ids],
          );
        }
      }
    } catch (err) {
      logger.error({ err }, "Photo cleanup tick failed");
    }
  }

  // Run every hour
  tick();
  setInterval(tick, 60 * 60_000);
  logger.info("Photo cleanup scheduler started (checking every hour)");
}

export default app;
