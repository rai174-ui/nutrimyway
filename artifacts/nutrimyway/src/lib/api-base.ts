import { setBaseUrl } from "@workspace/api-client-react";

function normalize(url: string): string {
  return url.replace(/\/+$/, "");
}

const RAW_PRIMARY = import.meta.env.VITE_API_BASE as string | undefined;
const RAW_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK as string | undefined;

// In the web build (no VITE_API_BASE set) the API lives on the same origin,
// so a single relative "/api" candidate is correct and no fallback applies.
// In the native (Capacitor) build, VITE_API_BASE is an absolute URL to the
// primary domain, and VITE_API_BASE_FALLBACK — if provided — is tried next
// when the primary domain is unreachable.
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

function activateBase(base: string): void {
  if (base === activeBase) return;
  activeBase = base;
  setBaseUrl(base === "/api" ? null : base);
}

/**
 * Fetch a relative API path, trying the primary base first and falling back
 * to the secondary base (if configured) on network failure. Once a base
 * succeeds, it becomes the active base for this call and for the generated
 * `@workspace/api-client-react` hooks (via `setBaseUrl`) until it fails again.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const ordered = [activeBase, ...CANDIDATES.filter((c) => c !== activeBase)];
  let lastErr: unknown;

  for (const base of ordered) {
    try {
      const res = await fetch(`${base}${path}`, init);
      activateBase(base);
      return res;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      lastErr = err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Network request failed. Please check your connection.");
}

/**
 * Call once at app startup. Ensures the generated API hooks use the primary
 * base immediately, then (for native builds with a fallback configured)
 * probes reachability in the background so the hooks can switch to the
 * fallback before the user hits a broken screen.
 */
export function initApiBase(): void {
  setBaseUrl(CANDIDATES[0] === "/api" ? null : CANDIDATES[0]);
  if (CANDIDATES.length > 1) {
    void apiFetch("/healthz").catch(() => {
      /* both bases unreachable; subsequent real requests will surface errors */
    });
  }
}
