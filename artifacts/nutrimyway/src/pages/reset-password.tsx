import { useState, useEffect } from "react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { apiFetch } from "@/lib/api-base";
import { useLocation } from "wouter";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try { const d = await res.json() as { error?: string }; msg = d.error ?? msg; } catch { /* html body */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function ResetPassword() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
    } else {
      setError("Invalid or missing reset token.");
    }
  }, []);

  const canSubmit = password.length >= 4 && !loading && !!token;

  async function handleReset() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost<{ message: string }>("/auth/reset-password", {
        token,
        password,
      });
      setSuccess(true);
      setTimeout(() => setLocation("/login"), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      <div className="relative h-56 bg-teal-dark flex-shrink-0 flex flex-col items-center justify-end pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute top-8 -left-12 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-28 h-28 rounded-full bg-background" />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg mb-1 p-2">
          <img src="logo.png" alt="NutriMyWay" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-6 pt-10 pb-8">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold">Set New Password</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {success ? "Password updated!" : "Choose a new password for your account."}
            </p>
          </div>

          {!success ? (
            <>
              <div className="space-y-2">
                <label htmlFor="password-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> New Password
                </label>
                <input
                  id="password-input"
                  type="password"
                  placeholder="At least 4 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canSubmit && handleReset()}
                  className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              {error && (
                <div className="bg-destructive/8 border border-destructive/20 rounded-[10px] px-4 py-3">
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              <button
                onClick={handleReset}
                disabled={!canSubmit}
                className="w-full h-13 flex items-center justify-center gap-1 rounded-[12px] bg-primary text-primary-foreground text-[15px] font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Update Password <ArrowRight className="w-4 h-4 ml-1.5" /></>}
              </button>
            </>
          ) : (
            <div className="text-center p-6 bg-primary/10 rounded-[12px] border border-primary/20">
              <p className="text-primary font-medium">Redirecting to login...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
