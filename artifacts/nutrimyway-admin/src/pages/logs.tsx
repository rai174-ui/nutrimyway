import { useEffect, useState } from "react";
import { ClipboardList, LogIn, LogOut, Clock } from "lucide-react";
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(min: number) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function LogsPage() {
  const center = getAdminCenter();
  const [date, setDate] = useState(todayStr());
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!center) return;
    setLoading(true);
    apiGet<CheckinLog[]>(`/admin/centers/${center.id}/checkin-logs?date=${date}`)
      .then(setLogs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [center?.id, date]);

  const activeCount = logs.filter(l => !l.checked_out_at).length;
  const completedCount = logs.filter(l => !!l.checked_out_at).length;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Visit Log</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {logs.length} visit{logs.length !== 1 ? "s" : ""} · {activeCount} active · {completedCount} completed
            </p>
          </div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground animate-pulse">
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No visits recorded</p>
            <p className="text-sm text-muted-foreground mt-1">
              {date === todayStr() ? "No check-ins today yet." : `No visits on ${date}.`}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-border bg-muted/40">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Member</span>
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
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 sm:gap-4 px-5 py-4 border-b border-border last:border-0 items-center"
                >
                  {/* Member info */}
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

                  {/* Status badge */}
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
          <p className="text-xs text-muted-foreground text-right">* Duration shown for active visits is ongoing time</p>
        )}
      </main>
    </div>
  );
}
