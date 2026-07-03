# Manual Deployment Guide for NutriMyWay

## What you need
- Your Hostinger File Manager access
- This takes 5 minutes each time you deploy

## Step 1: Build locally in Replit

Open the **Shell** in Replit and run:

```bash
# Build member app
PORT=8080 BASE_PATH=/ pnpm --filter @workspace/nutrimyway run build

# Build admin panel
BASE_PATH=/admin pnpm --filter @workspace/nutrimyway-admin run build
```

## Step 2: Download the built files

After the builds complete, right-click these folders in the Replit file explorer and download them:

- `artifacts/nutrimyway/dist/public/` → download as ZIP
- `artifacts/nutrimyway-admin/dist/public/` → download as ZIP

## Step 3: Upload to Hostinger

### For the Member App (nutrimyway.in/):
1. Open Hostinger File Manager → `public_html/`
2. **Delete everything** in `public_html/` except `.htaccess` (if it exists)
3. Extract the member app ZIP and upload ALL files to `public_html/`
4. Upload this `.htaccess` file to `public_html/`:

```apache
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

### For the Admin Panel (nutrimyway.in/admin/):
1. In Hostinger File Manager, create folder `public_html/admin/`
2. Extract the admin ZIP and upload ALL files to `public_html/admin/`
3. Upload this `.htaccess` file to `public_html/admin/`:

```apache
RewriteEngine On
RewriteBase /admin
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /admin/index.html [L]
```

## Step 4: Test

- https://nutrimyway.in → Member app
- https://nutrimyway.in/admin → Admin panel

## API Server Note

Your Node.js API must be running on Hostinger (port 3000) with this Apache proxy in `public_html/.htaccess`:

```apache
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^api/(.*)$ http://localhost:3000/api/$1 [P,L]
```

Or configure your API to use a subdomain like `api.nutrimyway.in`

## Done!

Every time you make code changes:
1. Run the two build commands in Replit Shell
2. Download the two ZIPs
3. Upload to Hostinger File Manager
4. Done — 5 minutes total
