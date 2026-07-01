// Diagnostic server - tries to start real server but with full error capture
import http from "http";
import fs from "fs";

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync("debug.log", line);
};

log("=== DIAGNOSTIC START ===");
log(`PORT: ${process.env.PORT}`);
log(`NODE_ENV: ${process.env.NODE_ENV}`);
log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`);
log(`SESSION_SECRET present: ${!!process.env.SESSION_SECRET}`);
log(`PWD: ${process.cwd()}`);
log(`Files in dir: ${fs.readdirSync(".").join(", ")}`);

try {
  log("Importing index.mjs...");
  await import("./index.mjs");
  log("Import completed - server should be running");
} catch (err) {
  log(`IMPORT ERROR: ${err.message}`);
  log(`STACK: ${err.stack || "no stack"}`);

  // Start a fallback server so we can still see the error via HTTP
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Server failed to start",
      message: err.message,
      stack: err.stack,
      env: {
        port: process.env.PORT,
        nodeEnv: process.env.NODE_ENV,
        dbPresent: !!process.env.DATABASE_URL,
        secretPresent: !!process.env.SESSION_SECRET,
      }
    }));
  });
  server.listen(port, () => {
    log(`FALLBACK SERVER listening on ${port} - check /api/healthz for error details`);
  });
}
