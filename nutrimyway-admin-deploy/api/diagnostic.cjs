const http = require('http');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'diagnostic.log');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  try { console.error(line.trim()); } catch(e) {}
}

log('=== DIAGNOSTIC v1 ===');
log('Node: ' + process.version);
log('PORT env: ' + process.env.PORT);
log('CWD: ' + process.cwd());
log('__dirname: ' + __dirname);
log('Files in __dirname:');
try {
  fs.readdirSync(__dirname).forEach(f => log('  ' + f));
} catch(e) {
  log('  ERROR listing: ' + e.message);
}

const port = Number(process.env.PORT) || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK - Node ' + process.version + ' on port ' + port + '\n');
});
server.listen(port, () => {
  log('LISTENING on port ' + port);
});
