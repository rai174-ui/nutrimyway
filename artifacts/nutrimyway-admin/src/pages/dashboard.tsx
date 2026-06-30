import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Users, UtensilsCrossed, Flame, Activity, CalendarClock, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
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
        <Icon className="w-4.5 h-4.5 text-white" />
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

function WeeklyChart({ data }: { data: { day: string; count: number }[] }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toLocaleDateString("en-CA");
    const dayLabel = d.toLocaleDateString("en-IN", { weekday: "short" });
    const existing = data.find(r => r.day.slice(0, 10) === key);
    return { day: dayLabel, date: key, count: existing ? Number(existing.count) : 0, isToday: i === 6 };
  });
  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-teal-base flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Active Members</p>
          <p className="text-[10px] text-muted-foreground">Last 7 days</p>
        </div>
      </div>
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} barSize={22} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              domain={[0, max + 1]}
            />
            <Tooltip
              cursor={{ fill: "rgba(0,0,0,0.04)" }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 11,
                padding: "4px 8px",
              }}
              formatter={(v: number) => [v, "members"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {days.map(d => (
                <Cell key={d.date} fill={d.isToday ? "var(--primary)" : "#e2f0ee"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Nav />
      <main className="flex-1 flex flex-col gap-3 px-4 py-3 overflow-hidden max-w-6xl mx-auto w-full">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{center?.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Stat cards — 5 in a row on desktop, 2+3 on mobile */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-4 h-16 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <StatCard
              icon={Users}
              label="Total Members"
              value={data.member_count}
              color="bg-teal-base"
              onClick={() => navigate("/members")}
            />
            <StatCard
              icon={Activity}
              label="Active Today"
              value={data.today_active_members}
              color="bg-teal-dark"
              onClick={() => navigate("/members")}
            />
            <StatCard
              icon={Flame}
              label="kcal Today"
              value={Math.round(data.today_calories).toLocaleString()}
              color="bg-amber-500"
              onClick={() => navigate("/consumption")}
            />
            <StatCard
              icon={UtensilsCrossed}
              label="Menu Items"
              value={data.menu_item_count}
              color="bg-teal-mid"
              onClick={() => navigate("/set-menu")}
            />
            <StatCard
              icon={CalendarClock}
              label="Expiring (10 days)"
              value={data.expiring_soon_count}
              color={data.expiring_soon_count > 0 ? "bg-amber-500" : "bg-slate-400"}
              onClick={data.expiring_soon_count > 0 ? () => navigate("/members?expiring_soon=true") : undefined}
              badge={
                data.expiring_soon_count > 0 ? (
                  <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
                    Renew
                  </span>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {/* Bottom section: chart + quick links */}
        {data && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-3 min-h-0">

            {/* Weekly chart — takes 3 columns */}
            <div className="lg:col-span-3 bg-card rounded-xl border border-border p-4 min-h-0">
              <WeeklyChart data={data.weekly_checkins} />
            </div>

            {/* Quick nav links — takes 2 columns */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div
                onClick={() => navigate("/set-menu")}
                className="flex-1 bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-teal-base" />
                  </div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">Set Menu</p>
                </div>
                <p className="text-xs text-muted-foreground">Define food items, BOM components, and quantities for your center.</p>
              </div>

              <div
                onClick={() => navigate("/consumption")}
                className="flex-1 bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                    <Activity className="w-4 h-4 text-teal-base" />
                  </div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">Consumption Report</p>
                </div>
                <p className="text-xs text-muted-foreground">Track component-level consumption across all members by date range.</p>
              </div>

              <div
                onClick={() => navigate("/members")}
                className="flex-1 bg-card rounded-xl border border-border p-4 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-pale flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-teal-base" />
                  </div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">Members</p>
                </div>
                <p className="text-xs text-muted-foreground">Manage check-ins, renewals, health records, and member profiles.</p>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
