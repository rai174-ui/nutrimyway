import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "./lib/sqlite";

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
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

// Serve the built admin frontend when ADMIN_STATIC is set (local / ngrok mode)
const adminStatic = process.env.ADMIN_STATIC;
if (adminStatic) {
  const adminDir = path.resolve(adminStatic);
  app.use("/admin", express.static(adminDir));
  // SPA fallback — all /admin/* routes serve index.html
  app.get("/admin/*splat", (_req, res) => {
    res.sendFile(path.join(adminDir, "index.html"));
  });
  logger.info({ adminDir }, "Serving admin static files");
}

// ── Scheduled broadcast runner ────────────────────────────────────────────

/** Check every minute and send any broadcast schedules whose time has arrived today. */
export function startBroadcastScheduler(): void {
  async function tick() {
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { rows: schedules } = await pool.query(
        `SELECT id, center_id, message, schedule_time, last_sent_at
         FROM center_broadcast_schedules
         WHERE is_active = TRUE
           AND schedule_time = $1
           AND (last_sent_at IS NULL OR last_sent_at < $2)`,
        [timeStr, todayStart.toISOString()]
      );
      for (const s of schedules as Array<{ id: number; center_id: string; message: string }>) {
        await pool.query("BEGIN");
        try {
          // Double-check inside transaction to avoid duplicate sends on race
          const { rows: fresh } = await pool.query(
            `SELECT last_sent_at FROM center_broadcast_schedules WHERE id = $1 FOR UPDATE`,
            [s.id]
          );
          const last = (fresh[0] as { last_sent_at: string | null }).last_sent_at;
          if (last && new Date(last) >= todayStart) {
            await pool.query("ROLLBACK");
            continue;
          }
          // Insert broadcast
          await pool.query(
            `INSERT INTO member_broadcasts (center_id, message, sent_at, sent_by)
             VALUES ($1, $2, NOW(), 'scheduled')`,
            [s.center_id, s.message]
          );
          // Mark schedule as sent today
          await pool.query(
            `UPDATE center_broadcast_schedules SET last_sent_at = NOW() WHERE id = $1`,
            [s.id]
          );
          await pool.query("COMMIT");
          logger.info({ scheduleId: s.id, centerId: s.center_id, time: timeStr }, "Scheduled broadcast sent");
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

export default app;
