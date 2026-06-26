import { useState, useEffect, useCallback } from "react";
import { BarChart3, Calendar, Users, Package } from "lucide-react";
import { Nav } from "@/components/nav";
import { apiGet, getAdminCenter, type ConsumptionReport } from "@/lib/api";

function today() { return new Date().toISOString().slice(0, 10); }

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function ConsumptionPage() {
  const center = getAdminCenter();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<ConsumptionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"components" | "logs">("components");

  const load = useCallback(async () => {
    if (!center) return;
    setLoading(true);
    try {
      const res = await apiGet<ConsumptionReport>(
        `/admin/centers/${center.id}/consumption?from=${from}&to=${to}`
      );
      setData(res);
    } finally { setLoading(false); }
  }, [center?.id, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Consumption Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Track BOM component usage across all center members</p>
        </div>

        {/* Date range filters */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-9 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="flex gap-2">
            {[
              { label: "Today", f: today(), t: today() },
              { label: "This week", f: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })(), t: today() },
              { label: "This month", f: today().slice(0, 7) + "-01", t: today() },
            ].map(({ label, f, t }) => (
              <button key={label} onClick={() => { setFrom(f); setTo(t); }}
                className={`h-9 px-3 rounded-xl text-xs font-medium border transition-colors ${
                  from === f && to === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Package className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{data.by_component.length}</p>
                <p className="text-xs text-muted-foreground">BOM Components Used</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{new Set(data.logs.map(l => l.member_id)).size}</p>
                <p className="text-xs text-muted-foreground">Members Active</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Calendar className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{data.logs.length}</p>
                <p className="text-xs text-muted-foreground">Total Log Entries</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-muted rounded-xl p-1 w-fit">
          {(["components", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}>
              {t === "components" ? "By Component" : "All Logs"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : !data ? null : tab === "components" ? (
          data.by_component.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No consumption data</p>
              <p className="text-sm mt-1">No menu-item-matched logs found for {formatDate(from)}{from !== to ? ` – ${formatDate(to)}` : ""}</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredient</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Qty</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_component.map((c, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{c.ingredient}</td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums">
                        {Number(c.total_quantity).toFixed(1)} <span className="text-muted-foreground">{c.unit}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground tabular-nums">{c.member_count}</td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground tabular-nums">{c.log_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          data.logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No logs</p>
              <p className="text-sm mt-1">No consumption logs for the selected period</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Food Item</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slot</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Qty (g)</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">kcal</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map(log => (
                    <tr key={log.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{log.member_name}</td>
                      <td className="px-5 py-3 text-sm text-foreground">{log.food_item}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{log.meal_slot}</td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums">{log.quantity_g ?? "–"}</td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums">{log.calories_kcal ? Math.round(log.calories_kcal) : "–"}</td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground">
                        {new Date(log.logged_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>
    </div>
  );
}
