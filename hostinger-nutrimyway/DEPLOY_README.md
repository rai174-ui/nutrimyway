# NutriMyWay Hostinger Deployment Guide

## What you have

- **Member app** (`/`) — wellness member app (dashboard, meal logging, check-ins)
- **Admin panel** (`/admin`) — center admin + SuperAdmin management
- **Backend API** — runs on Hostinger (Node.js server, port 3000), connects to Railway Postgres

## Files to upload to `public_html`

Upload everything in this folder directly into your Hostinger File Manager `public_html` folder:

```
public_html/
  .htaccess
  index.html          → member app entry
  favicon.svg
  logo.png
  opengraph.jpg
  robots.txt
  assets/
    index-XXXXX.js    → member app bundle
    index-XXXXX.css   → member app styles
  admin/
    .htaccess
    index.html        → admin app entry
    favicon.svg
    logo.png
    opengraph.jpg
    robots.txt
    assets/
      index-XXXXX.js  → admin app bundle
      index-XXXXX.css → admin app styles
```

## Step-by-step

1. Open Hostinger File Manager
2. Navigate to `public_html`
3. Clear existing files (if any)
4. Upload all files from this folder
5. Ensure your Node.js API server is running and reachable at `https://nutrimyway.in/api`

## API configuration

The frontend is configured to call `/api` (relative path), so it works as long as the Node.js backend is running on the same domain and serving `/api/*` routes.

If your backend runs on a different domain, edit:
- `lib/api.ts` in the admin app
- Set `const BASE = "https://your-api-url.com/api";`

Then rebuild and redeploy.
