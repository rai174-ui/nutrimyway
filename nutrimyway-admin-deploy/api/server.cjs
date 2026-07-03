// Hostinger Node.js startup wrapper
// Loads .env, validates env vars, then starts ESM app

const fs = require('fs');
const http = require('http');
const path = require('path');

// 1. Load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) {
      const key = t.slice(0, i).trim();
      const value = t.slice(i + 1).trim();
      if (key && !process.env[key]) process.env[key] = value;
    }
  });
}

// 2. Validate required env vars
const required = ['PORT', 'DATABASE_URL', 'SESSION_SECRET'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error('FATAL: Missing environment variables:', missing.join(', '));
  console.error('Please add them in Hostinger Dashboard > Environment variables');
  process.exit(1);
}

// 3. Start a dummy HTTP server immediately for Hostinger's health check
const port = Number(process.env.PORT) || 3000;
const dummyServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Starting...\n');
});
dummyServer.listen(port, () => {
  console.log('Hostinger health-check server on port', port);
});

// 4. Dynamically import and start the real ESM app
(async () => {
  try {
    console.log('Loading NutriMyWay API...');
    console.log('PORT:', process.env.PORT);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);

    await import('./index.mjs');

    console.log('API loaded successfully');

    dummyServer.close(() => {
      console.log('Health-check server closed, real API running');
    });
  } catch (err) {
    console.error('FATAL: Failed to start API:', err.message);
    console.error(err.stack);
  }
})();
