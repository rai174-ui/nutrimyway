import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { apiGet, apiPost, saveAuth, isAuthenticated, type Center } from "@/lib/api";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const [centers, setCenters] = useState<Center[]>([]);
  const [centerId, setCenterId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated()) { navigate("/dashboard"); return; }
    apiGet<Center[]>("/admin/centers").then(setCenters).catch(() => {});
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!centerId || !password) return;
    setLoading(true); setError(null);
    try {
      const res = await apiPost<{ token: string; center_id: string; center_name: string }>(
        "/admin/login", { center_id: centerId, password }
      );
      saveAuth(res.token, res.center_id, res.center_name);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-dark flex items-center justify-center shadow-lg mb-3 p-2.5">
            <img src="/admin/logo.png" alt="NutriMyWay" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Center Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to manage your center</p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Center</label>
            <select
              value={centerId}
              onChange={e => setCenterId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            >
              <option value="">Select a center…</option>
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter center password"
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <p className="text-xs text-muted-foreground mt-0.5">Contact your administrator for the center password.</p>
          </div>

          {error && (
            <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!centerId || !password || loading}
            className="h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Nutrition My Way · Center Admin Panel
        </p>
        <p className="text-center text-xs mt-2">
          <a href="/admin/super" className="text-muted-foreground/60 hover:text-muted-foreground transition-colors">
            Super Admin →
          </a>
        </p>
        <p className="text-center text-[10px] text-muted-foreground/60 mt-2 pb-2">
          Powered by Zero Limit Automation
        </p>
      </div>
    </div>
  );
}
