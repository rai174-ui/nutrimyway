# NutriMyWay — Hostinger Deploy Checklist

Tested end-to-end locally: fresh `npm install` (0 vulnerabilities), server boot, `/api/healthz` returns 200, and graceful handling even if `ADMIN_STATIC` points to a missing folder.

## 1. API (Node.js app in Hostinger)

- **Root directory:** `nutrimyway-admin-deploy/api`
- **Framework preset:** `Express` (not "Other")
- **Node version:** 20.x
- **Package manager:** npm
- **Build command:** None
- **Start command:** `node server.js` (already set via package.json `start` script)

### Required environment variables
| Variable | Value |
|---|---|
| `PORT` | set automatically by Hostinger — do not override |
| `DATABASE_URL` | your Postgres/Railway connection string |
| `SESSION_SECRET` | any long random string |
| `NODE_ENV` | `production` |

### Optional environment variables
| Variable | Purpose |
|---|---|
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` | outgoing email |
| `SUPER_ADMIN_EMAIL` | overrides default admin email |
| `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` | only if using object storage |

### Do NOT set
- `ADMIN_STATIC` — leave unset. The admin frontend is served by Apache from `public_html/admin/`, not by this Node app. (If it is set and points to a missing folder, the app now logs a warning and continues instead of crashing — but it's not needed here.)

## 2. Frontend (static hosting / public_html)

Unzip `nutrimyway-admin-deploy/frontend/` contents into your domain's `public_html/`:
- `public_html/` ← everything in `frontend/` except the `admin/` subfolder
- `public_html/admin/` ← everything in `frontend/admin/`

Both include `.htaccess` files with SPA rewrite rules already configured.

## 3. Verify after deploy

1. Visit `https://nutrimyway.in/api/healthz` → expect `{"status":"ok","db":"connected","ready":true}`
2. Visit `https://nutrimyway.in/` → main app loads
3. Visit `https://nutrimyway.in/admin/` → admin app loads
