import { useEffect, useState } from "react";
import { ClipboardList, LogIn, LogOut, Clock, Download, Calendar } from "lucide-react";
import * as XLSX from "xlsx";
import { Nav } from "@/components/nav";
import { apiGet, getAdminCenter } from "@/lib/api";

interface CheckinLog {
  id: number;
  member_id: number;
  member_name: string;
  member_mobile: string | null;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_min: number;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(min: number) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function exportToExcel(logs: CheckinLog[], from: string, to: string, centerName: string) {
  const rows = logs.map(log => ({
    "Member Name":   log.member_name,
    "Mobile":        log.member_mobile ?? "",
    "Date":          formatDate(log.checked_in_at),
    "Check In":      formatDateTime(log.checked_in_at),
    "Check Out":     log.checked_out_at ? formatDateTime(log.checked_out_at) : "",
    "Duration (min)": Math.round(log.duration_min),
    "Duration":      formatDuration(log.duration_min),
    "Status":        log.checked_out_at ? "Completed" : "Active",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r]).length)) + 2,
  }));
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Visit Log");

  const filename = `${centerName.replace(/\s+/g, "_")}_VisitLog_${from}_to_${to}.xlsx`;
  XLSX.writeFile(wb, filename);
}

const QUICK_RANGES = [
  { label: "Today",        getDates: () => { const t = todayStr(); return { from: t, to: t }; } },
  { label: "Yesterday",    getDates: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().slice(0, 10); return { from: s, to: s }; } },
  { label: "Last 7 days",  getDates: () => { const d = new Date(); d.setDate(d.getDate() - 6); return { from: d.toISOString().slice(0, 10), to: todayStr() }; } },
  { label: "Last 30 days", getDates: () => { const d = new Date(); d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0, 10), to: todayStr() }; } },
  { label: "This month",   getDates: () => { const d = new Date(); return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10), to: todayStr() }; } },
];

export default function LogsPage() {
  const center = getAdminCenter();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo]     = useState(todayStr());
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  function load() {
    if (!center) return;
    setLoading(true);
    apiGet<CheckinLog[]>(`/admin/centers/${center.id}/checkin-logs?from=${from}&to=${to}`)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [center?.id, from, to]);

  function applyQuick(idx: number) {
    const { from: f, to: t } = QUICK_RANGES[idx].getDates();
    setFrom(f); setTo(t);
  }

  function handleExport() {
    if (!center || logs.length === 0) return;
    setExporting(true);
    try {
      exportToExcel(logs, from, to, center.name);
    } finally {
      setExporting(false);
    }
  }

  const activeCount    = logs.filter(l => !l.checked_out_at).length;
  const completedCount = logs.filter(l =>  !!l.checked_out_at).length;
  const isSingleDay    = from === to;
  const rangeLabel     = isSingleDay ? from : `${from} → ${to}`;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Visit Log</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {logs.length} visit{logs.length !== 1 ? "s" : ""}
              {activeCount > 0 && ` · ${activeCount} active`}
              {completedCount > 0 && ` · ${completedCount} completed`}
              {" · "}
              <span className="font-medium text-foreground">{rangeLabel}</span>
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={logs.length === 0 || exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors self-start"
          >
            <Download className="w-4 h-4" />
            {exporting ? "Exporting…" : "Export Excel"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {QUICK_RANGES.map((r, i) => {
              const { from: f, to: t } = r.getDates();
              const active = from === f && to === t;
              return (
                <button
                  key={r.label}
                  onClick={() => applyQuick(i)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Custom range pickers */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">From</label>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={e => setFrom(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">To</label>
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={todayStr()}
                  onChange={e => setTo(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground animate-pulse">
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No visits recorded</p>
            <p className="text-sm text-muted-foreground mt-1">No check-ins found for the selected date range.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24 text-center">Date</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 text-center">Check In</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20 text-center">Check Out</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16 text-center">Duration</span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16 text-center">Status</span>
            </div>

            {logs.map(log => {
              const active = !log.checked_out_at;
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 border-b border-border last:border-0 items-center"
                >
                  {/* Member */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-teal-dark">
                        {log.member_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{log.member_name}</p>
                      {log.member_mobile && (
                        <p className="text-xs text-muted-foreground">{log.member_mobile}</p>
                      )}
                    </div>
                  </div>

                  {/* Date (shown in multi-day range) */}
                  <div className="sm:w-24 sm:text-center">
                    <span className="text-xs text-muted-foreground">{formatDate(log.checked_in_at)}</span>
                  </div>

                  {/* Check-in time */}
                  <div className="flex items-center gap-1.5 sm:justify-center sm:w-20">
                    <LogIn className="w-3.5 h-3.5 text-green-600 sm:hidden" />
                    <span className="text-sm font-medium text-green-700">{formatTime(log.checked_in_at)}</span>
                    <LogIn className="hidden sm:block w-3.5 h-3.5 text-green-600" />
                  </div>

                  {/* Check-out time */}
                  <div className="flex items-center gap-1.5 sm:justify-center sm:w-20">
                    {log.checked_out_at ? (
                      <>
                        <LogOut className="w-3.5 h-3.5 text-amber-600 sm:hidden" />
                        <span className="text-sm font-medium text-amber-700">{formatTime(log.checked_out_at)}</span>
                        <LogOut className="hidden sm:block w-3.5 h-3.5 text-amber-600" />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-1 sm:justify-center sm:w-16">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(log.duration_min)}{active ? "*" : ""}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="sm:w-16 sm:flex sm:justify-center">
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                        Done
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeCount > 0 && (
          <p className="text-xs text-muted-foreground text-right">* Duration for active visits is ongoing time</p>
        )}
      </main>
    </div>
  );
}
