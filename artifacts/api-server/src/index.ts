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

// Start HTTP server FIRST to satisfy Hostinger's 3-second listen() check,
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
