import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "../lib/sqlite";

const router: IRouter = Router();

let dbReady = false;

// Background DB readiness probe — used by initDb in index.ts
export function setDbReady(ready: boolean): void {
  dbReady = ready;
}

router.get("/healthz", async (_req, res) => {
  let dbStatus = "unknown";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "disconnected";
  }
  res.json({
    status: dbReady && dbStatus === "connected" ? "ok" : "starting",
    db: dbStatus,
    ready: dbReady,
  });
});

export default router;
