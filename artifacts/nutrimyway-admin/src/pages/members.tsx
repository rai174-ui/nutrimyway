import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  UserPlus, LogIn, LogOut, Users, Clock,
  Search, Phone, Mail, UserCheck, UserX,
  Lock, CheckCircle2, XCircle, AlertTriangle, Loader2, X, Activity, Plus, Hash, RotateCcw, CalendarClock, Pencil, Save,
  FileDown, ClipboardList,
} from "lucide-react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiPatch, apiDelete, getAdminCenter,
  type CenterMember, type MemberLookup, type MenuItem, type VisitMenuSelection, type HealthRecord,
} from "@/lib/api";

const AUTO_CHECKOUT_MIN = 180;

interface FlavourOption { id: number; name: string; flavour: string; unit: string; }
interface FlavourSelection { id: number; checkin_id: number; ingredient_id: number; flavour: string; }

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function fmtDateDMY(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
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
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [ageAtJoining, setAgeAtJoining] = useState("");
  const [validUntil, setValidUntil] = useState("");
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
    setDobDay(""); setDobMonth(""); setAgeAtJoining(""); setValidUntil("");
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
        dob: dobDay && dobMonth ? `${dobDay} ${dobMonth}` : null,
        age_at_joining: ageAtJoining ? Number(ageAtJoining) : null,
        valid_until: validUntil || null,
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Birth Day</label>
              <input type="number" min="1" max="31" value={dobDay} onChange={e => setDobDay(e.target.value)} placeholder="1–31" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Birth Month</label>
              <select value={dobMonth} onChange={e => setDobMonth(e.target.value)} className={inputCls}>
                <option value="">Month</option>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Age at Joining</label>
              <input type="number" step="0.5" min="1" max="100" value={ageAtJoining} onChange={e => setAgeAtJoining(e.target.value)} placeholder="e.g. 35.5" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Membership Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={inputCls} />
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
  const [flavourOptions, setFlavourOptions] = useState<FlavourOption[]>([]);
  const [flavourSelections, setFlavourSelections] = useState<FlavourSelection[]>([]);
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
      const [items, sels, fOpts, fSels] = await Promise.all([
        apiGet<MenuItem[]>(`/admin/centers/${centerId}/menu-items`),
        apiGet<VisitMenuSelection[]>(`/admin/checkins/${checkinId}/menu-selections`),
        apiGet<FlavourOption[]>(`/admin/checkins/${checkinId}/flavour-options`),
        apiGet<FlavourSelection[]>(`/admin/checkins/${checkinId}/flavour-selections`),
      ]);
      setMenuItems(items);
      setSelections(sels);
      setFlavourOptions(fOpts);
      setFlavourSelections(fSels);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [centerId, checkinId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedIds = new Set(selections.map(s => s.menu_item_id));
  const selectedFlavourIngredientIds = new Set(flavourSelections.map(f => f.ingredient_id));

  async function toggleFlavour(opt: FlavourOption) {
    setBusy(true); setError(null);
    try {
      const existing = flavourSelections.find(f => f.ingredient_id === opt.id);
      if (existing) {
        await apiDelete(`/admin/flavour-selections/${existing.id}`);
        setFlavourSelections(prev => prev.filter(f => f.id !== existing.id));
      } else {
        const created = await apiPost<FlavourSelection>(`/admin/checkins/${checkinId}/flavour-selections`, {
          ingredient_id: opt.id,
          flavour: opt.flavour,
        });
        setFlavourSelections(prev => [...prev, created]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

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

  async function handleCancelCheckin() {
    setCheckingOut(true); setError(null);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/cancel-checkin`, {});
      onCheckout();
    } catch (e) { setError((e as Error).message); }
    finally { setCheckingOut(false); }
  }

  const mins = minutesSince(member.checked_in_at!);
  const remaining = AUTO_CHECKOUT_MIN - mins;
  const mandatory = menuItems.filter(m => m.is_mandatory);
  const optional = menuItems.filter(m => !m.is_mandatory);
  const selectionCount = selections.length + flavourSelections.length;

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

      {/* Direct flavour items */}
      {flavourOptions.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Direct Items — tap to select
          </p>
          <div className="flex flex-wrap gap-2">
            {flavourOptions.map(opt => {
              const selected = selectedFlavourIngredientIds.has(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => void toggleFlavour(opt)}
                  disabled={busy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:cursor-not-allowed ${
                    selected
                      ? "bg-violet-100 text-violet-800 border-violet-300"
                      : "bg-background text-foreground border-border hover:border-violet-400 hover:text-violet-700"
                  }`}
                >
                  {selected
                    ? <CheckCircle2 className="w-3.5 h-3.5" />
                    : <XCircle className="w-3.5 h-3.5 opacity-40" />}
                  {opt.flavour}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Checkout footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50 gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex-1">
          {selectionCount > 0
            ? `${selectionCount} item${selectionCount !== 1 ? "s" : ""} will be logged at checkout`
            : "No items selected — consumption will not be logged"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void handleCancelCheckin()}
            disabled={checkingOut}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5 disabled:opacity-50 transition-colors"
            title="Check out without recording any consumption"
          >
            {checkingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Cancel Check-in
          </button>
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
  function fmtDate(iso: string) { return fmtDateDMY(iso); }

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

function validityBadge(valid_until: string | null) {
  if (!valid_until) return null;
  const now = new Date();
  const exp = new Date(valid_until);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = fmtDateDMY(valid_until);
  if (daysLeft <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-300 rounded-full px-2 py-0.5">
        <CalendarClock className="w-3 h-3" />Expired {label}
      </span>
    );
  }
  if (daysLeft <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
        <CalendarClock className="w-3 h-3" />Expires in {daysLeft}d · {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CalendarClock className="w-3 h-3" />Valid to {label}
    </span>
  );
}

function MemberRow({ member, centerId, onRefresh }: {
  member: CenterMember; centerId: string; onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [showHealthPanel, setShowHealthPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  // edit fields
  const [editName, setEditName]               = useState("");
  const [editMobile, setEditMobile]           = useState("");
  const [editEmail, setEditEmail]             = useState("");
  const [editMembershipNo, setEditMembershipNo] = useState("");
  const [editHeight, setEditHeight]           = useState("");
  const [editDoj, setEditDoj]                 = useState("");
  const [editDobDay, setEditDobDay]           = useState("");
  const [editDobMonth, setEditDobMonth]       = useState("");
  const [editAge, setEditAge]                 = useState("");
  const [editValidUntil, setEditValidUntil]   = useState("");
  const [editSaving, setEditSaving]           = useState(false);
  const [editError, setEditError]             = useState("");

  const isCheckedIn = !!member.checkin_id;
  const mins = isCheckedIn ? minutesSince(member.checked_in_at!) : 0;

  function openEdit() {
    const [dobDay = "", dobMonth = ""] = (member.dob ?? "").split(" ");
    setEditName(member.name);
    setEditMobile(member.mobile ?? "");
    setEditEmail(member.email ?? "");
    setEditMembershipNo(member.membership_no ?? "");
    setEditHeight(member.height_cm != null ? String(member.height_cm) : "");
    setEditDoj(member.date_of_joining ? member.date_of_joining.slice(0, 10) : "");
    setEditDobDay(dobDay);
    setEditDobMonth(dobMonth);
    setEditAge(member.age_at_joining != null ? String(member.age_at_joining) : "");
    setEditValidUntil(member.valid_until ? member.valid_until.slice(0, 10) : "");
    setEditError("");
    setShowEditPanel(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { setEditError("Name is required"); return; }
    setEditSaving(true); setEditError("");
    try {
      await apiPatch(`/admin/centers/${centerId}/members/${member.id}`, {
        name: editName.trim(),
        mobile: editMobile.trim() || null,
        email: editEmail.trim() || null,
        membership_no: editMembershipNo.trim() || null,
        height_cm: editHeight ? Number(editHeight) : null,
        date_of_joining: editDoj || null,
        dob: editDobDay && editDobMonth ? `${editDobDay} ${editDobMonth}` : null,
        age_at_joining: editAge ? Number(editAge) : null,
        valid_until: editValidUntil || null,
      });
      setShowEditPanel(false);
      onRefresh();
    } catch (e) { setEditError(e instanceof Error ? e.message : "Save failed"); }
    finally { setEditSaving(false); }
  }

  async function handleToggleStatus() {
    setBusy(true);
    try {
      await apiPatch(`/admin/centers/${centerId}/members/${member.id}/status`);
      onRefresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  const renewDaysLeft = member.valid_until
    ? Math.ceil((new Date(member.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showRenew = renewDaysLeft !== null && renewDaysLeft <= 10;

  async function handleRenew() {
    if (!confirm(`Renew Membership for ${member.name} by 32 days?`)) return;
    setBusy(true);
    try {
      await apiPatch(`/admin/centers/${centerId}/members/${member.id}/renew`);
      onRefresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Renewal failed"); }
    finally { setBusy(false); }
  }

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

  return (
    <div className={`border-b border-border last:border-0 ${isCheckedIn ? "bg-green-50/30" : ""} ${!member.is_active ? "opacity-55 bg-muted/20" : ""}`}>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
            {member.mobile && <p className="text-xs text-muted-foreground">{member.mobile}</p>}
            {validityBadge(member.valid_until)}
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
          {showRenew && (
            <button
              onClick={() => void handleRenew()}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 transition-colors border border-emerald-200"
              title="Renew Membership (+32 days from today)"
            >
              <RotateCcw className="w-3.5 h-3.5" />Renew Membership
            </button>
          )}
          <button
            onClick={openEdit}
            className={`p-1.5 rounded-lg transition-colors ${showEditPanel ? "text-violet-600 bg-violet-100" : "text-muted-foreground hover:text-violet-600 hover:bg-violet-50"}`}
            title="Edit member"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowHealthPanel(v => !v)}
            className={`p-1.5 rounded-lg transition-colors ${showHealthPanel ? "text-sky-600 bg-sky-100" : "text-muted-foreground hover:text-sky-600 hover:bg-sky-50"}`}
            title="Health records"
          >
            <Activity className="w-4 h-4" />
          </button>
          <button
            onClick={() => void handleToggleStatus()}
            disabled={busy}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${member.is_active ? "text-muted-foreground hover:text-amber-600 hover:bg-amber-50" : "text-amber-600 bg-amber-50 hover:bg-amber-100"}`}
            title={member.is_active ? "Deactivate member" : "Activate member"}
          >
            {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </button>
        </div>
      </div>
      {/* Expanded visit panel for checked-in members */}
      {isCheckedIn && (
        <VisitPanel member={member} centerId={centerId} onCheckout={onRefresh} />
      )}
      {showEditPanel && (
        <div className="border-t border-violet-100 bg-violet-50/40 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-700">Edit Member</p>
            <button onClick={() => setShowEditPanel(false)} className="p-1 rounded text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Name *</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Full name"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Mobile</label>
              <input value={editMobile} onChange={e => setEditMobile(e.target.value)} placeholder="+91 ..." type="tel"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Email</label>
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="member@email.com" type="email"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Member ID</label>
              <input value={editMembershipNo} onChange={e => setEditMembershipNo(e.target.value)} placeholder="MEM-001"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Height (cm)</label>
              <input type="number" value={editHeight} onChange={e => setEditHeight(e.target.value)} placeholder="165"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Date of Joining</label>
              <input type="date" value={editDoj} onChange={e => setEditDoj(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Birth Day</label>
              <input type="number" min="1" max="31" value={editDobDay} onChange={e => setEditDobDay(e.target.value)} placeholder="1–31"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Birth Month</label>
              <select value={editDobMonth} onChange={e => setEditDobMonth(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Month</option>
                {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Age at Joining</label>
              <input type="number" step="0.5" min="1" max="100" value={editAge} onChange={e => setEditAge(e.target.value)} placeholder="35.5"
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">Membership Valid Until</label>
              <input type="date" value={editValidUntil} onChange={e => setEditValidUntil(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          {editError && (
            <p className="mt-2 text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2">{editError}</p>
          )}
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={() => setShowEditPanel(false)}
              disabled={editSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button onClick={() => void handleSaveEdit()} disabled={editSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors">
              {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>
      )}
      {showHealthPanel && (
        <HealthPanel memberId={member.id} centerId={centerId} onClose={() => setShowHealthPanel(false)} />
      )}
    </div>
  );
}

// ── Health Report Modal ───────────────────────────────────────────────────────

interface HealthReportRecord extends HealthRecord {
  member_name: string;
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function thirtyDaysAgoISO() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
}

function HealthReportModal({ centerId, members, onClose }: {
  centerId: string;
  members: CenterMember[];
  onClose: () => void;
}) {
  const [from, setFrom] = useState(thirtyDaysAgoISO);
  const [to, setTo] = useState(todayISO);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(members.map(m => m.id)));
  const [records, setRecords] = useState<HealthReportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allSelected = members.every(m => selectedIds.has(m.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(members.map(m => m.id)));
  }

  function toggleMember(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!from || !to) return;
      setLoading(true);
      const ids = Array.from(selectedIds);
      const qs = new URLSearchParams({ from, to });
      if (ids.length > 0 && ids.length < members.length) {
        qs.set("member_ids", ids.join(","));
      }
      apiGet<HealthReportRecord[]>(`/admin/centers/${centerId}/health-records?${qs.toString()}`)
        .then(rows => {
          // If no members selected, show empty immediately without a round-trip
          if (ids.length === 0) { setRecords([]); setLoading(false); return; }
          setRecords(rows);
        })
        .catch(() => setRecords([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [from, to, selectedIds, centerId, members.length]);

  function downloadCSV() {
    const header = ["Member Name","Date","Weight (kg)","BMI","Body Fat %","Visceral Fat","BMR (kcal)","Metabolic Age","Muscle Mass (kg)","Resting HR (bpm)","Notes"];
    const rows = records.map(r => [
      r.member_name,
      fmtDateDMY(r.recorded_at),
      r.weight_kg ?? "",
      r.bmi ?? "",
      r.body_fat_pct ?? "",
      r.visceral_fat ?? "",
      r.bmr ?? "",
      r.metabolic_age ?? "",
      r.muscle_mass_kg ?? "",
      r.resting_hr ?? "",
      (r.notes ?? "").replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map(row => row.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-records-${centerId}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fmt(v: number | null, dec = 1) { return v != null ? v.toFixed(dec) : "—"; }

  const visibleMembers = memberSearch.trim()
    ? members.filter(m => m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()))
    : members;

  const uniqueMemberCount = new Set(records.map(r => r.member_id)).size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border bg-card flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-sky-600" />
          <h2 className="text-base font-semibold text-foreground">Health Records Report</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label className="font-medium">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-8 px-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            <label className="font-medium">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-8 px-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={downloadCSV} disabled={records.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 transition-colors">
            <FileDown className="w-4 h-4" />Download CSV
          </button>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Member sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-border flex flex-col bg-card">
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search members…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-input rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="px-3 py-2 border-b border-border">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={allSelected} onChange={toggleAll}
                className="rounded text-primary accent-primary" />
              <span className="text-xs font-semibold text-foreground">All members</span>
            </label>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {visibleMembers.map(m => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40 select-none">
                <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleMember(m.id)}
                  className="rounded accent-primary flex-shrink-0" />
                <span className="text-xs text-foreground truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </aside>

        {/* Table area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Summary row */}
          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-3 flex-shrink-0">
            {loading ? (
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />Fetching records…
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{records.length}</span> record{records.length !== 1 ? "s" : ""} for{" "}
                <span className="font-semibold text-foreground">{uniqueMemberCount}</span> member{uniqueMemberCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Scrollable table */}
          <div className="flex-1 overflow-auto">
            {!loading && records.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 px-8 gap-3">
                <Activity className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No health records found</p>
                <p className="text-xs text-muted-foreground/70">Try expanding the date range or selecting more members.</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead className="sticky top-0 bg-muted z-10">
                  <tr>
                    {["Member","Date","Weight (kg)","BMI","Body Fat %","Visceral Fat","BMR","Met. Age","Muscle (kg)","Resting HR","Notes"].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r.member_name}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDateDMY(r.recorded_at)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(r.weight_kg)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(r.bmi)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(r.body_fat_pct)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(r.visceral_fat)}</td>
                      <td className="px-3 py-2 tabular-nums">{r.bmr != null ? r.bmr.toFixed(0) : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{r.metabolic_age != null ? r.metabolic_age.toFixed(0) : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(r.muscle_mass_kg)}</td>
                      <td className="px-3 py-2 tabular-nums">{r.resting_hr != null ? r.resting_hr.toFixed(0) : "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate" title={r.notes ?? ""}>{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const center = getAdminCenter();
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showHealthReport, setShowHealthReport] = useState(false);
  const [, navigate] = useLocation();

  const expiringSoon = new URLSearchParams(window.location.search).get("expiring_soon") === "true";

  function load() {
    if (!center) return;
    setLoading(true);
    const qs = expiringSoon ? "?expiring_soon=true" : "";
    apiGet<CenterMember[]>(`/admin/centers/${center.id}/members${qs}`)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [center?.id, expiringSoon]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? members.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.mobile?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.membership_no?.toLowerCase().includes(q)
      )
    : members;

  const checkedIn    = filtered.filter(m => m.checkin_id);
  const notCheckedIn = filtered.filter(m => !m.checkin_id);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Members</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {members.length} member{members.length !== 1 ? "s" : ""} · {members.filter(m => m.checkin_id).length} checked in
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {members.length > 0 && (
              <button
                onClick={() => setShowHealthReport(true)}
                className="flex items-center gap-2 border border-border bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <ClipboardList className="w-4 h-4 text-sky-600" />Health Report
              </button>
            )}
            {center && <AddMemberForm centerId={center.id} onAdded={load} />}
          </div>
        </div>

        {showHealthReport && center && (
          <HealthReportModal
            centerId={center.id}
            members={members}
            onClose={() => setShowHealthReport(false)}
          />
        )}

        {/* Expiring soon filter banner */}
        {expiringSoon && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-sm">
            <span className="flex items-center gap-2 text-amber-800 font-medium">
              <CalendarClock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              Showing members whose membership expires within 10 days
            </span>
            <button
              onClick={() => navigate("/members")}
              className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />Clear filter
            </button>
          </div>
        )}

        {/* Search bar */}
        {members.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, mobile, email or member ID…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground animate-pulse">Loading…</div>
        ) : members.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-foreground">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">Use "Onboard Member" to add the first member.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No members match "<span className="font-medium text-foreground">{search}</span>"</p>
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
