# NutriMyWay Deployment Guide

## Architecture

| Component | Hosting | Domain |
|---|---|---|
| **PostgreSQL Database** | Railway | Internal (no public URL needed) |
| **API Server (Node.js)** | Railway | Railway app URL or custom domain |
| **Member App (React)** | Hostinger | `https://nutrimyway.in` |
| **Admin Panel (React)** | Hostinger | `https://nutrimyway.in/admin` |

## 1. Backend → Railway (Auto-deploy from GitHub)

### Step 1: Push code to GitHub
1. Create a GitHub repository
2. Connect your Replit project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

### Step 2: Connect Railway to GitHub
1. Go to [railway.app](https://railway.app) → your project
2. Click on your Node.js service → **Settings** → **Source**
3. Click **Connect to GitHub Repo**
4. Select your repository and branch (`main`)
5. Railway will auto-deploy on every push to `main`

### Step 3: Environment variables
Make sure these are set in Railway (Settings → Variables):
- `DATABASE_URL` → your Railway Postgres connection string
- `PORT` → `3000`
- `NODE_ENV` → `production`
- `SESSION_SECRET` → generate a long random string
- `APP_URL` → `https://nutrimyway.in`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` → for password reset emails
- `SUPER_ADMIN_EMAIL` → `rai.174@gmail.com`

### Step 4: Custom domain (optional)
If you want the API on a custom subdomain:
1. Railway Settings → Domains → Add custom domain
2. Add a CNAME record in Hostinger DNS: `api.nutrimyway.in` → Railway domain
3. Update `APP_URL` to match

## 2. Frontend → Hostinger (Auto-deploy via GitHub Actions)

### Step 1: Add GitHub secrets
In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `HOSTINGER_HOST` | Your Hostinger FTP server (e.g., `ftp.nutrimyway.in` or server IP) |
| `HOSTINGER_USERNAME` | Your Hostinger FTP/cPanel username |
| `HOSTINGER_PASSWORD` | Your Hostinger FTP/cPanel password |

> Find your FTP credentials in Hostinger → Files → FTP Accounts

### Step 2: Verify workflow
The `.github/workflows/deploy.yml` is already in your repo. It will:
1. Build both frontend apps on every push to `main`
2. Deploy them to Hostinger via FTP

### Step 3: First manual deploy (optional)
If GitHub Actions hasn't run yet, you can manually trigger it:
- GitHub → Actions → "Build and Deploy to Hostinger" → Run workflow

## 3. What happens on each push?

1. You push code to GitHub `main` branch
2. Railway sees the push → rebuilds and redeploys the API server
3. GitHub Actions sees the push → builds both frontends → deploys to Hostinger

## Troubleshooting

### Frontend shows blank page after deploy
- Check `.htaccess` files are uploaded (they enable SPA routing)
- Verify the `assets/` folder was uploaded alongside `index.html`

### API calls fail
- Check that your backend is running on Railway (Deployments tab → check logs)
- Verify `APP_URL` in Railway matches your actual domain
- Check CORS: the backend allows all origins (`app.use(cors())`), so this shouldn't be an issue

### FTP deploy fails
- Double-check `HOSTINGER_HOST`, `HOSTINGER_USERNAME`, `HOSTINGER_PASSWORD` in GitHub secrets
- Some Hostinger plans use SFTP on port 22 instead of FTP on port 21 — if so, switch to an SFTP action

## .htaccess reference

Both apps need `.htaccess` for SPA routing (already included in the build):

```apache
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

For the admin panel at `/admin`:
```apache
RewriteEngine On
RewriteBase /admin
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /admin/index.html [L]
```
