"use strict";

/**
 * CommonJS entry point for Hostinger's Node.js hosting.
 *
 * The actual application (artifacts/api-server) is built as a bundled ESM
 * file (index.mjs) with esbuild. Hostinger's Passenger-style launcher expects
 * a CommonJS entry point (server.js / app.js), so this file just logs basic
 * startup diagnostics and then dynamically imports the real ESM bundle.
 */

const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "startup.log");

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // ignore logging failures (read-only fs, etc.)
  }
}

log(`Booting nutrimyway-api. Node ${process.version}, cwd=${process.cwd()}, dirname=${__dirname}`);
log(`PORT=${process.env.PORT || "(unset)"} NODE_ENV=${process.env.NODE_ENV || "(unset)"}`);
log(`DATABASE_URL set: ${Boolean(process.env.DATABASE_URL)}`);

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT EXCEPTION: ${err && err.stack ? err.stack : err}`);
});

process.on("unhandledRejection", (err) => {
  log(`UNHANDLED REJECTION: ${err && err.stack ? err.stack : err}`);
});

import(path.join(__dirname, "index.mjs"))
  .then(() => {
    log("index.mjs loaded successfully.");
  })
  .catch((err) => {
    log(`FATAL: failed to load index.mjs: ${err && err.stack ? err.stack : err}`);
    process.exitCode = 1;
  });
