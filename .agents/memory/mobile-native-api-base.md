---
name: Native/Capacitor apps need an absolute API base URL
description: Why the NutriMyWay Android app must build with a different script than the web app, and what breaks if you don't.
---

Native app builds (Capacitor/Expo) that bundle the frontend as local assets cannot use a relative API base like `/api` — the webview's origin is the local bundle, not the real backend domain, so relative fetches resolve to nothing and return the app's own `index.html` (surfacing as `Unexpected token '<', "<!DOCTYPE "... is not valid JSON"`).

**Why:** The web deployment (Railway, single-origin) and the native app (locally bundled webview) have fundamentally different origins at runtime, even though they share the same React source code.

**How to apply:** Any artifact that ships both a web build and a wrapped native build (Capacitor, Cordova, etc.) needs a separate build script that bakes in the absolute production URL (e.g. `VITE_API_BASE=https://<domain>/api`) before syncing to the native project. Don't reuse the plain web `build` script for the native package — check for a `build:mobile` (or similarly named) script before doing a Capacitor/Expo release, and verify the API base is embedded in the built JS bundle before packaging.

**Fallback domain pattern (NutriMyWay):** when a custom domain and a platform-provided domain (e.g. Railway's `*.up.railway.app`) both point at the same backend, native builds can pass a second `VITE_API_BASE_FALLBACK` env var. A shared `apiFetch()` helper tries the primary base first and retries against the fallback only on a network-level failure (`TypeError`, not HTTP error status), then remembers the working base for the session and re-points the generated API client's `setBaseUrl` so both raw fetches and generated hooks stay in sync. Web builds (no env var set) keep using a single relative `/api` candidate — no fallback logic applies there.
