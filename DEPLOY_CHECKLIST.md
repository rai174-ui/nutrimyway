# NutriMyWay — Hostinger Deploy Checklist

Tested end-to-end locally: fresh `npm install` (0 vulnerabilities), server boot, and all
routes verified — main frontend (`/`), admin frontend (`/admin/`), API (`/api/healthz`),
and SPA client-side routing fallbacks for both apps.

## Architecture

Hostinger's Node.js app hosting binds the **entire domain** to the Node process — there is
no separate Apache/static-file layer sitting in front of it. So this package is fully
self-contained: the Express server serves the API **and** both frontends (main + admin)
directly from a bundled `public/` folder next to the server code.

```
api/
  server.js          ← entry point (CommonJS wrapper)
  index.mjs           ← bundled Express app (zero npm deps needed at runtime)
  public/
    index.html, assets/...        ← main frontend, served at "/"
    admin/index.html, assets/...  ← admin frontend, served at "/admin"
```

## Hostinger Node.js app settings

- **Root directory:** `nutrimyway-admin-deploy/api`
- **Framework preset:** `Express`
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
| `ADMIN_STATIC` | only for local/ngrok dev — overrides where the admin frontend is served from. Leave unset on Hostinger (it uses the bundled `public/admin` folder automatically). |

## Deploy steps

1. Upload `nutrimyway-admin-deploy.zip` in the Hostinger Node.js app deploy UI.
2. Set the environment variables above.
3. Deploy / Redeploy.

## Verify after deploy

1. `https://nutrimyway.in/api/healthz` → `{"status":"ok","db":"connected","ready":true}`
   (right after a fresh restart it may briefly show `"status":"starting","ready":false` —
   that's normal, it flips to `ok` within a couple seconds once the DB connects)
2. `https://nutrimyway.in/` → main app loads
3. `https://nutrimyway.in/admin/` → admin app loads
4. Client-side routes (e.g. `https://nutrimyway.in/some/app/route`) should load the app, not 404

## Notes

- Occasional restarts in the Runtime Logs with no error (just the boot lines repeating) are
  normal — Hostinger recycles idle Node processes. As long as `/api/healthz` responds, the
  app is healthy.
- If you ever need to update the frontend or admin build, rebuild them and re-copy into
  `nutrimyway-admin-deploy/api/public/` (and `public/admin/`) before re-zipping.
