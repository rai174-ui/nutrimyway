import { useState, useEffect, useRef } from "react";
import { KeyRound, CheckCircle2, Loader2, Package, Plus, Edit2, Check, X, Trash2, Users, AlertTriangle, QrCode, Download, Tag, Clock, Megaphone, Send, ChevronDown, ChevronUp } from "lucide-react";
import * as XLSX from "xlsx";
import { QRCodeCanvas } from "qrcode.react";
import { Nav } from "@/components/nav";
import { apiPost, apiGet, apiPut, apiPatch, apiDelete, getAdminCenter, type Ingredient, type CenterFlavour, type CenterMember, type CenterSettings, type BroadcastSettings, type BroadcastSchedule } from "@/lib/api";

const UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = typeof ALL_DAYS[number];

function parseDays(val: string): Day[] {
  if (!val || val === "all") return [...ALL_DAYS];
  return val.split(",").map(d => d.trim()).filter((d): d is Day => ALL_DAYS.includes(d as Day));
}
function formatDays(days: Day[]): string {
  if (days.length === ALL_DAYS.length) return "all";
  return days.join(",");
}

function DayPicker({ value, onChange }: { value: Day[]; onChange: (v: Day[]) => void }) {
  function toggle(day: Day) {
    onChange(
      value.includes(day)
        ? value.filter(d => d !== day)
        : [...value, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    );
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_DAYS.map(day => (
        <button
          key={day}
          type="button"
          onClick={() => toggle(day)}
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
            value.includes(day)
              ? "bg-violet-600 text-white"
              : "bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-600"
          }`}
        >
          {day}
        </button>
      ))}
    </div>
  );
}

function BroadcastSettingsCard() {
  const center = getAdminCenter();
  const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
  const [retentionDays, setRetentionDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Add-schedule form
  const [newMessage, setNewMessage] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editTime, setEditTime] = useState("09:00");

  useEffect(() => {
    if (!center) return;
    void loadAll();
  }, [center?.id]);

  async function loadAll() {
    if (!center) return;
    setLoading(true); setError(null);
    try {
      const [settings, schs] = await Promise.all([
        apiGet<BroadcastSettings>(`/admin/centers/${center.id}/broadcast-settings`),
        apiGet<BroadcastSchedule[]>(`/admin/centers/${center.id}/broadcast-schedules`),
      ]);
      setRetentionDays(settings.retention_days ?? 7);
      setSchedules(schs);
    } catch {
      setError("Failed to load broadcast settings");
    } finally { setLoading(false); }
  }

  async function saveRetention() {
    if (!center) return;
    setSavingRetention(true); setRetentionSaved(false);
    try {
      await apiPut(`/admin/centers/${center.id}/broadcast-settings`, { retention_days: retentionDays });
      setRetentionSaved(true);
      setTimeout(() => setRetentionSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save retention");
    } finally { setSavingRetention(false); }
  }

  async function addSchedule() {
    if (!center) return;
    if (!newMessage.trim()) { setError("Message is required"); return; }
    if (!/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(newTime)) {
      setError("Time must be HH:MM (24-hour format)"); return;
    }
    setAdding(true); setError(null);
    try {
      await apiPost<BroadcastSchedule>(`/admin/centers/${center.id}/broadcast-schedules`, {
        message: newMessage.trim(), schedule_time: newTime,
      });
      setNewMessage(""); setNewTime("09:00");
      void loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add schedule");
    } finally { setAdding(false); }
  }

  async function toggleSchedule(id: number, active: boolean) {
    if (!center) return;
    try {
      await apiPut(`/admin/centers/${center.id}/broadcast-schedules/${id}`, { is_active: !active });
      void loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle");
    }
  }

  async function deleteSchedule(id: number) {
    if (!center) return;
    if (!confirm("Delete this scheduled broadcast?")) return;
    try {
      await apiDelete(`/admin/centers/${center.id}/broadcast-schedules/${id}`);
      void loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  async function saveEdit(id: number) {
    if (!center) return;
    if (!editMessage.trim()) { setError("Message is required"); return; }
    if (!/^([0-1]\d|2[0-3]):([0-5]\d)$/.test(editTime)) {
      setError("Time must be HH:MM (24-hour format)"); return;
    }
    try {
      await apiPut(`/admin/centers/${center.id}/broadcast-schedules/${id}`, {
        message: editMessage.trim(), schedule_time: editTime,
      });
      setEditingId(null);
      void loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  function startEdit(s: BroadcastSchedule) {
    setEditingId(s.id);
    setEditMessage(s.message);
    setEditTime(s.schedule_time);
    setError(null);
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Broadcast Schedules</h2>
            <p className="text-xs text-muted-foreground">Set up multiple daily messages for active members</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Retention */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Keep broadcasts visible for</span>
            <input
              type="number" min={1} max={90}
              value={retentionDays}
              onChange={e => setRetentionDays(Math.max(1, Math.min(90, Number(e.target.value) || 7)))}
              className="w-14 h-8 px-2 rounded-lg border border-input bg-background text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">days</span>
            <button
              onClick={() => void saveRetention()}
              disabled={savingRetention}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white disabled:opacity-50"
            >
              {savingRetention ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
            </button>
            {retentionSaved && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
          </div>

          {/* Schedule list */}
          <div className="space-y-2">
            {schedules.length === 0 && (
              <p className="text-xs text-muted-foreground">No schedules yet. Add one below.</p>
            )}
            {schedules.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2 text-sm">
                {editingId === s.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={editMessage}
                      onChange={e => setEditMessage(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)}
                        className="w-24 h-7 px-2 rounded-lg border border-input bg-background text-xs focus:outline-none" />
                      <button onClick={() => void saveEdit(s.id)}
                        className="text-xs font-medium px-2 py-1 rounded bg-primary text-white">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="text-xs font-medium px-2 py-1 rounded border border-border">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0">
                    <p className="text-foreground line-clamp-2">{s.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {s.schedule_time} IST · {s.is_active ? "Active" : "Paused"}
                      {s.last_sent_at && ` · Last sent ${new Date(s.last_sent_at).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                )}
                {editingId !== s.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => void toggleSchedule(s.id, s.is_active)}
                      className={`p-1 rounded-md text-xs font-medium transition-colors ${
                        s.is_active
                          ? "text-emerald-600 hover:bg-emerald-50"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      title={s.is_active ? "Pause" : "Resume"}
                    >
                      {s.is_active ? "Pause" : "Resume"}
                    </button>
                    <button onClick={() => startEdit(s)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void deleteSchedule(s.id)}
                      className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="border-t border-border pt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add Schedule</p>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your scheduled message..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <div className="flex items-center gap-2">
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                className="w-28 h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <button
                onClick={() => void addSchedule()}
                disabled={adding || !newMessage.trim()}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )}
</div>
  );
}

// ── Flavour Master ────────────────────────────────────────────────────────────

function FlavourMaster() {
  const center = getAdminCenter();
  const [flavours, setFlavours] = useState<CenterFlavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState<Day[]>([...ALL_DAYS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editDays, setEditDays] = useState<Day[]>([...ALL_DAYS]);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    if (!center) return;
    try {
      const data = await apiGet<CenterFlavour[]>(`/admin/centers/${center.id}/flavours`);
      setFlavours(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [center?.id]);

  async function addFlavour() {
    if (!center || !newName.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiPost(`/admin/centers/${center.id}/flavours`, {
        name: newName.trim(),
        available_days: formatDays(newDays),
      });
      setNewName(""); setNewDays([...ALL_DAYS]); setAdding(false);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  function startEdit(f: CenterFlavour) {
    setEditId(f.id);
    setEditDays(parseDays(f.available_days ?? "all"));
  }

  async function saveEdit(id: number) {
    if (!center) return;
    setSaving(true); setError(null);
    try {
      await apiPatch(`/admin/centers/${center.id}/flavours/${id}`, {
        available_days: formatDays(editDays),
      });
      setEditId(null);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteFlavour(id: number) {
    if (!center) return;
    if (!confirm("Remove this flavour from the master list?")) return;
    try {
      await apiDelete(`/admin/centers/${center.id}/flavours/${id}`);
      void load();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Tag className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Flavour Master</h2>
            <p className="text-xs text-muted-foreground">Set serving qty and available days per flavour</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {flavours.length}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdding(v => !v); setError(null); setNewName(""); setNewDays([...ALL_DAYS]); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
      <>
      {error && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {adding && (
        <div className="px-5 py-4 border-b border-dashed border-border bg-muted/30 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void addFlavour()}
              autoFocus
              placeholder="Flavour name e.g. Chocolate"
              className="flex-1 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={() => void addFlavour()}
              disabled={!newName.trim() || saving}
              className="h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
            </button>
            <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Available</label>
            <DayPicker value={newDays} onChange={setNewDays} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
        </div>
      ) : flavours.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No flavours yet. Add some above — they'll appear as a dropdown in Item Master.
        </p>
      ) : (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {flavours.map(f => (
            <div key={f.id} className="group rounded-xl border border-border px-3 py-2.5 hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
              {editId === f.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground flex-1 truncate">{f.name}</span>
                    <button
                      onClick={() => void saveEdit(f.id)}
                      disabled={saving}
                      className="text-violet-600 hover:text-violet-700 disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <DayPicker value={editDays} onChange={setEditDays} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-violet-700 truncate">{f.name}</p>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {f.available_days && f.available_days !== "all" ? (
                        f.available_days.split(",").map(d => (
                          <span key={d} className="text-[9px] bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full">{d.trim()}</span>
                        ))
                      ) : (
                        <span className="text-[9px] text-muted-foreground">All days</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button onClick={() => startEdit(f)} className="text-muted-foreground hover:text-violet-600 p-0.5">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void deleteFlavour(f.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ── Item Master ───────────────────────────────────────────────────────────────

function ItemMaster() {
  const center = getAdminCenter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [flavours, setFlavours] = useState<CenterFlavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [newFlavour, setNewFlavour] = useState("");
  const [newServingQty, setNewServingQty] = useState("1");
  const [newKcalPerServing, setNewKcalPerServing] = useState("");
  const [newTrialEligible, setNewTrialEligible] = useState(false);

  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editMaterialCode, setEditMaterialCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFlavour, setEditFlavour] = useState("");
  const [editServingQty, setEditServingQty] = useState("1");
  const [editKcalPerServing, setEditKcalPerServing] = useState("");
  const [editTrialEligible, setEditTrialEligible] = useState(false);

  async function load() {
    try {
      const [ingData, flavData] = await Promise.all([
        apiGet<Ingredient[]>("/admin/ingredients"),
        center ? apiGet<CenterFlavour[]>(`/admin/centers/${center.id}/flavours`) : Promise.resolve([]),
      ]);
      setIngredients(ingData);
      setFlavours(flavData);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [center?.id]);

  async function addIngredient() {
    if (!newName.trim()) return;
    if (!newMaterialCode.trim()) { setError("Material Code is required"); return; }
    setSaving(true); setError(null);
    try {
      await apiPost<Ingredient>("/admin/ingredients", {
        name: newName.trim(),
        pack_size: 1,
        pack_unit: newUnit,
        material_code: newMaterialCode.trim(),
        description: newDescription.trim() || null,
        flavour: newFlavour.trim() || null,
        serving_qty: Number(newServingQty) || 1,
        kcal_per_serving: newKcalPerServing.trim() ? Number(newKcalPerServing) : null,
        trial_eligible: newTrialEligible,
      });
      setNewName(""); setNewUnit("g");
      setNewMaterialCode(""); setNewDescription(""); setNewFlavour(""); setNewServingQty("1"); setNewKcalPerServing(""); setNewTrialEligible(false);
      setAdding(false);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    if (!editMaterialCode.trim()) { setError("Material Code is required"); return; }
    setSaving(true); setError(null);
    try {
      const cur = ingredients.find(i => i.id === id);
      await apiPut<Ingredient>(`/admin/ingredients/${id}`, {
        name: editName.trim(),
        pack_size: cur?.pack_size ?? 1,
        pack_unit: editUnit,
        material_code: editMaterialCode.trim(),
        description: editDescription.trim() || null,
        flavour: editFlavour.trim() || null,
        serving_qty: Number(editServingQty) || 1,
        kcal_per_serving: editKcalPerServing.trim() ? Number(editKcalPerServing) : null,
        trial_eligible: editTrialEligible,
      });
      setEditId(null);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteIngredient(id: number) {
    if (!confirm("Delete this item? All batch records for it will also be removed.")) return;
    try {
      await apiDelete(`/admin/ingredients/${id}`);
      void load();
    } catch (e) { setError((e as Error).message); }
  }

  function startEdit(ing: Ingredient) {
    setEditId(ing.id);
    setEditName(ing.name);
    setEditUnit(ing.pack_unit);
    setEditMaterialCode(ing.material_code ?? "");
    setEditDescription(ing.description ?? "");
    setEditFlavour(ing.flavour ?? "");
    setEditServingQty(String(ing.serving_qty ?? 1));
    setEditKcalPerServing(ing.kcal_per_serving != null ? String(ing.kcal_per_serving) : "");
    setEditTrialEligible(ing.trial_eligible ?? false);
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Item Master</h2>
            <p className="text-xs text-muted-foreground">Define items with material code, flavour and pack sizes used in BOM &amp; inventory</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {ingredients.length}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdding(v => !v); setError(null); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {expanded && (
      <>
      {error && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {adding && (
        <div className="px-5 py-4 border-b border-dashed border-border bg-muted/30 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Item name *"
              onKeyDown={e => e.key === "Enter" && void addIngredient()}
              autoFocus
            />
            <input
              value={newMaterialCode}
              onChange={e => setNewMaterialCode(e.target.value)}
              className="w-36 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Material code *"
            />
            <select
              value={newFlavour}
              onChange={e => setNewFlavour(e.target.value)}
              className="w-36 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— Flavour —</option>
              {flavours.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
          </div>
          <input
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Description (optional)"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newUnit}
              onChange={e => setNewUnit(e.target.value)}
              className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {UNITS.map(u => <option key={u}>{u}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Serving qty</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={newServingQty}
                onChange={e => setNewServingQty(e.target.value)}
                className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground whitespace-nowrap">kcal/serve</label>
              <input
                type="number"
                min="0"
                step="1"
                value={newKcalPerServing}
                onChange={e => setNewKcalPerServing(e.target.value)}
                placeholder="—"
                className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={newTrialEligible}
                onChange={e => setNewTrialEligible(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary"
              />
              Trial-eligible
            </label>
            <button
              onClick={() => void addIngredient()}
              disabled={!newName.trim() || saving}
              className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
            </button>
            <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className={ingredients.length === 0 ? "" : "p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"}>
          {ingredients.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No items yet. Add one above — BOM and inventory can only use items from this list.
            </p>
          )}
          {ingredients.map(ing => (
            <div key={ing.id} className={`group ${editId === ing.id ? "" : "rounded-xl border border-border hover:border-primary/30 hover:bg-muted/20 transition-colors"}`}>
              {editId === ing.id ? (
                <div className="px-5 py-3 space-y-2 bg-muted/20 rounded-xl border border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 min-w-[140px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Item name *"
                    />
                    <input
                      value={editMaterialCode}
                      onChange={e => setEditMaterialCode(e.target.value)}
                      className="w-32 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Material code *"
                    />
                    <select
                      value={editFlavour}
                      onChange={e => setEditFlavour(e.target.value)}
                      className="w-36 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">— Flavour —</option>
                      {flavours.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <input
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    className="w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Description"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={editUnit}
                      onChange={e => setEditUnit(e.target.value)}
                      className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Serving qty</label>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={editServingQty}
                        onChange={e => setEditServingQty(e.target.value)}
                        className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">kcal/serve</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editKcalPerServing}
                        onChange={e => setEditKcalPerServing(e.target.value)}
                        placeholder="—"
                        className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTrialEligible}
                        onChange={e => setEditTrialEligible(e.target.checked)}
                        className="w-3.5 h-3.5 accent-primary"
                      />
                      Trial-eligible
                    </label>
                    <button
                      onClick={() => void saveEdit(ing.id)}
                      disabled={saving}
                      className="text-primary hover:text-primary/80 disabled:opacity-40"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{ing.name}</span>
                      {ing.material_code && (
                        <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ing.material_code}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      {ing.flavour && (
                        <span className="text-[9px] bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">{ing.flavour}</span>
                      )}
                      {ing.flavour && (
                        <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full">{ing.serving_qty} {ing.pack_unit}/serve</span>
                      )}
                      {ing.flavour && ing.kcal_per_serving != null && (
                        <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">{ing.kcal_per_serving} kcal/serve</span>
                      )}
                      {!ing.flavour && (
                        <span className="text-[9px] text-muted-foreground">Unit: {ing.pack_unit}</span>
                      )}
                      {ing.trial_eligible && (
                        <span className="text-[9px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-full">Trial-eligible</span>
                      )}
                    </div>
                    {ing.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ing.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button onClick={() => startEdit(ing)} className="text-muted-foreground hover:text-primary p-0.5">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void deleteIngredient(ing.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ── Center Settings (auto-checkout) ────────────────────────────────────────────

function CenterSettingsCard() {
  const center = getAdminCenter();
  const [value, setValue] = useState<number | "">(180);
  const [photoRetention, setPhotoRetention] = useState<number | "">(2);
  const [checkinCap, setCheckinCap] = useState<number | "">(32);
  const [renewalDays, setRenewalDays] = useState<number | "">(40);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!center) return;
    setLoading(true);
    apiGet<CenterSettings>(`/admin/centers/${center.id}/settings`)
      .then(s => {
        setValue(s.auto_checkout_min);
        setPhotoRetention(s.photo_retention_days ?? 2);
        setCheckinCap(s.checkin_cap ?? 32);
        setRenewalDays(s.renewal_days ?? 40);
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, [center?.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!center || value === "" || photoRetention === "" || checkinCap === "" || renewalDays === "") return;
    const mins = Number(value);
    if (!Number.isFinite(mins) || mins < 10 || mins > 480) {
      setError("Must be between 10 and 480 minutes"); return;
    }
    const days = Number(photoRetention);
    if (!Number.isFinite(days) || days < 1 || days > 30) {
      setError("Photo retention must be between 1 and 30 days"); return;
    }
    const cap = Number(checkinCap);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      setError("Max check-ins must be a whole number between 1 and 500"); return;
    }
    const renewal = Number(renewalDays);
    if (!Number.isInteger(renewal) || renewal < 1 || renewal > 365) {
      setError("Renewal days must be a whole number between 1 and 365"); return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiPatch<CenterSettings>(`/admin/centers/${center.id}/settings`, {
        auto_checkout_min: mins, photo_retention_days: days, checkin_cap: cap, renewal_days: renewal,
      });
      setValue(updated.auto_checkout_min);
      setPhotoRetention(updated.photo_retention_days);
      setCheckinCap(updated.checkin_cap);
      setRenewalDays(updated.renewal_days);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Center Settings</h2>
            <p className="text-xs text-muted-foreground">Configure behavior for your center</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <form onSubmit={handleSubmit => void handleSave(handleSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Auto-Checkout Duration (minutes)
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              Members are automatically checked out after this many minutes of being checked in.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={10}
                max={480}
                step={5}
                value={value}
                onChange={e => setValue(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="w-28 h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">minutes</span>
              {value !== "" && (
                <span className="text-xs text-muted-foreground">
                  ({Math.floor(Number(value) / 60) > 0 ? `${Math.floor(Number(value) / 60)}h ` : ""}{Number(value) % 60 > 0 ? `${Number(value) % 60}m` : ""})
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Meal Photo Retention (days)
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              Photos older than this are automatically deleted. Range 1–30 days.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={30}
                step={1}
                value={photoRetention}
                onChange={e => setPhotoRetention(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="w-28 h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Max Check-ins Per Cycle
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              Members are blocked from checking in once they hit this many check-ins in their current membership cycle. Range 1–500.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                value={checkinCap}
                onChange={e => setCheckinCap(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="w-28 h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">check-ins</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Renewal Extension (days)
            </label>
            <p className="text-xs text-muted-foreground -mt-1">
              When a member renews, their validity is extended by this many days and their check-in cycle resets. Range 1–365.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                value={renewalDays}
                onChange={e => setRenewalDays(e.target.value === "" ? "" : Number(e.target.value))}
                required
                className="w-28 h-9 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-sm text-emerald-700 font-medium">Settings saved.</span>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={saving || value === "" || photoRetention === "" || checkinCap === "" || renewalDays === ""}
              className="flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ── Center QR Code ─────────────────────────────────────────────────────────────

function CenterQRCode() {
  const center = getAdminCenter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  if (!center) return null;

  function downloadQR() {
    const canvas = canvasRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `checkin-qr-${center!.id}.png`;
    a.click();
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <QrCode className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Check-In QR Code</h2>
            <p className="text-xs text-muted-foreground">Members scan this QR to check in to your center</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="flex flex-col items-center gap-4">
        <div ref={canvasRef} className="p-4 bg-white rounded-2xl border border-border shadow-sm">
          <QRCodeCanvas
            value={center.id}
            size={200}
            level="M"
            includeMargin={false}
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{center.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Center ID: {center.id}</p>
        </div>
        <button
          onClick={downloadQR}
          className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          Download QR
        </button>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Print this QR and place it at your center entrance. Members tap "Scan QR" in the app to check in instantly.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Member Manager (permanent delete) ─────────────────────────────────────────

function MemberManager() {
  const center = getAdminCenter();
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function load() {
    if (!center) return;
    setLoading(true);
    try {
      const data = await apiGet<CenterMember[]>(`/admin/centers/${center.id}/members`);
      setMembers(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [center?.id]);

  async function handleDelete(m: CenterMember) {
    if (!center) return;
    if (!confirm(`Permanently delete ${m.name}?\n\nThis removes all their health records, meal logs, and login access. This cannot be undone.`)) return;
    setDeletingId(m.id);
    setError(null);
    try {
      await apiDelete(`/admin/centers/${center.id}/members/${m.id}/hard-delete`);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <Users className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Delete Member</h2>
            <p className="text-xs text-muted-foreground">Permanently remove a member and all their data</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              Deleting a member is permanent and cannot be undone. It removes their profile, all health records, meal logs, and login credentials.
            </p>
          </div>

          {error && (
            <div className="mb-4 text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">{error}</div>
          )}

          {loading ? (
            <div className="text-center py-6 text-muted-foreground animate-pulse text-sm">Loading members…</div>
          ) : members.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No members in this center</div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-muted-foreground">
                      {m.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.membership_no && <span className="mr-2">{m.membership_no}</span>}
                      {m.mobile ?? m.email ?? "—"}
                    </p>
                  </div>
                  {!m.is_active && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                  )}
                  <button
                    onClick={() => void handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors flex-shrink-0"
                    title="Permanently delete member"
                  >
                    {deletingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pwExpanded, setPwExpanded] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      await apiPost("/admin/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage flavours, item master, center QR code, and admin password</p>
        </div>

        <CenterSettingsCard />

        <BroadcastSettingsCard />

        <FlavourMaster />

        <ItemMaster />

        <CenterQRCode />

        <MemberManager />

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <button
            onClick={() => setPwExpanded(v => !v)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground leading-tight">Change Password</h2>
                <p className="text-xs text-muted-foreground">Update your center admin login password</p>
              </div>
            </div>
            {pwExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </button>

          {pwExpanded && (
            <div className="px-6 pb-6">
              {success && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-sm text-emerald-700 font-medium">Password changed successfully.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter current password"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Repeat new password"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!currentPassword || !newPassword || !confirmPassword || loading}
              className="h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </button>
          </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
