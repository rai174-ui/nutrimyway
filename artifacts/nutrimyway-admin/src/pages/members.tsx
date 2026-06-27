import { useEffect, useState, useCallback } from "react";
import {
  UserPlus, LogIn, LogOut, Trash2, Users, Clock,
  Search, Phone, Mail, UserCheck, UserX,
  Lock, CheckCircle2, XCircle, AlertTriangle, Loader2, X, Activity, Plus, Hash,
} from "lucide-react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiDelete, getAdminCenter,
  type CenterMember, type MemberLookup, type MenuItem, type VisitMenuSelection, type HealthRecord,
} from "@/lib/api";

const AUTO_CHECKOUT_MIN = 180;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

// ── Add Member Form (unchanged) ─────────────────────────────────────────────

type LookupStep = "search" | "found" | "notfound" | "creating" | "healthrecord";

function AddMemberForm({ centerId, onAdded }: { centerId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<LookupStep>("search");
  const [searchKind, setSearchKind] = useState<"mobile" | "email" | "membership_no">("mobile");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<MemberLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [height, setHeight] = useState("");
  const [doj, setDoj] = useState("");
  const [membershipNo, setMembershipNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Health record step
  const [linkedMemberId, setLinkedMemberId] = useState<number | null>(null);
  const [hrDate, setHrDate] = useState(new Date().toISOString().slice(0, 10));
  const [hrWeight, setHrWeight] = useState("");
  const [hrBmi, setHrBmi] = useState("");
  const [hrBodyFat, setHrBodyFat] = useState("");
  const [hrVisceralFat, setHrVisceralFat] = useState("");
  const [hrMuscleMass, setHrMuscleMass] = useState("");
  const [hrMetabolicAge, setHrMetabolicAge] = useState("");
  const [hrBmr, setHrBmr] = useState("");
  const [hrRestingHr, setHrRestingHr] = useState("");
  const [hrNotes, setHrNotes] = useState("");

  function reset() {
    setStep("search"); setQuery(""); setFound(null); setError("");
    setName(""); setEmail(""); setMobile(""); setHeight(""); setDoj(""); setMembershipNo("");
    setLinkedMemberId(null);
    setHrDate(new Date().toISOString().slice(0, 10));
    setHrWeight(""); setHrBmi(""); setHrBodyFat(""); setHrVisceralFat("");
    setHrMuscleMass(""); setHrMetabolicAge(""); setHrBmr(""); setHrRestingHr(""); setHrNotes("");
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true); setError("");
    try {
      const params = searchKind === "mobile"
        ? `mobile=${encodeURIComponent(query.trim())}`
        : searchKind === "email"
        ? `email=${encodeURIComponent(query.trim())}`
        : `membership_no=${encodeURIComponent(query.trim())}`;
      const result = await apiGet<MemberLookup | null>(`/admin/members/lookup?${params}`);
      if (result) { setFound(result); setStep("found"); }
      else {
        if (searchKind === "mobile") setMobile(query.trim());
        else if (searchKind === "email") setEmail(query.trim());
        else setMembershipNo(query.trim());
        setStep("notfound");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Lookup failed"); }
    finally { setSearching(false); }
  }

  async function handleLink() {
    if (!found) return;
    setSaving(true); setError("");
    try {
      await apiPost(`/admin/centers/${centerId}/members/link`, { member_id: found.id });
      setLinkedMemberId(found.id);
      setStep("healthrecord");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to link member"); }
    finally { setSaving(false); }
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!mobile.trim() && !email.trim()) { setError("Mobile number or email is required"); return; }
    setSaving(true); setError("");
    try {
      const member = await apiPost<{ id: number }>(`/admin/centers/${centerId}/members`, {
        name: name.trim(), mobile: mobile.trim() || null, email: email.trim() || null,
        height_cm: height ? Number(height) : null, date_of_joining: doj || null,
        membership_no: membershipNo.trim() || null,
      });
      setLinkedMemberId(member.id);
      setStep("healthrecord");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to add member"); }
    finally { setSaving(false); }
  }

  async function handleHealthRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!hrWeight || Number(hrWeight) <= 0) { setError("Weight is required"); return; }
    setSaving(true); setError("");
    try {
      await apiPost(`/admin/centers/${centerId}/members/${linkedMemberId}/health-records`, {
        recorded_at: hrDate,
        weight_kg: Number(hrWeight),
        bmi: hrBmi ? Number(hrBmi) : undefined,
        body_fat_pct: hrBodyFat ? Number(hrBodyFat) : undefined,
        visceral_fat: hrVisceralFat ? Number(hrVisceralFat) : undefined,
        muscle_mass_kg: hrMuscleMass ? Number(hrMuscleMass) : undefined,
        metabolic_age: hrMetabolicAge ? Number(hrMetabolicAge) : undefined,
        bmr: hrBmr ? Number(hrBmr) : undefined,
        resting_hr: hrRestingHr ? Number(hrRestingHr) : undefined,
        notes: hrNotes.trim() || undefined,
      });
      setOpen(false); reset(); onAdded();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save health record"); }
    finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
        <UserPlus className="w-4 h-4" /> Onboard Member
      </button>
    );
  }

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary";
  const hrFieldCls = "w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50";
  const hrLabelCls = "block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Onboard Member</h3>
        <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>
      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {step === "search" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Search for an existing member first to avoid duplicates.</p>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <button onClick={() => { setSearchKind("mobile"); setQuery(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${searchKind === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Phone className="w-3 h-3" />Mobile
            </button>
            <button onClick={() => { setSearchKind("email"); setQuery(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${searchKind === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Mail className="w-3 h-3" />Email
            </button>
            <button onClick={() => { setSearchKind("membership_no"); setQuery(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${searchKind === "membership_no" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Hash className="w-3 h-3" />Member ID
            </button>
          </div>
          <div className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && void handleSearch()}
              placeholder={searchKind === "mobile" ? "+91 98765 43210" : searchKind === "email" ? "member@email.com" : "MEM-001"}
              type={searchKind === "email" ? "email" : "text"}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => void handleSearch()} disabled={!query.trim() || searching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors">
              <Search className="w-3.5 h-3.5" />{searching ? "..." : "Search"}
            </button>
          </div>
          <button onClick={() => { setStep("notfound"); setError(""); }} className="text-xs text-primary hover:underline underline-offset-2">
            Skip search — create new member directly
          </button>
        </div>
      )}

      {step === "found" && found && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <UserCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">Member found</p>
              <p className="text-sm font-medium text-foreground mt-1">{found.name}</p>
              {found.mobile && <p className="text-xs text-muted-foreground">{found.mobile}</p>}
              {found.email && <p className="text-xs text-muted-foreground">{found.email}</p>}
              {found.membership_no && <p className="text-xs text-muted-foreground">ID: {found.membership_no}</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            <button onClick={() => { setFound(null); setStep("search"); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground">← Search again</button>
            <button onClick={() => void handleLink()} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <UserCheck className="w-3.5 h-3.5" />{saving ? "Linking..." : "Link to Center"}
            </button>
          </div>
        </div>
      )}

      {step === "notfound" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            <UserX className="w-3.5 h-3.5 flex-shrink-0" />No existing member found — fill in details to create a new one.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile *</label>
              <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 ..." type="tel" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="member@email.com" type="email" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Member ID</label>
              <input value={membershipNo} onChange={e => setMembershipNo(e.target.value)} placeholder="MEM-001" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Height (cm)</label>
              <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="e.g. 165" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Joining</label>
              <input type="date" value={doj} onChange={e => setDoj(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-amber-600">* Mobile or email is required (at least one)</p>
          <div className="flex gap-2 justify-between">
            <button onClick={() => { setStep("search"); setError(""); }} className="text-xs text-muted-foreground hover:text-foreground">← Back to search</button>
            <button onClick={() => void handleCreate()} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
              <UserPlus className="w-3.5 h-3.5" />{saving ? "Creating..." : "Create & Continue →"}
            </button>
          </div>
        </div>
      )}

      {step === "healthrecord" && (
        <form onSubmit={e => void handleHealthRecord(e)} className="space-y-3">
          <div className="flex items-center gap-2 text-xs bg-sky-50 border border-sky-200 text-sky-800 rounded-lg px-3 py-2">
            <Activity className="w-3.5 h-3.5 flex-shrink-0" />
            Record initial health measurements to complete registration.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className={hrLabelCls}>Date</label>
              <input type="date" value={hrDate} onChange={e => setHrDate(e.target.value)} className={hrFieldCls} required />
            </div>
            <div>
              <label className={hrLabelCls}>Weight (kg) *</label>
              <input type="number" step="0.1" min="0" value={hrWeight} onChange={e => setHrWeight(e.target.value)} className={hrFieldCls} placeholder="72.5" required />
            </div>
            <div>
              <label className={hrLabelCls}>BMI</label>
              <input type="number" step="0.1" min="0" value={hrBmi} onChange={e => setHrBmi(e.target.value)} className={hrFieldCls} placeholder="24.5" />
            </div>
            <div>
              <label className={hrLabelCls}>Body Fat %</label>
              <input type="number" step="0.1" min="0" max="100" value={hrBodyFat} onChange={e => setHrBodyFat(e.target.value)} className={hrFieldCls} placeholder="22.0" />
            </div>
            <div>
              <label className={hrLabelCls}>Visceral Fat</label>
              <input type="number" step="0.5" min="0" value={hrVisceralFat} onChange={e => setHrVisceralFat(e.target.value)} className={hrFieldCls} placeholder="8" />
            </div>
            <div>
              <label className={hrLabelCls}>Muscle Mass (kg)</label>
              <input type="number" step="0.1" min="0" value={hrMuscleMass} onChange={e => setHrMuscleMass(e.target.value)} className={hrFieldCls} placeholder="28.0" />
            </div>
            <div>
              <label className={hrLabelCls}>Metabolic Age</label>
              <input type="number" min="0" value={hrMetabolicAge} onChange={e => setHrMetabolicAge(e.target.value)} className={hrFieldCls} placeholder="35" />
            </div>
            <div>
              <label className={hrLabelCls}>BMR (kcal)</label>
              <input type="number" min="0" value={hrBmr} onChange={e => setHrBmr(e.target.value)} className={hrFieldCls} placeholder="1650" />
            </div>
            <div>
              <label className={hrLabelCls}>Resting HR (bpm)</label>
              <input type="number" min="0" value={hrRestingHr} onChange={e => setHrRestingHr(e.target.value)} className={hrFieldCls} placeholder="68" />
            </div>
          </div>
          <div>
            <label className={hrLabelCls}>Notes</label>
            <textarea value={hrNotes} onChange={e => setHrNotes(e.target.value)} rows={2} placeholder="Any observations…"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Save & Complete Registration
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Checked-In Visit Panel ──────────────────────────────────────────────────

function VisitPanel({
  member, centerId, onCheckout,
}: {
  member: CenterMember;
  centerId: string;
  onCheckout: () => void;
}) {
  const checkinId = member.checkin_id!;
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selections, setSelections] = useState<VisitMenuSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, forceUpdate] = useState(0);

  // Refresh time display every minute
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [items, sels] = await Promise.all([
        apiGet<MenuItem[]>(`/admin/centers/${centerId}/menu-items`),
        apiGet<VisitMenuSelection[]>(`/admin/checkins/${checkinId}/menu-selections`),
      ]);
      setMenuItems(items);
      setSelections(sels);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [centerId, checkinId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedIds = new Set(selections.map(s => s.menu_item_id));

  async function toggleItem(item: MenuItem) {
    if (item.is_mandatory) return; // mandatory items cannot be deselected
    if (!item.is_available && !selectedIds.has(item.id)) return; // unavailable cannot be selected
    setBusy(true); setError(null);
    try {
      if (selectedIds.has(item.id)) {
        const sel = selections.find(s => s.menu_item_id === item.id);
        if (sel) {
          await apiDelete(`/admin/checkin-selections/${sel.id}`);
          setSelections(prev => prev.filter(s => s.id !== sel.id));
        }
      } else {
        const created = await apiPost<VisitMenuSelection>(`/admin/checkins/${checkinId}/menu-selections`, {
          menu_item_id: item.id,
        });
        setSelections(prev => [...prev, created]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function handleCheckout() {
    setCheckingOut(true); setError(null);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/checkout`, {});
      onCheckout();
    } catch (e) { setError((e as Error).message); }
    finally { setCheckingOut(false); }
  }

  const mins = minutesSince(member.checked_in_at!);
  const remaining = AUTO_CHECKOUT_MIN - mins;
  const mandatory = menuItems.filter(m => m.is_mandatory);
  const optional = menuItems.filter(m => !m.is_mandatory);
  const selectionCount = selections.length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading visit options…
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-muted/20 px-5 py-4 space-y-4">
      {/* Already-consumed-today notice */}
      {member.already_consumed_today && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Repeat visit today.</span> Mandatory items were not auto-added — consumption for this member's set menu has already been recorded. You can still select any additional items below if applicable.
          </p>
        </div>
      )}
      {/* Time bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${mins >= AUTO_CHECKOUT_MIN ? "bg-red-500" : mins >= 150 ? "bg-amber-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.min(100, (mins / AUTO_CHECKOUT_MIN) * 100)}%` }}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums flex-shrink-0 ${remaining <= 0 ? "text-red-500" : remaining <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
          {remaining <= 0
            ? "Auto-checkout overdue"
            : remaining <= 30
            ? `Auto-checkout in ${remaining} min`
            : `${mins} min of ${AUTO_CHECKOUT_MIN} min`}
        </span>
      </div>

      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      {menuItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">No menu items defined for this center yet.</p>
      ) : (
        <div className="space-y-3">
          {/* No batches open — show prominent warning */}
          {mandatory.every(m => !m.is_available) && mandatory.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">
                <span className="font-semibold">No set meals can be served.</span>{" "}
                Open a batch in Inventory before checking in members for a meal visit.
              </p>
            </div>
          )}

          {/* Mandatory items */}
          {mandatory.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Set Menu (Mandatory)
              </p>
              <div className="flex flex-wrap gap-2">
                {mandatory.map(item => {
                  const unavailable = !item.is_available;
                  return (
                    <div key={item.id}
                      title={unavailable ? "No open batch — open one in Inventory to serve this item" : "Included in this visit"}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        unavailable
                          ? "bg-muted/40 text-muted-foreground border-border/40 opacity-60"
                          : "bg-teal-100 text-teal-800 border-teal-200"
                      }`}
                    >
                      {unavailable
                        ? <XCircle className="w-3 h-3" />
                        : <Lock className="w-3 h-3" />}
                      <span className={unavailable ? "line-through" : ""}>{item.name}</span>
                      {!unavailable && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />}
                    </div>
                  );
                })}
              </div>
              {mandatory.some(m => !m.is_available) && !mandatory.every(m => !m.is_available) && (
                <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Crossed-out items have no open batch and will not be served or logged.
                </p>
              )}
            </div>
          )}

          {/* Optional items */}
          {optional.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Optional — tap to select
              </p>
              <div className="flex flex-wrap gap-2">
                {optional.map(item => {
                  const selected = selectedIds.has(item.id);
                  const canSelect = item.is_available || selected;
                  return (
                    <button
                      key={item.id}
                      onClick={() => void toggleItem(item)}
                      disabled={busy || (!canSelect)}
                      title={!item.is_available ? "No open batch — open one in Inventory to serve this item" : undefined}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:cursor-not-allowed ${
                        selected
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : canSelect
                          ? "bg-background text-foreground border-border hover:border-primary hover:text-primary"
                          : "bg-muted/50 text-muted-foreground border-border/50 opacity-40"
                      }`}
                    >
                      {selected
                        ? <CheckCircle2 className="w-3.5 h-3.5" />
                        : canSelect
                        ? <XCircle className="w-3.5 h-3.5 opacity-40" />
                        : <XCircle className="w-3.5 h-3.5" />}
                      <span className={!canSelect ? "line-through" : ""}>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checkout footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          {selectionCount > 0
            ? `${selectionCount} item${selectionCount !== 1 ? "s" : ""} will be logged at checkout`
            : "No items selected — consumption will not be logged"}
        </p>
        <button
          onClick={() => void handleCheckout()}
          disabled={checkingOut}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          Check Out & Book
        </button>
      </div>
    </div>
  );
}

// ── Health Panel ─────────────────────────────────────────────────────────────

function HealthPanel({ memberId, centerId, onClose }: {
  memberId: number; centerId: string; onClose: () => void;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [weight, setWeight] = useState("");
  const [bmi, setBmi] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [visceralFat, setVisceralFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [metabolicAge, setMetabolicAge] = useState("");
  const [bmr, setBmr] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  async function loadRecords() {
    setLoadingRecs(true);
    try {
      const data = await apiGet<HealthRecord[]>(`/admin/centers/${centerId}/members/${memberId}/health-records`);
      setRecords(data);
    } finally { setLoadingRecs(false); }
  }

  useEffect(() => { void loadRecords(); }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${memberId}/health-records`, {
        recorded_at: date,
        weight_kg: weight ? Number(weight) : undefined,
        bmi: bmi ? Number(bmi) : undefined,
        body_fat_pct: bodyFat ? Number(bodyFat) : undefined,
        visceral_fat: visceralFat ? Number(visceralFat) : undefined,
        muscle_mass_kg: muscleMass ? Number(muscleMass) : undefined,
        metabolic_age: metabolicAge ? Number(metabolicAge) : undefined,
        bmr: bmr ? Number(bmr) : undefined,
        resting_hr: restingHr ? Number(restingHr) : undefined,
        notes: notes.trim() || undefined,
      });
      setSaveSuccess(true);
      setWeight(""); setBmi(""); setBodyFat(""); setVisceralFat("");
      setMuscleMass(""); setMetabolicAge(""); setBmr(""); setRestingHr(""); setNotes("");
      setDate(todayStr);
      void loadRecords();
    } catch (err) { setSaveError((err as Error).message); }
    finally { setSaving(false); }
  }

  function fmt(v: number | null, dec = 1) { return v != null ? v.toFixed(dec) : "—"; }
  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  const fieldCls = "w-full h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50";
  const labelCls = "block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1";

  return (
    <div className="border-t border-border/50 bg-sky-50/40 px-5 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <span className="text-sm font-semibold text-foreground">Health Records</span>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {saveError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveError}</p>}
      {saveSuccess && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">✓ Health record saved.</p>}

      <form onSubmit={e => void handleSave(e)} className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={fieldCls} required />
          </div>
          <div>
            <label className={labelCls}>Weight (kg)</label>
            <input type="number" step="0.1" min="0" value={weight} onChange={e => setWeight(e.target.value)} className={fieldCls} placeholder="72.5" />
          </div>
          <div>
            <label className={labelCls}>BMI</label>
            <input type="number" step="0.1" min="0" value={bmi} onChange={e => setBmi(e.target.value)} className={fieldCls} placeholder="24.5" />
          </div>
          <div>
            <label className={labelCls}>Body Fat %</label>
            <input type="number" step="0.1" min="0" max="100" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className={fieldCls} placeholder="22.0" />
          </div>
          <div>
            <label className={labelCls}>Visceral Fat</label>
            <input type="number" step="0.5" min="0" value={visceralFat} onChange={e => setVisceralFat(e.target.value)} className={fieldCls} placeholder="8" />
          </div>
          <div>
            <label className={labelCls}>Muscle Mass (kg)</label>
            <input type="number" step="0.1" min="0" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} className={fieldCls} placeholder="28.0" />
          </div>
          <div>
            <label className={labelCls}>Metabolic Age</label>
            <input type="number" min="0" value={metabolicAge} onChange={e => setMetabolicAge(e.target.value)} className={fieldCls} placeholder="35" />
          </div>
          <div>
            <label className={labelCls}>BMR (kcal)</label>
            <input type="number" min="0" value={bmr} onChange={e => setBmr(e.target.value)} className={fieldCls} placeholder="1650" />
          </div>
          <div>
            <label className={labelCls}>Resting HR (bpm)</label>
            <input type="number" min="0" value={restingHr} onChange={e => setRestingHr(e.target.value)} className={fieldCls} placeholder="68" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Any observations…"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Save Record
          </button>
        </div>
      </form>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          History{records.length > 0 ? ` (${records.length})` : ""}
        </p>
        {loadingRecs ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-sky-400" /></div>
        ) : records.length === 0 ? (
          <p className="text-xs text-muted-foreground">No records yet — add one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Date</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Wt (kg)</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">BMI</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Fat %</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Visceral</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Muscle (kg)</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Met Age</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">BMR</th>
                  <th className="text-right px-3 py-2 font-medium whitespace-nowrap">HR</th>
                  <th className="text-left px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map(r => (
                  <tr key={r.id} className="bg-background hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-foreground">{fmtDate(r.recorded_at)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.weight_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.bmi)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.body_fat_pct)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.visceral_fat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(r.muscle_mass_kg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.metabolic_age ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.bmr != null ? Math.round(r.bmr).toString() : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.resting_hr ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Member Row ──────────────────────────────────────────────────────────────

function MemberRow({ member, centerId, onRefresh }: {
  member: CenterMember; centerId: string; onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const isCheckedIn = !!member.checkin_id;
  const mins = isCheckedIn ? minutesSince(member.checked_in_at!) : 0;

  async function handleCheckin() {
    const w = Number(weightKg);
    if (!w || w <= 0) return;
    setBusy(true);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/checkin`, { weight_kg: w });
      setShowWeightForm(false);
      setWeightKg("");
      onRefresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${member.name} from this center?`)) return;
    setBusy(true);
    try {
      await apiDelete(`/admin/centers/${centerId}/members/${member.id}`);
      onRefresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className={`border-b border-border last:border-0 ${isCheckedIn ? "bg-green-50/30" : ""}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="w-9 h-9 rounded-full bg-teal-pale flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-teal-dark">
            {member.name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-foreground truncate">{member.name}</p>
            {isCheckedIn && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                In
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {member.mobile && <p className="text-xs text-muted-foreground">{member.mobile}</p>}
            {isCheckedIn && member.checked_in_at && (
              <p className={`text-xs flex items-center gap-1 ${mins >= 150 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
                <Clock className="w-3 h-3" />
                Since {formatTime(member.checked_in_at)} · {mins} min
              </p>
            )}
            {!isCheckedIn && !showWeightForm && (
              <p className="text-xs text-muted-foreground">Not checked in</p>
            )}
            {!isCheckedIn && showWeightForm && (
              <p className="text-xs text-amber-700 font-medium">Enter today&apos;s weight to check in</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isCheckedIn && !showWeightForm && (
            <button
              onClick={() => setShowWeightForm(true)}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Check In
            </button>
          )}
          {!isCheckedIn && showWeightForm && (
            <>
              <input
                type="number"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void handleCheckin()}
                placeholder="kg"
                min="20" max="300" step="0.1"
                autoFocus
                className="w-20 h-7 px-2 text-sm rounded-lg border border-green-300 bg-white focus:outline-none focus:ring-1 focus:ring-green-400"
              />
              <button
                onClick={() => void handleCheckin()}
                disabled={!weightKg || Number(weightKg) <= 0 || busy}
                className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                Check In
              </button>
              <button
                onClick={() => { setShowWeightForm(false); setWeightKg(""); }}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowHealthPanel(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${showHealthPanel ? "text-sky-600 bg-sky-100" : "text-muted-foreground hover:text-sky-600 hover:bg-sky-50"}`}
            title="Health records"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
            title="Remove from center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Expanded visit panel for checked-in members */}
      {isCheckedIn && (
        <VisitPanel member={member} centerId={centerId} onCheckout={onRefresh} />
      )}
      {showHealthPanel && (
        <HealthPanel memberId={member.id} centerId={centerId} onClose={() => setShowHealthPanel(false)} />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const center = getAdminCenter();
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    if (!center) return;
    setLoading(true);
    apiGet<CenterMember[]>(`/admin/centers/${center.id}/members`)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [center?.id]);

  const checkedIn = members.filter(m => m.checkin_id);
  const notCheckedIn = members.filter(m => !m.checkin_id);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Members</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {members.length} member{members.length !== 1 ? "s" : ""} · {checkedIn.length} checked in
            </p>
          </div>
          {center && <AddMemberForm centerId={center.id} onAdded={load} />}
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground animate-pulse">Loading…</div>
        ) : members.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">Use "Onboard Member" to add the first member.</p>
          </div>
        ) : (
          <>
            {checkedIn.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-green-50">
                  <h2 className="text-sm font-semibold text-green-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Currently Checked In ({checkedIn.length})
                    <span className="ml-auto text-[10px] font-normal text-green-600 normal-case">
                      Auto-checkout at {AUTO_CHECKOUT_MIN} min · select items below each member
                    </span>
                  </h2>
                </div>
                {checkedIn.map(m => (
                  <MemberRow key={m.id} member={m} centerId={center!.id} onRefresh={load} />
                ))}
              </div>
            )}

            {notCheckedIn.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold text-muted-foreground">Not Checked In ({notCheckedIn.length})</h2>
                </div>
                {notCheckedIn.map(m => (
                  <MemberRow key={m.id} member={m} centerId={center!.id} onRefresh={load} />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
