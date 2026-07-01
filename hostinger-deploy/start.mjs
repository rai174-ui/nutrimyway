// NutriMyWay Server Diagnostic Wrapper
// This catches and logs startup errors that pino might hide in production

console.log("[STARTUP] NutriMyWay server starting...");
console.log("[STARTUP] PORT:", process.env.PORT);
console.log("[STARTUP] NODE_ENV:", process.env.NODE_ENV);
console.log("[STARTUP] DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("[STARTUP] ADMIN_STATIC:", process.env.ADMIN_STATIC);

// Timeout in case initDb hangs
const timeout = setTimeout(() => {
  console.error("[STARTUP ERROR] Server failed to start within 30 seconds. Likely database connection issue.");
  process.exit(1);
}, 30000);

try {
  await import("./index.mjs");
  clearTimeout(timeout);
  console.log("[STARTUP] Server module loaded successfully");
} catch (err) {
  clearTimeout(timeout);
  console.error("[STARTUP FATAL ERROR]");
  console.error(err.stack || err.message || String(err));
  process.exit(1);
}
