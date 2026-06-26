import {
  useGetHealthRecords,
  getGetHealthRecordsQueryKey,
  useGetMemberCenters,
  getGetMemberCentersQueryKey,
  useCreateHealthRecord,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { MapPin, Activity, Stethoscope, Plus, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MEMBER_ID = 1;

interface VitalsForm {
  weight_kg: string;
  bmi: string;
  resting_hr: string;
  notes: string;
}

export function Center() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<VitalsForm>({ weight_kg: "", bmi: "", resting_hr: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: records } = useGetHealthRecords(MEMBER_ID, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetHealthRecordsQueryKey(MEMBER_ID) },
  });
  const { data: centers } = useGetMemberCenters(MEMBER_ID, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberCentersQueryKey(MEMBER_ID) },
  });
  const createRecord = useCreateHealthRecord();

  const latestRecord = records?.[0];
  const chartData = [...(records || [])].reverse().slice(-6).map((r) => ({
    date: format(new Date(r.recorded_at), "MMM d"),
    weight: r.weight_kg,
  }));

  function resetForm() {
    setForm({ weight_kg: "", bmi: "", resting_hr: "", notes: "" });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createRecord.mutateAsync({
        memberId: MEMBER_ID,
        data: {
          weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
          bmi: form.bmi ? Number(form.bmi) : null,
          resting_hr: form.resting_hr ? Number(form.resting_hr) : null,
          notes: form.notes || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetHealthRecordsQueryKey(MEMBER_ID) });
      resetForm();
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const canSave = form.weight_kg || form.bmi || form.resting_hr;

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Health Center</h1>
        <button
          onClick={() => setSheetOpen(true)}
          className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          aria-label="Log vitals"
        >
          <Plus className="w-4 h-4" />
        </button>
      </header>

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

      <section className="bg-card rounded-[12px] p-5 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Latest Vitals</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Weight</p>
            <p className="text-lg font-semibold">{latestRecord?.weight_kg?.toFixed(1) || "--"} kg</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">BMI</p>
            <p className="text-lg font-semibold">{latestRecord?.bmi?.toFixed(1) || "--"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Resting HR</p>
            <p className="text-lg font-semibold">{latestRecord?.resting_hr || "--"} bpm</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Recorded</p>
            <p className="text-sm font-medium pt-1">
              {latestRecord ? format(new Date(latestRecord.recorded_at), "MMM d, yyyy") : "--"}
            </p>
          </div>
        </div>
      </section>

      {chartData.length > 0 && (
        <section className="bg-card rounded-[12px] p-5 border border-border">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4">Weight Trend</h2>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis type="number" domain={["dataMin - 2", "dataMax + 2"]} hide />
                <YAxis
                  dataKey="date"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  width={45}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Visit History</h2>
        <div className="space-y-2">
          {records?.map((r) => (
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
                {r.resting_hr && <p className="text-xs text-muted-foreground">{r.resting_hr} bpm</p>}
              </div>
            </div>
          ))}
          {(!records || records.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No records yet. Tap + to log your first visit.</p>
          )}
        </div>
      </section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[20px] pb-8 px-5">
          <SheetHeader className="mb-5">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold">Log Vitals</SheetTitle>
              <button
                onClick={() => { setSheetOpen(false); resetForm(); }}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="weight" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Weight (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 72.5"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bmi" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  BMI
                </Label>
                <Input
                  id="bmi"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 24.1"
                  value={form.bmi}
                  onChange={(e) => setForm((f) => ({ ...f, bmi: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resting_hr" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Resting Heart Rate (bpm)
              </Label>
              <Input
                id="resting_hr"
                type="number"
                inputMode="numeric"
                placeholder="e.g. 68"
                value={form.resting_hr}
                onChange={(e) => setForm((f) => ({ ...f, resting_hr: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notes (optional)
              </Label>
              <Input
                id="notes"
                type="text"
                placeholder="Any observations..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
