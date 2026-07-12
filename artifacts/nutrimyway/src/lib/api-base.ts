import { setBaseUrl } from "@workspace/api-client-react";

function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}

const RAW_PRIMARY = import.meta.env.VITE_API_BASE as string | undefined;
const RAW_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK as string | undefined;

// In the web build (no VITE_API_BASE set) the API lives on the same origin,
// so a single relative "/api" candidate is correct and no fallback applies.
// In the native (Capacitor) build, VITE_API_BASE is an absolute URL to the
// primary domain (including /api suffix, e.g. https://example.com/api), and
// VITE_API_BASE_FALLBACK is tried next when the primary is unreachable.
const CANDIDATES: string[] = RAW_PRIMARY
  ? [normalize(RAW_PRIMARY), ...(RAW_FALLBACK ? [normalize(RAW_FALLBACK)] : [])]
  : ["/api"];

let activeBase: string = CANDIDATES[0];

export function getApiBase(): string {
  return activeBase;
}

function isNetworkError(err: unknown): boolean {
  // Browsers/WebViews throw a TypeError ("Failed to fetch" / "Network
  // request failed") for DNS failures, refused connections, and timeouts.
  // HTTP error statuses (4xx/5xx) resolve normally and should not fall back.
  return err instanceof TypeError;
}

// ---------------------------------------------------------------------------
// customFetch base URL helper
//
// apiFetch paths do NOT include an /api prefix (e.g. "/members/2/checkin/active")
// so activeBase must include /api: "https://example.com/api"
//
// The generated API client (customFetch) builds URLs WITH an /api prefix
// (e.g. "/api/members/2"). If we pass the same base to setBaseUrl, the final
// URL becomes "https://example.com/api/api/members/2" — double /api → 404.
//
// Fix: strip the /api suffix from the base before passing to setBaseUrl so
// customFetch gets "https://example.com" and resolves to the correct URL.
// ---------------------------------------------------------------------------
function toCustomFetchBase(base: string): string | null {
  if (base === "/api") return null; // web build — use relative paths (no base)
  // Strip trailing /api added by VITE_API_BASE convention
  return base.replace(/\/api$/, "");
}

function activateBase(base: string): void {
  if (base === activeBase) return;
  activeBase = base;
  setBaseUrl(toCustomFetchBase(base));
}

// ---------------------------------------------------------------------------
// Auth token helper
//
// apiFetch is a plain fetch wrapper used for direct API calls in components.
// It does not go through customFetch, so it must add the Authorization header
// itself. Reading from localStorage is safe here — the same key is used by
// auth-context.tsx ("nmw_auth").
// ---------------------------------------------------------------------------
function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem("nmw_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch a relative API path (WITHOUT /api prefix, e.g. "/members/2/checkin/active"),
 * trying the primary base first and falling back to the secondary base (if configured)
 * on network failure. Automatically attaches the stored Bearer token.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const ordered = [activeBase, ...CANDIDATES.filter((c) => c !== activeBase)];
  let lastErr: unknown;

  for (const base of ordered) {
    try {
      const res = await fetch(`${base}${path}`, { ...init, headers });
      
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("text/html")) {
        throw new Error("API returned HTML. Ensure VITE_API_BASE is correctly configured (use pnpm run build:mobile).");
      }

      if (res.status === 401) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }

      activateBase(base);
      return res;
    } catch (err) {
      if (!isNetworkError(err) && !(err instanceof Error && err.message.includes("API returned HTML"))) throw err;
      lastErr = err;
    }
  }

  throw lastErr ?? new Error("Unable to connect to the server. Please check your internet connection and try again.");
}

/**
 * Call once at app startup. Ensures the generated API hooks use the correct
 * base URL immediately (stripping /api suffix to avoid double-prefix), then
 * probes reachability in the background so the hooks can switch to the
 * fallback before the user hits a broken screen.
 */
export function initApiBase(): void {
  setBaseUrl(toCustomFetchBase(CANDIDATES[0]));
  if (CANDIDATES.length > 1) {
    void apiFetch("/healthz").catch(() => {
      /* both bases unreachable; subsequent real requests will surface errors */
    });
  }
}
