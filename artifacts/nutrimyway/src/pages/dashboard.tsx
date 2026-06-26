import { useState, useEffect } from "react";
import { useGetMember, getGetMemberQueryKey, useGetDailySummary, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Plus, LogIn, LogOut, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";

const TODAY = new Date().toISOString().split('T')[0];
const BASE = "/api";

interface CheckIn {
  id: number;
  member_id: number;
  center_id: string;
  center_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

interface Center {
  id: string;
  name: string;
}

function useActiveCheckin(memberId: number | null) {
  const [checkin, setCheckin] = useState<CheckIn | null | undefined>(undefined);

  function load() {
    if (!memberId) return;
    fetch(`${BASE}/members/${memberId}/checkin/active`)
      .then(r => r.json())
      .then(setCheckin)
      .catch(() => setCheckin(null));
  }

  useEffect(() => { load(); }, [memberId]);
  return { checkin, reload: load };
}

function useMemberCenters(memberId: number | null) {
  const [centers, setCenters] = useState<Center[]>([]);
  useEffect(() => {
    if (!memberId) return;
    fetch(`${BASE}/members/${memberId}/centers`)
      .then(r => r.json())
      .then(setCenters)
      .catch(() => {});
  }, [memberId]);
  return centers;
}

function CheckInCard({ memberId, checkin, centers, onRefresh }: {
  memberId: number;
  checkin: CheckIn | null | undefined;
  centers: Center[];
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState("");

  async function handleCheckin() {
    const cid = selectedCenter || centers[0]?.id;
    if (!cid) return;
    setBusy(true);
    try {
      await fetch(`${BASE}/members/${memberId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ center_id: cid }),
      });
      onRefresh();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  async function handleCheckout() {
    setBusy(true);
    try {
      await fetch(`${BASE}/members/${memberId}/checkout`, { method: "POST" });
      onRefresh();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  if (checkin === undefined) {
    return <div className="bg-teal-dark rounded-[12px] p-5 text-white animate-pulse h-20" />;
  }

  if (checkin) {
    const since = format(new Date(checkin.checked_in_at), "h:mm a");
    return (
      <section className="bg-teal-dark rounded-[12px] p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Checked In</p>
              <p className="text-base font-semibold leading-tight mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 opacity-70" />
                {checkin.center_name}
              </p>
              <p className="text-xs opacity-60 mt-0.5">Since {since}</p>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={busy}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Check Out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-[12px] p-5">
      <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary" />
        Check In to a Center
      </p>
      <div className="flex gap-2">
        <select
          value={selectedCenter}
          onChange={e => setSelectedCenter(e.target.value)}
          className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={handleCheckin}
          disabled={busy || centers.length === 0}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          {busy ? "..." : "Check In"}
        </button>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { memberId: MEMBER_ID } = useAuth();
  const queryClient = useQueryClient();

  const { data: member, isLoading: loadingMember } = useGetMember(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberQueryKey(MEMBER_ID!) }
  });

  const { data: summary, isLoading: loadingSummary } = useGetDailySummary(MEMBER_ID!, { date: TODAY }, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) }
  });

  const { checkin, reload: reloadCheckin } = useActiveCheckin(MEMBER_ID);
  const centers = useMemberCenters(MEMBER_ID);

  function handleCheckinChange() {
    reloadCheckin();
    queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) });
  }

  if (loadingMember || loadingSummary) {
    return <div className="p-6 text-center text-muted-foreground mt-20">Loading dashboard...</div>;
  }

  const targetCal = summary?.target_calories || 2000;
  const consumedCal = summary?.total_calories || 0;
  const progress = Math.min(consumedCal / targetCal, 1);
  const ringCircumference = 2 * Math.PI * 45;
  const ringOffset = ringCircumference - (progress * ringCircumference);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Hi, {member?.name?.split(' ')[0] || 'Member'}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMM do")}</p>
      </header>

      {/* Progress Ring Card */}
      <section className="bg-card rounded-[12px] p-6 border border-border flex items-center justify-between">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="56" cy="56" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-secondary" />
            <circle cx="56" cy="56" r="45" stroke="currentColor" strokeWidth="8" fill="transparent"
              strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} className="text-primary transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-foreground leading-none">{consumedCal.toFixed(0)}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">/ {targetCal} kcal</span>
          </div>
        </div>
        
        <div className="flex-1 ml-6 space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Protein</span>
            <span className="text-sm font-semibold">{summary?.total_protein.toFixed(1) || 0}g</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Carbs</span>
            <span className="text-sm font-semibold">{summary?.total_carbs.toFixed(1) || 0}g</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fat</span>
            <span className="text-sm font-semibold">{summary?.total_fat.toFixed(1) || 0}g</span>
          </div>
        </div>
      </section>

      {/* Check-in card */}
      {MEMBER_ID && (
        <CheckInCard
          memberId={MEMBER_ID}
          checkin={checkin}
          centers={centers}
          onRefresh={handleCheckinChange}
        />
      )}

      {/* Logs section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Today's Meals</h2>
          <Link href="/log" className="text-primary hover:text-primary/80 transition-colors">
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        <div className="space-y-3">
          {["Breakfast", "Lunch", "Snack", "Dinner"].map((slot) => {
            const logs = summary?.logs_by_slot?.[slot] || [];
            return (
              <div key={slot} className="bg-card rounded-[12px] p-4 border border-border">
                <h4 className="font-semibold text-sm mb-2">{slot}</h4>
                {logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex justify-between items-center text-sm">
                        <span className="text-foreground">{log.food_item}</span>
                        <span className="text-muted-foreground">{log.calories_kcal?.toFixed(0)} kcal</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="pt-2">
        <Link href="/log" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-md font-medium text-sm">
          <Plus className="w-4 h-4" />
          Log a Meal
        </Link>
      </div>
    </motion.div>
  );
}
