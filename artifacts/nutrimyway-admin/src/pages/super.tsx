import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, LogOut, RefreshCw } from "lucide-react";
import {
  isSuperAuthenticated, saveSuperAuth, clearSuperAuth, superFetch, type CenterWithStatus,
} from "@/lib/api";

function SuperLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await superFetch<{ token: string }>("/admin/super/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      saveSuperAuth(res.token);
      onLogin();
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
          <div className="w-16 h-16 rounded-2xl bg-teal-dark flex items-center justify-center shadow-lg mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all centers</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Super Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter super admin password"
              className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            <p className="text-xs text-muted-foreground mt-0.5">Password is in the server startup logs.</p>
          </div>

          {error && (
            <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <a href="/admin/login" className="hover:underline">← Back to center login</a>
        </p>
      </div>
    </div>
  );
}

function SuperDashboard({ onLogout }: { onLogout: () => void }) {
  const [centers, setCenters] = useState<CenterWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await superFetch<CenterWithStatus[]>("/admin/super/centers");
      setCenters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(center: CenterWithStatus) {
    setToggling(center.id);
    try {
      const action = center.is_active ? "deactivate" : "activate";
      const updated = await superFetch<CenterWithStatus>(`/admin/super/centers/${center.id}/${action}`, { method: "PATCH" });
      setCenters(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update center");
    } finally {
      setToggling(null);
    }
  }

  const active = centers.filter(c => c.is_active).length;
  const inactive = centers.filter(c => !c.is_active).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-teal-dark text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <ShieldCheck className="w-5 h-5" />
          <span className="font-bold text-sm tracking-tight">NutriMyWay — Super Admin</span>
          <div className="flex-1" />
          <button
            onClick={() => { clearSuperAuth(); onLogout(); }}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Center Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Activate or deactivate wellness centers</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Centers", value: centers.length, color: "text-foreground" },
            { label: "Active", value: active, color: "text-emerald-600" },
            { label: "Inactive", value: inactive, color: "text-destructive" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3 mb-4">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Center</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">ID</th>
                  <th className="text-left px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center, i) => (
                  <tr key={center.id} className={`${i < centers.length - 1 ? "border-b border-border" : ""} hover:bg-muted/20 transition-colors`}>
                    <td className="px-5 py-4 font-medium text-foreground">{center.name}</td>
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs">{center.id}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        center.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {center.is_active
                          ? <><CheckCircle2 className="w-3 h-3" />Active</>
                          : <><XCircle className="w-3 h-3" />Inactive</>
                        }
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => void toggle(center)}
                        disabled={toggling === center.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                          center.is_active
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {toggling === center.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : center.is_active ? "Deactivate" : "Activate"
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SuperPage() {
  const [authed, setAuthed] = useState(isSuperAuthenticated());
  return authed
    ? <SuperDashboard onLogout={() => setAuthed(false)} />
    : <SuperLogin onLogin={() => setAuthed(true)} />;
}
