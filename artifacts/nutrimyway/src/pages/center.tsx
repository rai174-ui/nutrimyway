import { useGetHealthRecords, getGetHealthRecordsQueryKey, useGetMemberCenters, getGetMemberCentersQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { MapPin, Activity, Stethoscope } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const MEMBER_ID = 1;

export function Center() {
  const { data: records } = useGetHealthRecords(MEMBER_ID, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetHealthRecordsQueryKey(MEMBER_ID) }
  });

  const { data: centers } = useGetMemberCenters(MEMBER_ID, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberCentersQueryKey(MEMBER_ID) }
  });

  const latestRecord = records?.[0];
  const chartData = [...(records || [])].reverse().slice(-6).map(r => ({
    date: format(new Date(r.recorded_at), "MMM d"),
    weight: r.weight_kg
  }));

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Health Center</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {centers?.map(c => (
          <div key={c.id} className="bg-teal-pale text-teal-dark border border-teal-light px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {c.name}
          </div>
        ))}
      </div>

      <section className="bg-card rounded-[12px] p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Latest Vitals</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="text-lg font-semibold">{latestRecord?.weight_kg?.toFixed(1) || '--'} kg</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">BMI</p>
            <p className="text-lg font-semibold">{latestRecord?.bmi?.toFixed(1) || '--'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Resting HR</p>
            <p className="text-lg font-semibold">{latestRecord?.resting_hr || '--'} bpm</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Recorded</p>
            <p className="text-sm font-medium pt-1">
              {latestRecord ? format(new Date(latestRecord.recorded_at), "MMM d, yyyy") : '--'}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-card rounded-[12px] p-5 border border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Weight Trend</h2>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={['dataMin - 2', 'dataMax + 2']} hide />
              <YAxis dataKey="date" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={45} />
              <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Visit History</h2>
        <div className="space-y-2">
          {records?.map(r => (
            <div key={r.id} className="bg-card border border-border p-4 rounded-[12px] flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">Center Visit</p>
                <p className="text-xs text-muted-foreground">{format(new Date(r.recorded_at), "MMM d, yyyy")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{r.weight_kg?.toFixed(1)} kg</p>
              </div>
            </div>
          ))}
          {(!records || records.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No records found.</p>
          )}
        </div>
      </section>
    </motion.div>
  );
}
