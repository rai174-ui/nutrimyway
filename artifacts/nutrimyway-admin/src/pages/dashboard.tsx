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
  const base = "bg-card rounded-2xl border border-border p-5 flex items-center gap-4 transition-all";
  const interactive = onClick
    ? "cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.98]"
    : "";
  return (
    <div className={`${base} ${interactive}`} onClick={onClick}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />}
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
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-teal-pale flex items-center justify-center">
          <Activity className="w-4.5 h-4.5 text-teal-base" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-sm">Active Members — Last 7 Days</h2>
          <p className="text-xs text-muted-foreground">Unique check-ins per day</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={days} barSize={28} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            domain={[0, max + 1]}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)/30" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              fontSize: 12,
            }}
            formatter={(v: number) => [v, "members"]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {days.map(d => (
              <Cell key={d.date} fill={d.isToday ? "var(--primary)" : "var(--teal-pale)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-teal-pale inline-block" />Previous days
        </span>
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
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{center?.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Today's overview — {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
              label="kcal Logged Today"
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
              label="Memberships Expiring (10 days)"
              value={data.expiring_soon_count}
              color={data.expiring_soon_count > 0 ? "bg-amber-500" : "bg-slate-400"}
              onClick={data.expiring_soon_count > 0 ? () => navigate("/members?expiring_soon=true") : undefined}
              badge={
                data.expiring_soon_count > 0 ? (
                  <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    Renew needed
                  </span>
                ) : undefined
              }
            />
          </div>
        ) : null}

        {data && (
          <div className="mt-6">
            <WeeklyChart data={data.weekly_checkins} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            onClick={() => navigate("/set-menu")}
            className="bg-card rounded-2xl border border-border p-6 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-teal-base" />
              </div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">Manage Set Menu</h2>
            </div>
            <p className="text-sm text-muted-foreground">Define the food items offered at your center, with BOM components and quantities for each.</p>
          </div>

          <div
            onClick={() => navigate("/consumption")}
            className="bg-card rounded-2xl border border-border p-6 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-pale flex items-center justify-center">
                <Activity className="w-5 h-5 text-teal-base" />
              </div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">Consumption Report</h2>
            </div>
            <p className="text-sm text-muted-foreground">Track component-level consumption across all center members by date range.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
