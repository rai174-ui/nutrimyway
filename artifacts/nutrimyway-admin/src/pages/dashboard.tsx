import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Users, UtensilsCrossed, Flame, Activity } from "lucide-react";
import { Nav } from "@/components/nav";
import { apiGet, getAdminCenter, type Dashboard } from "@/lib/api";

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Members" value={data.member_count} color="bg-teal-base" />
            <StatCard icon={UtensilsCrossed} label="Menu Items" value={data.menu_item_count} color="bg-teal-mid" />
            <StatCard icon={Activity} label="Active Today" value={data.today_active_members} color="bg-teal-dark" />
            <StatCard icon={Flame} label="kcal Logged Today" value={Math.round(data.today_calories).toLocaleString()} color="bg-amber-500" />
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
