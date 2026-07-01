import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Users, UtensilsCrossed, Flame, Activity, CalendarClock, ChevronRight, Megaphone, Send, X, Loader2, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { Nav } from "@/components/nav";
import { apiGet, apiPost, apiDelete, getAdminCenter, type Dashboard, type Broadcast } from "@/lib/api";

function StatCard({
  icon: Icon, label, value, color, onClick, badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  onClick?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3 transition-all
        ${onClick ? "cursor-pointer hover:border-primary/40 hover:shadow-sm active:scale-[0.98]" : ""}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xl font-bold text-foreground leading-none">{value}</p>
          {badge}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
      </div>
      {onClick && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />}
    </div>
  );
}

function AdHocBroadcastModal({ centerId, onClose }: { centerId: string; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    apiGet<Broadcast[]>(`/admin/centers/${centerId}/broadcasts?limit=5`)
      .then(setHistory)
      .catch(() => { /* ignore */ })
      .finally(() => setLoadingHistory(false));
  }, [centerId]);

  async function handleSend() {
    if (!message.trim()) { setError("Message is required"); return; }
    setSending(true); setError(null); setSent(false);
    try {
      await apiPost<{ id: number }>(`/admin/centers/${centerId}/broadcasts`, { message: message.trim() });
      setSent(true);
      setMessage("");
      void loadHistory();
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally { setSending(false); }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const data = await apiGet<Broadcast[]>(`/admin/centers/${centerId}/broadcasts?limit=5`);
      setHistory(data);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }

  async function handleDelete(broadcastId: number) {
    setDeletingId(broadcastId);
    try {
      await apiDelete(`/admin/centers/${centerId}/broadcasts/${broadcastId}`);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally { setDeletingId(null); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-foreground">Broadcast Message</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message to all active members..."
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-sm text-emerald-700 font-medium">Broadcast sent to all members!</span>
            </div>
          )}
          <div>
            <button
              onClick={() => void handleSend()}
              disabled={sending || !message.trim()}
              className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Now
            </button>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Broadcasts</p>
            {loadingHistory ? (
              <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading...</div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No broadcasts yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map(b => (
                  <div key={b.id} className="bg-muted/40 rounded-lg px-3 py-2 text-sm flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-foreground line-clamp-2">{b.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {b.sent_by === "scheduled" ? "Scheduled" : "Manual"} · {new Date(b.sent_at).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      title="Delete broadcast"
                    >
                      {deletingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyCheckinChart({ data }: { data: { day: string; count: number }[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = now.getDate();
  const monthName = now.toLocaleString("en-IN", { month: "long" });

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const found = data.find(r => r.day.slice(0, 10) === key);
    const count = found ? Number(found.count) : 0;
    return {
      day: dayNum,
      label: String(dayNum),
      count: dayNum <= todayDate ? count : null,
    };
  });

  const maxCount = Math.max(...days.map(d => d.count ?? 0), 1);
  const yMax = maxCount + Math.ceil(maxCount * 0.2) + 1;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Member Check-ins by Day</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unique members · {monthName} {year}
          </p>
        </div>
        <Activity className="w-4 h-4 text-muted-foreground/40" />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={days} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="4 4"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={daysInMonth > 20 ? 4 : 1}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              padding: "4px 10px",
            }}
            formatter={(v: unknown) => [typeof v === "number" ? v : 0, "members"]}
            labelFormatter={(l: unknown) => `Day ${String(l)}`}
          />
          <Line
            type="linear"
            dataKey="count"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
            activeDot={{ r: 5.5, strokeWidth: 0 }}
            connectNulls={false}
          >
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 10, fill: "#374151", fontWeight: 700 }}
              formatter={(v: unknown) => (typeof v === "number" && v > 0 ? v : "")}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const center = getAdminCenter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);

  useEffect(() => {
    if (!center) return;
    apiGet<Dashboard>(`/admin/centers/${center.id}/dashboard`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [center?.id]);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{center?.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* ── Stat cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <StatCard icon={Users} label="Total Members" value={data.member_count} color="bg-teal-base" onClick={() => navigate("/members")} />
              <StatCard icon={Activity} label="Active Today" value={data.today_active_members} color="bg-teal-dark" onClick={() => navigate("/members")} />
              <StatCard icon={Flame} label="kcal Today" value={Math.round(data.today_calories).toLocaleString()} color="bg-amber-500" onClick={() => navigate("/consumption")} />
              <StatCard icon={UtensilsCrossed} label="Menu Items" value={data.menu_item_count} color="bg-teal-mid" onClick={() => navigate("/set-menu")} />
              <StatCard
                icon={CalendarClock}
                label="Expiring (10 days)"
                value={data.expiring_soon_count}
                color={data.expiring_soon_count > 0 ? "bg-amber-500" : "bg-slate-400"}
                onClick={data.expiring_soon_count > 0 ? () => navigate("/members?expiring_soon=true") : undefined}
                badge={data.expiring_soon_count > 0 ? (
                  <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">Renew Membership</span>
                ) : undefined}
              />
            </div>

            {/* ── Quick-nav cards ── */}
            <div className="grid grid-cols-3 gap-3">
              <div
                onClick={() => navigate("/set-menu")}
                className="bg-card rounded-xl border border-border px-4 py-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-4 h-4 text-teal-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Set Menu</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Food items & BOM components</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              </div>

              <div
                onClick={() => navigate("/consumption")}
                className="bg-card rounded-xl border border-border px-4 py-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                  <Flame className="w-4 h-4 text-teal-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Consumption</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Member usage by date range</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              </div>

              <div
                onClick={() => navigate("/members")}
                className="bg-card rounded-xl border border-border px-4 py-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-teal-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Members</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">Check-ins, renewals & health</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
              </div>
            </div>

            {/* ── Broadcast + Monthly check-in chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <div
                  onClick={() => setShowBroadcast(true)}
                  className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3 cursor-pointer hover:border-amber-400 hover:shadow-sm transition-all group flex items-center gap-3 h-full"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground group-hover:text-amber-700 transition-colors">Send Broadcast</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">Ad-hoc message to all members</p>
                  </div>
                  <Send className="w-3.5 h-3.5 text-amber-500/70 flex-shrink-0" />
                </div>
              </div>
              <div className="lg:col-span-2">
                <MonthlyCheckinChart data={data.monthly_checkins} />
              </div>
            </div>
          </>
        ) : null}

        {showBroadcast && center && (
          <AdHocBroadcastModal centerId={center.id} onClose={() => setShowBroadcast(false)} />
        )}
      </main>
    </div>
  );
}
