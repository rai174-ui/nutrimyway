import { useGetMember, getGetMemberQueryKey, useGetDailySummary, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";

const TODAY = new Date().toISOString().split('T')[0];

export function Dashboard() {
  const { memberId: MEMBER_ID } = useAuth();

  const { data: member, isLoading: loadingMember } = useGetMember(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberQueryKey(MEMBER_ID!) }
  });

  const { data: summary, isLoading: loadingSummary } = useGetDailySummary(MEMBER_ID!, { date: TODAY }, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) }
  });

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

      {/* Next Visit Card */}
      <section className="bg-teal-dark rounded-[12px] p-5 text-white shadow-none">
        <h3 className="text-sm font-medium opacity-90 mb-1">Next Center Visit</h3>
        <p className="text-lg font-semibold">No upcoming visits</p>
      </section>

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
