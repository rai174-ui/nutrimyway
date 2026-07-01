# NutriMyWay Admin Panel — Hostinger Node.js Deployment Guide

## What is this package?

This is a **pre-built, self-contained** Node.js application that runs:
- The **NutriMyWay API server** (Express backend)
- The **Admin Panel** (React frontend served as static files at `/admin`)

No build step needed on the server — just configure and run.

---

## Folder Structure

```
nutrimyway-admin-server/
├── index.mjs          ← Main server bundle (API + auth + database + storage)
├── pino-*.mjs         ← Logger worker files (auto-loaded)
├── admin/             ← Built admin panel (HTML/CSS/JS static files)
│   ├── index.html
│   └── assets/
├── data/
│   └── composition.xlsx  ← Food composition database (auto-seeded on first run)
├── package.json       ← Node.js dependencies (minimal)
├── .env.example       ← Template — copy to .env and fill your values
└── HOSTINGER_SETUP.md ← This file
```

---

## Prerequisites

1. **Hostinger Node.js Hosting** plan (or any VPS with Node.js 20+)
2. **Supabase account** (free tier works for testing)
3. **Gmail account** with an App Password (for sending emails)

---

## Step-by-Step Setup

### Step 1 — Create Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once created, go to **Project Settings → Database**.
3. Copy the **Connection string** (URI mode, Transaction pooler).
   - Looks like: `postgresql://postgres.abc123:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`
4. Save this string — you'll paste it into `.env` in Step 3.

### Step 2 — Upload to Hostinger

1. Log in to your **Hostinger hPanel**.
2. Go to **Websites → [Your Domain] → Node.js**.
3. Click **Create Application** (or **Manage** if already exists).
4. Set:
   - **Node.js version**: `20.x` or later
   - **Application root**: the folder you upload to (e.g. `/home/u123456789/domains/yourdomain.com/public_html/`)
   - **Application startup file**: `index.mjs`
   - **Environment variables**: add all values from `.env` (see Step 3)
5. Upload all files from this folder via **File Manager** or **FTP**.
   - Upload everything **except** `node_modules`.
6. Click **Create / Save**.

### Step 3 — Configure Environment Variables

In the Hostinger Node.js panel, add these environment variables:

| Variable | Example Value |
|----------|--------------|
| `PORT` | `3000` (Hostinger will usually override this) |
| `DATABASE_URL` | `postgresql://postgres.abc123:pwd@...pooler.supabase.com:6543/postgres?sslmode=require` |
| `SESSION_SECRET` | A 64-character random string |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASS` | `your-gmail-app-password` |
| `SMTP_PORT` | `587` |
| `SUPER_ADMIN_EMAIL` | `your-admin@example.com` |
| `APP_URL` | `https://yourdomain.com` |
| `ADMIN_STATIC` | `./admin` |
| `NODE_ENV` | `production` |

> **How to get Gmail App Password**: [Google Account → Security → 2-Step Verification → App passwords](https://myaccount.google.com/apppasswords)

### Step 4 — Install Dependencies

In Hostinger's terminal (or via SSH):

```bash
cd /path/to/your/app
npm install
```

This installs only 3 external packages:
- `@google-cloud/storage`
- `@google/generative-ai`
- `nodemailer`

Everything else (Express, database, routing, etc.) is **already bundled** inside `index.mjs`.

### Step 5 — Restart the Application

In Hostinger Node.js panel, click **Restart**.

The server will:
1. Connect to Supabase
2. Run all database migrations (34+ tables created automatically)
3. Seed food composition data from `data/composition.xlsx`
4. Start the Express server

---

## Verify It's Working

After restart, visit these URLs:

| URL | What to expect |
|-----|---------------|
| `https://yourdomain.com/api/healthz` | `{ "status": "ok", "db": "connected" }` |
| `https://yourdomain.com/admin` | Admin login screen |

---

## Admin Login

### Super Admin Login
- Go to `/admin`
- Click **"Super Admin Login"**
- Enter the `SUPER_ADMIN_EMAIL` you configured
- Check your email for OTP
- Enter OTP → you're in

### Center Admin Login
- Go to `/admin`
- Enter your **Center ID** and **Password**
- If your center is active, you'll log in directly

---

## First-Time Setup Checklist

After deploying:

- [ ] Visit `/admin` and log in as Super Admin
- [ ] Go to **Super Admin Dashboard** → create your first center
- [ ] Set center password
- [ ] Add members via **Bulk Upload** (download sample XLSX first)
- [ ] Add inventory via **Bulk Upload** (ingredients, menu items, BOM)
- [ ] Activate the center

---

## Important Notes

### Object Storage (Meal Photos)
The current app uses **Replit Object Storage** for meal photos. On Hostinger, this will fail. To fix:

- **Option A**: Switch to **Cloudflare R2** (free 10 GB, S3-compatible)
- **Option B**: Store photos on **local disk** and serve via Nginx
- **Option C**: Use **Supabase Storage**

This requires a small code change — ping us when you're ready.

### Database
- The app auto-runs migrations on first startup.
- The `_seed_done` table tracks whether `composition.xlsx` has been imported.
- If you ever need to re-seed: delete the `_seed_done` row and restart.

### SSL
Hostinger provides free SSL. Make sure:
- `APP_URL` uses `https://`
- Admin panel loads over HTTPS (required for modern browser features)

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "Database connection failed" | Wrong DATABASE_URL | Double-check Supabase connection string |
| "SMTP connection failed" | Wrong SMTP_PASS | Use Gmail App Password, not your Gmail password |
| Admin panel blank/404 | Wrong ADMIN_STATIC path | Set `ADMIN_STATIC=./admin` |
| OTP emails not arriving | SMTP not configured | Check SMTP_HOST/USER/PASS/PORT in env vars |
| Server won't start | Missing SESSION_SECRET | Generate a long random string |

---

## Support

For issues or questions, contact the development team with:
1. Your `APP_URL`
2. The error message from Hostinger logs
3. Your `.env` (with sensitive values redacted)
