import app, { startBroadcastScheduler, startPhotoCleanupScheduler } from "./app";
import { logger } from "./lib/logger";
import { initDb } from "./lib/sqlite";
import { setDbReady } from "./routes/health";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Fail fast on missing object storage configuration in production (Railway)
// so a misconfigured deploy never reports "healthy" and only fails later
// when a photo upload/download route is hit.
if (process.env["NODE_ENV"] === "production") {
  const requiredStorageVars = [
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ];
  const missing = requiredStorageVars.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required object storage environment variable(s): ${missing.join(", ")}. ` +
        `Configure the S3-compatible bucket credentials (S3_ENDPOINT, S3_BUCKET, ` +
        `S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY) before starting the server in production.`,
    );
  }
}

// Start HTTP server FIRST so Railway's health check sees a live port quickly,
// then initialize database and schedulers in the background.
const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

initDb()
  .then(() => {
    setDbReady(true);
    startBroadcastScheduler();
    startPhotoCleanupScheduler();
    logger.info("Database initialized, schedulers started");
  })
  .catch((err) => {
    logger.error({ err }, "Failed to initialize database");
    // Keep server running so the error is visible in logs; don't exit.
  });
