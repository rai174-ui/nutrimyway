import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { BarChart3, Calendar, Users, Package, FileDown, Archive } from "lucide-react";
import { Nav } from "@/components/nav";
import { apiGet, getAdminCenter, type ConsumptionReport, type ConsumptionLog, type IngredientBatch } from "@/lib/api";

function today() { return new Date().toISOString().slice(0, 10); }

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

function exportItemsXlsx(data: ConsumptionReport) {
  const rows = data.by_component.map(c => ({
    Ingredient: c.ingredient,
    Unit: c.unit,
    "Total Qty": Number(c.total_quantity),
    "Members": c.member_count,
    "Log Entries": c.log_count,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "By Item");
  XLSX.writeFile(wb, `consumption-by-item-${data.from}-to-${data.to}.xlsx`);
}

function exportMembersXlsx(data: ConsumptionReport, logs: ConsumptionLog[]) {
  const rows = logs.map(l => ({
    Member: l.member_name,
    "Menu Item": l.menu_item_name ?? "Self-logged",
    "Food Item": l.food_item,
    Slot: l.meal_slot,
    "Qty (g)": l.quantity_g ?? "",
    "kcal": l.calories_kcal ? Math.round(l.calories_kcal) : "",
    Date: new Date(l.logged_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "By Member");
  XLSX.writeFile(wb, `consumption-by-member-${data.from}-to-${data.to}.xlsx`);
}

function exportConsumedBatchesXlsx(batches: IngredientBatch[]) {
  const rows = batches.map(b => ({
    Ingredient: b.ingredient_name,
    "Batch #": b.batch_number,
    "Pack Size": b.pack_size,
    Unit: b.pack_unit,
    "Total Consumed": Number(b.consumed_qty),
    "Opened Date": b.opened_at ? new Date(b.opened_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
    "Consumed Date": b.consumed_at ? new Date(b.consumed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consumed Batches");
  XLSX.writeFile(wb, `consumed-batches-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConsumptionPage() {
  const center = getAdminCenter();
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [data, setData] = useState<ConsumptionReport | null>(null);
  const [consumedBatches, setConsumedBatches] = useState<IngredientBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "members" | "batches">("items");

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

  useEffect(() => { void load(); }, [load]);

  // Load consumed batches once (all-time, not date-filtered)
  useEffect(() => {
    if (!center) return;
    setBatchesLoading(true);
    apiGet<IngredientBatch[]>(`/admin/centers/${center.id}/ingredient-batches`)
      .then(all => setConsumedBatches(all.filter(b => b.status === "consumed")))
      .finally(() => setBatchesLoading(false));
  }, [center?.id]);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Consumption Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Center-issued meals only — meals logged outside by members are not included</p>
        </div>

        {/* Date range filters — only relevant for components + logs tabs */}
        {tab !== "batches" && (
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
        )}

        {/* Summary cards — date-filtered tabs only */}
        {data && tab !== "batches" && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Package className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{data.by_component.length}</p>
                <p className="text-xs text-muted-foreground">Items Consumed</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{new Set(data.logs.map(l => l.member_id)).size}</p>
                <p className="text-xs text-muted-foreground">Members Served</p>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Calendar className="w-5 h-5 text-teal-base" />
              </div>
              <div>
                <p className="text-xl font-bold">{data.logs.length}</p>
                <p className="text-xs text-muted-foreground">Meals Issued</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab bar + Export button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
            {(["items", "members", "batches"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t === "items" ? "Consumption by Items" : t === "members" ? "Consumption by Members" : (
                  <span className="flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5" />
                    Consumed Batches
                    {consumedBatches.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold">{consumedBatches.length}</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Per-tab export button */}
          {tab === "items" && data && data.by_component.length > 0 && (
            <button onClick={() => exportItemsXlsx(data)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs font-medium transition-colors">
              <FileDown className="w-3.5 h-3.5" />
              Export Excel
            </button>
          )}
          {tab === "members" && data && data.logs.length > 0 && (
            <button onClick={() => exportMembersXlsx(data, data.logs)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs font-medium transition-colors">
              <FileDown className="w-3.5 h-3.5" />
              Export Excel
            </button>
          )}
          {tab === "batches" && consumedBatches.length > 0 && (
            <button onClick={() => exportConsumedBatchesXlsx(consumedBatches)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs font-medium transition-colors">
              <FileDown className="w-3.5 h-3.5" />
              Export Excel
            </button>
          )}
        </div>

        {/* ── Tab content ── */}

        {tab === "items" && (
          loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : !data || data.by_component.length === 0 ? (
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
        )}

        {tab === "members" && (
          loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : !data || data.logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No center-issued logs</p>
              <p className="text-sm mt-1">No meals were issued via check-in for the selected period</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Menu Item</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Food Logged</th>
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
                      <td className="px-5 py-3 text-sm">
                        {log.menu_item_name
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-pale text-teal-dark">{log.menu_item_name}</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700">Direct flavour</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-sm text-foreground">{log.food_item}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{log.meal_slot}</td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums">
                        {log.quantity_g != null ? log.quantity_g : <span className="text-muted-foreground/40 text-xs">N/A</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums">
                        {log.calories_kcal != null ? Math.round(log.calories_kcal) : <span className="text-muted-foreground/40 text-xs">N/A</span>}
                      </td>
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

        {tab === "batches" && (
          batchesLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-card border border-border animate-pulse" />)}
            </div>
          ) : consumedBatches.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No consumed batches yet</p>
              <p className="text-sm mt-1">Batches marked as emptied will appear here</p>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ingredient</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Batch #</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pack Size</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Consumed</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opened</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {consumedBatches.map(b => (
                    <tr key={b.id} className="border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-foreground">{b.ingredient_name}</td>
                      <td className="px-5 py-3 font-mono text-sm text-muted-foreground">{b.batch_number}</td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums text-muted-foreground">
                        {b.pack_size} <span className="text-xs">{b.pack_unit}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right tabular-nums font-semibold text-foreground">
                        {Number(b.consumed_qty).toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{b.pack_unit}</span>
                      </td>
                      <td className="px-5 py-3 text-sm text-right text-muted-foreground">{fmt(b.opened_at)}</td>
                      <td className="px-5 py-3 text-sm text-right text-slate-600 font-medium">{fmt(b.consumed_at)}</td>
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
