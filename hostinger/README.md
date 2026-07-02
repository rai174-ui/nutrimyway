# Zero Limit Automation Website - Hostinger Deployment Package

## Files
- `index.html` - Main entry point
- `privacy-policy.html` - Standalone privacy policy page
- `assets/` - JS and CSS bundles
- `favicon.svg` - Site icon
- `robots.txt` - Search engine instructions
- `zerolimit-logo.png` - Company logo
- `.htaccess` - Apache rewrite rules for SPA routing

## How to Upload

1. Log in to your Hostinger hPanel
2. Go to **File Manager** (under Files section)
3. Navigate to `public_html/` (for main domain) or `public_html/subdomain/` (for subdomain)
4. **Delete** any existing files (backup first if needed)
5. **Upload all files** from this folder to `public_html/`
6. Make sure `.htaccess` is uploaded (enable "Show hidden files" in File Manager)

## SPA Routing
The `.htaccess` file handles routing:
- `/` → Loads `index.html`
- `/privacy` → Loads `index.html` (React router handles it)
- `/privacy-policy.html` → Loads the standalone privacy policy page directly
- All other paths → React SPA routing

## Important Notes
- This is a static site — no server-side processing needed
- All assets are bundled and self-contained
- Google Fonts are loaded via CDN
- Contact form is frontend-only (connect to backend for email delivery)
