# Zero Limit Automation Website - Hostinger Deployment Guide

## Overview
This is a static React website that can be deployed to any web hosting service. This guide covers deploying to Hostinger specifically.

---

## Prerequisites
- Hostinger hosting account (any shared hosting plan works)
- Domain name (e.g., zerolimitautomation.com) connected to Hostinger
- File Manager access in Hostinger hPanel

---

## Step 1: Download the Deployment Package

1. Download `zerolimit-website-hostinger.tar.gz` from this project
2. Extract it on your computer:
   - **Windows**: Use 7-Zip or WinRAR
   - **Mac**: Double-click the file
   - **Linux**: Run `tar -xzf zerolimit-website-hostinger.tar.gz`

You should see a `hostinger/` folder containing:
```
hostinger/
  ├── .htaccess              # Apache rewrite rules
  ├── README.md              # Quick reference
  ├── assets/                # JS and CSS bundles
  ├── favicon.svg            # Website icon
  ├── index.html             # Main entry point
  ├── privacy-policy.html    # Standalone privacy policy
  ├── robots.txt             # Search engine instructions
  └── zerolimit-logo.png     # Company logo
```

---

## Step 2: Log in to Hostinger

1. Go to [https://www.hostinger.com](https://www.hostinger.com) and log in
2. Click on **Websites** in the top menu
3. Select your website/domain

---

## Step 3: Open File Manager

1. In hPanel, find **Files** section on the left sidebar
2. Click **File Manager**
3. A new tab opens with the file manager interface

---

## Step 4: Navigate to public_html

1. In File Manager, you see a folder tree on the left
2. Click on `public_html/` (this is where your website files live)
3. **Important**: If you have existing files here, **back them up first**:
   - Select all files
   - Click **Download** (or compress to a zip first)
   - Save the backup to your computer

---

## Step 5: Upload the Website Files

### Method A: Upload via File Manager (Recommended)

1. Make sure you're inside `public_html/`
2. Click the **Upload** button (top right)
3. Select all files from the extracted `hostinger/` folder:
   - `.htaccess`
   - `index.html`
   - `privacy-policy.html`
   - `favicon.svg`
   - `robots.txt`
   - `zerolimit-logo.png`
   - The entire `assets/` folder
4. Wait for upload to complete

### Method B: Upload via FTP (Alternative)

1. Use an FTP client like FileZilla
2. Connect with your Hostinger FTP credentials (found in hPanel → FTP Accounts)
3. Navigate to `public_html/`
4. Upload all files from the `hostinger/` folder

---

## Step 6: Verify .htaccess is Present

The `.htaccess` file is **critical** for the website to work properly. It's a hidden file.

1. In File Manager, click **Settings** (gear icon)
2. Check **Show hidden files (dotfiles)**
3. Look for `.htaccess` in the file list
4. If missing, create it:
   - Click **New File** → Name it `.htaccess`
   - Copy this content:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^.*$ /index.html [L,QSA]
```

5. Save the file

---

## Step 7: Test the Website

1. Open your browser
2. Visit your domain: `https://yourdomain.com`
3. You should see the Zero Limit Automation homepage

### Test these pages:
- **Homepage**: `https://yourdomain.com/`
- **Privacy Policy (React route)**: `https://yourdomain.com/privacy`
- **Privacy Policy (standalone HTML)**: `https://yourdomain.com/privacy-policy.html`
- **Footer links**: Scroll down and click Quick Links

---

## Step 8: Set Up HTTPS (SSL)

Hostinger provides free SSL certificates.

1. In hPanel, go to **Websites** → Select your domain
2. Click **SSL** in the left sidebar
3. Click **Install** next to the free SSL option
4. Wait a few minutes for SSL to activate
5. Test: Visit `https://yourdomain.com` — the lock icon should appear

---

## Step 9: Update DNS (If Using External Domain)

If your domain is registered elsewhere (GoDaddy, Namecheap, etc.):

1. Update your domain's nameservers to Hostinger's:
   - `ns1.dns-parking.com`
   - `ns2.dns-parking.com`
2. Wait 24-48 hours for DNS propagation
3. Or use A records pointing to your Hostinger IP address

---

## Step 10: Update App Privacy Policy URL

For Google Play Store compliance:

1. Copy your live privacy policy URL:
   - `https://yourdomain.com/privacy-policy.html`
   - Or: `https://yourdomain.com/privacy`
2. Log in to [Google Play Console](https://play.google.com/console)
3. Go to your app → **Store presence** → **Main store listing**
4. Find **Privacy policy** field
5. Paste your URL and save

---

## Troubleshooting

### Page shows "404 Not Found"
- `.htaccess` file is missing → Re-upload it
- Apache mod_rewrite is disabled → Contact Hostinger support

### Page shows blank/white screen
- JavaScript is disabled → Enable it in browser settings
- Check browser console for errors (F12 → Console tab)
- Assets folder might not be uploaded → Re-upload `assets/`

### Images not loading
- `zerolimit-logo.png` might be missing → Re-upload it
- Check file permissions (should be 644 for files, 755 for folders)

### Privacy Policy page shows "404"
- Try the standalone HTML version: `/privacy-policy.html`
- Or the React route: `/privacy` (requires `.htaccess`)

### Fonts not loading
- Google Fonts are loaded via CDN → Check internet connection
- Some countries block Google → Use a VPN or font fallback

---

## Updating the Website Later

When you make changes to the website:

1. Rebuild the project in this Replit workspace
2. Download the new deployment package
3. Upload to Hostinger File Manager
4. Overwrite existing files

---

## Support

For Hostinger-specific issues:
- Hostinger Knowledge Base: [https://support.hostinger.com](https://support.hostinger.com)
- Live Chat: Available in hPanel

For website-specific issues:
- Check the canvas preview in this Replit workspace
- Review the source files in `artifacts/zerolimit-website/`
