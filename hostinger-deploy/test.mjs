// Minimal test server for Hostinger
import http from "http";
import fs from "fs";

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync("startup.log", line);
};

log("TEST SERVER STARTING");
log(`PORT env: ${process.env.PORT}`);
log(`NODE_ENV: ${process.env.NODE_ENV}`);
log(`PWD: ${process.cwd()}`);

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  log(`Request: ${req.method} ${req.url}`);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", url: req.url, time: new Date().toISOString() }));
});

server.listen(port, () => {
  log(`TEST SERVER LISTENING on port ${port}`);
});

server.on("error", (err) => {
  log(`SERVER ERROR: ${err.message}`);
  process.exit(1);
});
