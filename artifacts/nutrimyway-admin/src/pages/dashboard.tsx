import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Users, UtensilsCrossed, Flame, Activity, CalendarClock, ChevronRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { Nav } from "@/components/nav";
import { apiGet, getAdminCenter, type Dashboard } from "@/lib/api";

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

            {/* ── Monthly check-in chart (full width) ── */}
            <MonthlyCheckinChart data={data.monthly_checkins} />
          </>
        ) : null}

      </main>
    </div>
  );
}
