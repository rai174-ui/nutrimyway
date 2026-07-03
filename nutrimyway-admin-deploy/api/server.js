/* eslint-disable */
const fs = require('fs');
const http = require('http');
const path = require('path');

const logFile = path.join(__dirname, 'startup.log');
function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  try { console.error(line.trim()); } catch(e) {}
}

log('=== STARTUP ===');
log('Node: ' + process.version);
log('PORT env: ' + process.env.PORT);
log('CWD: ' + process.cwd());
log('Script: ' + __filename);
log('Dir contents:');
try {
  fs.readdirSync(__dirname).forEach(function(f) { log('  ' + f); });
} catch(e) { log('  err: ' + e.message); }

// Load .env
var envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(function(line) {
    var t = line.trim();
    if (!t || t.charAt(0) === '#') return;
    var i = t.indexOf('=');
    if (i > 0) {
      var key = t.slice(0, i).trim();
      var val = t.slice(i + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  });
  log('.env loaded');
}

// Check env
var required = ['PORT', 'DATABASE_URL', 'SESSION_SECRET'];
var missing = required.filter(function(k) { return !process.env[k]; });
if (missing.length > 0) {
  log('FATAL missing: ' + missing.join(', '));
}

var port = Number(process.env.PORT) || 3000;
var apiReady = false;
var loadError = null;

// Start HTTP server immediately
var server = http.createServer(function(req, res) {
  if (req.url === '/api/healthz') {
    res.writeHead(apiReady ? 200 : 503, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({status: apiReady ? 'ok' : 'loading', error: loadError}));
    return;
  }
  if (req.url === '/api/startup-debug') {
    var content = '';
    try { content = fs.readFileSync(logFile, 'utf8'); } catch(e) {}
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(content || 'No logs');
    return;
  }
  if (!apiReady) {
    res.writeHead(503, {'Content-Type': 'text/plain'});
    res.end('Loading... Error: ' + (loadError || 'none'));
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(port, function() {
  log('HTTP listening on ' + port);
});

// Try to load real app
if (!missing.length) {
  setTimeout(function() {
    log('Loading index.mjs...');
    import('./index.mjs').then(function() {
      apiReady = true;
      log('index.mjs OK');
    }).catch(function(err) {
      loadError = err.message;
      log('index.mjs FAILED: ' + err.message);
      log(err.stack || 'no stack');
    });
  }, 100);
}
