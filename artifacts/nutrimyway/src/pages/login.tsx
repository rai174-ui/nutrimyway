import { useState } from "react";
import { ArrowRight, Loader2, Mail, Lock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const canSubmit = isValidEmail(email) && password.length > 0 && !loading;

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const d = await apiPost<{ token: string; member_id: number; needs_terms_acceptance?: boolean }>("/auth/login", {
        email: cleanEmail,
        password: password,
      });
      login(d.token, d.member_id, d.needs_terms_acceptance ?? false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top decorative band */}
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
            <h1 className="text-2xl font-bold">Member Login</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your email and password</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="email-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Email Address
            </label>
            <input
              id="email-input"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handleLogin()}
              className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Password
            </label>
            <input
              id="password-input"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && handleLogin()}
              className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <p className="text-[11px] text-muted-foreground">
              Your default password is your membership number (e.g. NMW-12345).
            </p>
          </div>

          {error && <ErrorBanner msg={error} />}

          <PrimaryButton onClick={handleLogin} disabled={!canSubmit} loading={loading}>
            Login <ArrowRight className="w-4 h-4 ml-1.5" />
          </PrimaryButton>

          <button
            onClick={() => setLocation("/forgot-password")}
            className="text-center text-sm text-primary font-medium hover:underline underline-offset-2"
          >
            Forgot password?
          </button>
        </div>
      </div>
      <p className="text-center pb-2 tracking-wide text-[18px] text-ring">
        Nutrition My Way
      </p>
      <div className="text-center pb-6 text-[10px] text-muted-foreground/60 flex flex-col items-center gap-1">
        <span>Powered by Nutrition My Way</span>
        <a href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
      </div>
    </div>
  );
}

function PrimaryButton({
  children, onClick, disabled, loading,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-13 flex items-center justify-center gap-1 rounded-[12px] bg-primary text-primary-foreground text-[15px] font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-destructive/8 border border-destructive/20 rounded-[10px] px-4 py-3">
      <span className="text-sm text-destructive">{msg}</span>
    </div>
  );
}
