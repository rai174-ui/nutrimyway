import {
  useGetHealthRecords,
  getGetHealthRecordsQueryKey,
  useGetMemberCenters,
  getGetMemberCentersQueryKey,
  useCreateHealthRecord,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { MapPin, Activity, Stethoscope, Plus, X, ChevronDown, LogIn, LogOut, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";

interface CheckinLog {
  id: number;
  center_id: string;
  center_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
  duration_min: number;
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

interface VitalsForm {
  recorded_at: string;
  center_id: string;
  weight_kg: string;
  body_fat_pct: string;
  visceral_fat: string;
  bmr: string;
  bmi: string;
  metabolic_age: string;
  muscle_mass_kg: string;
  resting_hr: string;
  notes: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function NumField({
  id, label, placeholder, value, onChange,
}: { id: string; label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11"
      />
    </div>
  );
}

export function Center() {
  const { memberId: MEMBER_ID } = useAuth();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chartMetric, setChartMetric] = useState<"weight" | "body_fat" | "muscle">("weight");
  const [form, setForm] = useState<VitalsForm>({
    recorded_at: todayStr(),
    center_id: "",
    weight_kg: "", body_fat_pct: "", visceral_fat: "",
    bmr: "", bmi: "", metabolic_age: "",
    muscle_mass_kg: "", resting_hr: "", notes: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: records } = useGetHealthRecords(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetHealthRecordsQueryKey(MEMBER_ID!) },
  });
  const { data: centers } = useGetMemberCenters(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberCentersQueryKey(MEMBER_ID!) },
  });
  const createRecord = useCreateHealthRecord();

  const { data: checkinLogs } = useQuery<CheckinLog[]>({
    queryKey: ["checkin-logs", MEMBER_ID],
    queryFn: async () => {
      const base = import.meta.env.VITE_API_BASE || "/api";
      const res = await fetch(`${base}/members/${MEMBER_ID}/checkin-logs`);
      if (!res.ok) throw new Error("Failed to load visit history");
      return res.json() as Promise<CheckinLog[]>;
    },
    enabled: !!MEMBER_ID,
  });

  const latestRecord = records?.[0];
  const reversed = [...(records || [])].reverse().slice(-8);
  const chartData = reversed.map((r) => ({
    date: format(new Date(r.recorded_at), "MMM d"),
    weight: r.weight_kg,
    body_fat: r.body_fat_pct,
    muscle: r.muscle_mass_kg,
  }));

  const chartConfigs = {
    weight:   { dataKey: "weight",   label: "Weight (kg)",    color: "hsl(var(--primary))",        unit: "kg" },
    body_fat: { dataKey: "body_fat", label: "Body Fat (%)",   color: "hsl(var(--destructive))",    unit: "%" },
    muscle:   { dataKey: "muscle",   label: "Muscle Mass (kg)", color: "hsl(160 60% 45%)",         unit: "kg" },
  } as const;
  const activeCfg = chartConfigs[chartMetric];
  const hasChartData = chartData.some((d) => d[activeCfg.dataKey] != null);

  function set(field: keyof VitalsForm) {
    return (v: string) => setForm((f) => ({ ...f, [field]: v }));
  }

  function resetForm() {
    setForm({
      recorded_at: todayStr(), center_id: "",
      weight_kg: "", body_fat_pct: "", visceral_fat: "",
      bmr: "", bmi: "", metabolic_age: "",
      muscle_mass_kg: "", resting_hr: "", notes: "",
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createRecord.mutateAsync({
        memberId: MEMBER_ID!,
        data: {
          recorded_at: form.recorded_at || null,
          center_id: form.center_id || null,
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
          visceral_fat: form.visceral_fat ? Number(form.visceral_fat) : null,
          bmr: form.bmr ? Number(form.bmr) : null,
          bmi: form.bmi ? Number(form.bmi) : null,
          metabolic_age: form.metabolic_age ? Number(form.metabolic_age) : null,
          muscle_mass_kg: form.muscle_mass_kg ? Number(form.muscle_mass_kg) : null,
          resting_hr: form.resting_hr ? Number(form.resting_hr) : null,
          notes: form.notes || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetHealthRecordsQueryKey(MEMBER_ID!) });
      resetForm();
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const canSave = !!(form.weight_kg || form.bmi || form.body_fat_pct || form.muscle_mass_kg);

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Health Record</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          aria-label="Log progress"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>
      {/* Center pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {centers?.map((c) => (
          <div
            key={c.id}
            className="bg-teal-pale text-teal-dark border border-teal-light px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5"
          >
            <MapPin className="w-3 h-3" />
            {c.name}
          </div>
        ))}
      </div>
      {/* Latest vitals */}
      <section className="bg-card rounded-[12px] p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Latest Progress</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Weight", value: latestRecord?.weight_kg != null ? `${latestRecord.weight_kg.toFixed(1)} kg` : "--" },
            { label: "BMI", value: latestRecord?.bmi != null ? latestRecord.bmi.toFixed(1) : "--" },
            { label: "Body Fat", value: latestRecord?.body_fat_pct != null ? `${latestRecord.body_fat_pct.toFixed(1)}%` : "--" },
            { label: "Muscle Mass", value: latestRecord?.muscle_mass_kg != null ? `${latestRecord.muscle_mass_kg.toFixed(1)} kg` : "--" },
            { label: "Visceral Fat", value: latestRecord?.visceral_fat != null ? String(latestRecord.visceral_fat) : "--" },
            { label: "BMR", value: latestRecord?.bmr != null ? `${Math.round(latestRecord.bmr)} kcal` : "--" },
            { label: "Metabolic Age", value: latestRecord?.metabolic_age != null ? `${latestRecord.metabolic_age} yrs` : "--" },
            { label: "Resting HR", value: latestRecord?.resting_hr != null ? `${latestRecord.resting_hr} bpm` : "--" },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base font-semibold">{value}</p>
            </div>
          ))}
          <div className="col-span-2 space-y-0.5 border-t border-border pt-3 mt-1">
            <p className="text-xs text-muted-foreground">Recorded</p>
            <p className="text-sm font-medium">
              {latestRecord ? format(new Date(latestRecord.recorded_at), "MMM d, yyyy") : "--"}
            </p>
          </div>
        </div>
      </section>
      {/* Trend charts */}
      <section className="bg-card rounded-[12px] p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider">Trends</h2>
          <div className="flex gap-1 bg-muted rounded-full p-0.5">
            {(["weight", "body_fat", "muscle"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${
                  chartMetric === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {m === "weight" ? "Weight" : m === "body_fat" ? "Body Fat" : "Muscle"}
              </button>
            ))}
          </div>
        </div>

        {hasChartData ? (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
                <XAxis type="number" domain={["dataMin - 1", "dataMax + 1"]} hide />
                <YAxis
                  dataKey="date"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [`${v?.toFixed(1)} ${activeCfg.unit}`, activeCfg.label]}
                />
                <Bar
                  dataKey={activeCfg.dataKey}
                  fill={activeCfg.color}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No {activeCfg.label.toLowerCase()} data yet.
          </p>
        )}
      </section>
      {/* Visit history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Progress History</h2>
        <div className="space-y-2">
          {records?.map((r) => (
            <div key={r.id} className="bg-card border border-border p-4 rounded-[12px] flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {r.center_id || "Center Visit"}
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  {format(new Date(r.recorded_at), "MMM d, yyyy")}
                </p>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1">
                  {r.weight_kg != null && (
                    <span className="text-xs"><span className="text-muted-foreground">Wt </span>{r.weight_kg.toFixed(1)}kg</span>
                  )}
                  {r.bmi != null && (
                    <span className="text-xs"><span className="text-muted-foreground">BMI </span>{r.bmi.toFixed(1)}</span>
                  )}
                  {r.body_fat_pct != null && (
                    <span className="text-xs"><span className="text-muted-foreground">Fat </span>{r.body_fat_pct.toFixed(1)}%</span>
                  )}
                  {r.muscle_mass_kg != null && (
                    <span className="text-xs"><span className="text-muted-foreground">Msl </span>{r.muscle_mass_kg.toFixed(1)}kg</span>
                  )}
                  {r.visceral_fat != null && (
                    <span className="text-xs"><span className="text-muted-foreground">VF </span>{r.visceral_fat}</span>
                  )}
                  {r.bmr != null && (
                    <span className="text-xs"><span className="text-muted-foreground">BMR </span>{Math.round(r.bmr)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {(!records || records.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No records yet. Tap + to log your first visit.
            </p>
          )}
        </div>
      </section>
      {/* Visit History (check-in log) */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Visit History</h2>
        <div className="space-y-2">
          {(!checkinLogs || checkinLogs.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No visits recorded yet.</p>
          )}
          {checkinLogs?.map(log => {
            const active = !log.checked_out_at;
            return (
              <div key={log.id} className="bg-card border border-border rounded-[12px] px-4 py-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${active ? "bg-green-100" : "bg-muted"}`}>
                  {active
                    ? <LogIn className="w-4 h-4 text-green-600" />
                    : <LogOut className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{log.center_name}</p>
                    {active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5 flex-shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(log.checked_in_at), "MMM d, yyyy")}
                    {" · "}
                    {formatTime(log.checked_in_at)}
                    {log.checked_out_at && ` → ${formatTime(log.checked_out_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(log.duration_min)}{active ? "*" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Log Progress sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[20px] pb-safe px-5 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-5 sticky top-0 bg-background pt-2 pb-1 z-10">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold">Record Progress</SheetTitle>
              <button
                onClick={() => { setSheetOpen(false); resetForm(); }}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="space-y-4 pb-6">
            {/* Date + Center row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="record_date" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Record Date
                </Label>
                <Input
                  id="record_date"
                  type="date"
                  value={form.recorded_at}
                  onChange={(e) => set("recorded_at")(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="center_id" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Center
                </Label>
                <div className="relative">
                  <select
                    id="center_id"
                    value={form.center_id}
                    onChange={(e) => set("center_id")(e.target.value)}
                    className="w-full h-11 rounded-md border border-input bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— none —</option>
                    {centers?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-3 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            {/* Body composition */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">Body Composition</p>
            <div className="grid grid-cols-2 gap-3">
              <NumField id="weight_kg"     label="Weight (kg)"     placeholder="e.g. 72.5" value={form.weight_kg}     onChange={set("weight_kg")} />
              <NumField id="body_fat_pct"  label="Body Fat (%)"    placeholder="e.g. 22.3" value={form.body_fat_pct}  onChange={set("body_fat_pct")} />
              <NumField id="visceral_fat"  label="Visceral Fat"    placeholder="e.g. 8"    value={form.visceral_fat}  onChange={set("visceral_fat")} />
              <NumField id="muscle_mass"   label="Muscle Mass (kg)" placeholder="e.g. 34.0" value={form.muscle_mass_kg} onChange={set("muscle_mass_kg")} />
            </div>

            {/* Metabolic */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1">Metabolic</p>
            <div className="grid grid-cols-2 gap-3">
              <NumField id="bmr"          label="BMR (kcal)"      placeholder="e.g. 1650" value={form.bmr}          onChange={set("bmr")} />
              <NumField id="bmi"          label="BMI"             placeholder="e.g. 24.1" value={form.bmi}          onChange={set("bmi")} />
              <NumField id="metabolic_age" label="Metabolic Age"  placeholder="e.g. 32"   value={form.metabolic_age} onChange={set("metabolic_age")} />
              <NumField id="resting_hr"   label="Resting HR (bpm)" placeholder="e.g. 68" value={form.resting_hr}   onChange={set("resting_hr")} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes (optional)
              </Label>
              <Input
                id="notes"
                type="text"
                placeholder="Any observations…"
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                className="h-11"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={!canSave || saving}
              className="w-full h-12 text-base font-semibold mt-2"
            >
              {saving ? "Saving…" : "Save Record"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
