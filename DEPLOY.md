# NutriMyWay Deployment Guide (Railway)

> Last updated: 2026-07-04

NutriMyWay runs as a **single Railway service**. One Express process serves:

| Path | What it serves |
|---|---|
| `/` | Member app (React, built by `@workspace/nutrimyway`) |
| `/admin` | Admin panel (React, built by `@workspace/nutrimyway-admin`) |
| `/api` | REST API (`@workspace/api-server`) |

There is no separate frontend host — the API server serves the built frontend
static files itself (see `artifacts/api-server/src/app.ts`). Object/photo
storage uses an S3-compatible bucket (e.g. Railway's own bucket storage, or
any other S3-compatible provider).

## 1. Create the Railway project

1. Go to [railway.app](https://railway.app) and create a new project.
2. Add a **PostgreSQL** database plugin — Railway will provision it and
   expose a `DATABASE_URL` you can reference.
3. Add a **bucket / object storage** service (Railway's S3-compatible bucket
   offering, e.g. "roomy-flask", or any other S3-compatible provider such as
   Cloudflare R2 or MinIO). You'll need its endpoint, bucket name, and
   access key pair.
4. Add a new service for the app itself, connected to your GitHub repo (see
   below).

## 2. Connect GitHub for auto-deploy

1. Push this repo to GitHub.
2. In your Railway app service → **Settings → Source**, click **Connect to
   GitHub Repo** and select this repository and branch (`main`).
3. Railway will auto-deploy on every push to `main`.

Railway picks up `railway.json` at the repo root, which defines:
- **Build**: `bash railway-build.sh` — builds both frontends (with the
  correct `BASE_PATH` for each), builds the API server bundle, then copies
  the frontend output into `artifacts/api-server/dist/public` (and
  `dist/public/admin`) so the single service can serve everything.
- **Start**: `node --enable-source-maps artifacts/api-server/dist/index.mjs`
- **Health check**: `/api/healthz`

You should not need to change build/start commands in the Railway dashboard
— they come from `railway.json`.

## 3. Environment variables

Set these in Railway (Service → Variables):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Reference your Railway Postgres plugin's connection string |
| `PORT` | Yes | Railway sets this automatically — do not override |
| `NODE_ENV` | Yes | `production` |
| `SESSION_SECRET` | Yes | Long random string; used to sign auth JWTs |
| `S3_ENDPOINT` | Yes | S3-compatible endpoint URL for your bucket |
| `S3_BUCKET` | Yes | Bucket name (e.g. `roomy-flask`) |
| `S3_ACCESS_KEY_ID` | Yes | Bucket access key |
| `S3_SECRET_ACCESS_KEY` | Yes | Bucket secret key |
| `S3_REGION` | No | Defaults to `auto`; set if your provider requires a specific region |
| `APP_URL` | No | Public URL of the app, used in emails (defaults to `http://localhost:8080`) |
| `SUPER_ADMIN_EMAIL` | No | Bootstrap super-admin email (defaults to a placeholder — set your own) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | No | For password-reset emails; emails are skipped if unset |
| `ADMIN_STATIC` | No | Local/dev override only — do not set in production |

## 4. Custom domain (optional)

Railway Settings → Domains → Add custom domain. Since this is a single
service, one domain covers the member app, admin panel, and API — no DNS
split needed.

## 5. What happens on each push?

1. You push to `main`.
2. Railway runs `railway-build.sh`: installs deps, typechecks shared libs,
   builds both frontends with their production `BASE_PATH`, builds the API
   server, and assembles everything into one deployable bundle.
3. Railway starts the bundled server, which serves `/`, `/admin`, and `/api`
   from the same process and port.

## Troubleshooting

### Frontend shows blank page after deploy
- Check the Railway build logs for the `railway-build.sh` output — confirm
  both frontend builds and the "Assembling static assets" step succeeded.
- SPA routing is handled in Express (`app.ts`), not via `.htaccess` — no
  extra web-server config is needed.

### Photo upload/download fails
- Verify `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
  are all set correctly.
- Check the service logs for `Object not found` or S3 auth errors.

### API calls fail
- Check the Railway service logs (Deployments tab).
- Confirm `DATABASE_URL` points at the Railway Postgres plugin and that the
  service can reach it (same Railway project/network).
- CORS is open by default (`app.use(cors())`), so this is rarely the cause.

### Database connection / SSL errors
- The Postgres client auto-detects Railway-hosted databases (by matching
  `rlwy.net` / `railway.app` in `DATABASE_URL`) and enables SSL automatically
  — no extra configuration needed.
