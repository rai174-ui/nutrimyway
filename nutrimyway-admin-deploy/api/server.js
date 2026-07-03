const fs = require('fs');
const http = require('http');
const path = require('path');

const logFile = path.join(__dirname, 'startup.log');
function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n';
  try { fs.appendFileSync(logFile, line); } catch(e) {}
  try { console.error(line.trim()); } catch(e) {}
}

let apiReady = false;
let loadError = null;

log('=== STARTUP ===');
log('Node: ' + process.version);
log('PORT: ' + process.env.PORT);
log('CWD: ' + process.cwd());
log('__dirname: ' + __dirname);

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
} else {
  log('.env NOT found');
}

// Check required vars
var required = ['PORT', 'DATABASE_URL', 'SESSION_SECRET'];
var missing = required.filter(function(k) { return !process.env[k]; });
if (missing.length > 0) {
  loadError = 'Missing env vars: ' + missing.join(', ');
  log('FATAL: ' + loadError);
}

var port = Number(process.env.PORT) || 3000;

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

// Load real app (bundled, zero dependencies)
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
