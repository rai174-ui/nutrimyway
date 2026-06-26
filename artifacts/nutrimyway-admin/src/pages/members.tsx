import { useEffect, useState } from "react";
import { UserPlus, LogIn, LogOut, Trash2, Users, Clock, Search, Phone, Mail, UserCheck, UserX } from "lucide-react";
import { Nav } from "@/components/nav";
import { apiGet, apiPost, apiDelete, getAdminCenter, type CenterMember, type MemberLookup } from "@/lib/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

type LookupStep = "search" | "found" | "notfound" | "creating";

function AddMemberForm({ centerId, onAdded }: { centerId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<LookupStep>("search");
  const [searchKind, setSearchKind] = useState<"mobile" | "email">("mobile");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<MemberLookup | null>(null);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [height, setHeight] = useState("");
  const [doj, setDoj] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setStep("search"); setQuery(""); setFound(null); setError("");
    setName(""); setEmail(""); setMobile(""); setHeight(""); setDoj("");
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true); setError("");
    try {
      const params = searchKind === "mobile"
        ? `mobile=${encodeURIComponent(query.trim())}`
        : `email=${encodeURIComponent(query.trim())}`;
      const result = await apiGet<MemberLookup | null>(`/admin/members/lookup?${params}`);
      if (result) {
        setFound(result);
        setStep("found");
      } else {
        // Pre-fill the create form with what they typed
        if (searchKind === "mobile") setMobile(query.trim());
        else setEmail(query.trim());
        setStep("notfound");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally { setSearching(false); }
  }

  async function handleLink() {
    if (!found) return;
    setSaving(true); setError("");
    try {
      await apiPost(`/admin/centers/${centerId}/members/link`, { member_id: found.id });
      setOpen(false); reset(); onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to link member");
    } finally { setSaving(false); }
  }

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      await apiPost(`/admin/centers/${centerId}/members`, {
        name: name.trim(),
        mobile: mobile.trim() || null,
        email: email.trim() || null,
        height_cm: height ? Number(height) : null,
        date_of_joining: doj || null,
      });
      setOpen(false); reset(); onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    } finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Onboard Member
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Onboard Member</h3>
        <button onClick={() => { setOpen(false); reset(); }} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      {/* Step 1: Search */}
      {(step === "search" || step === "notfound") && step === "search" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Search for an existing member first to avoid duplicates.</p>
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <button
              onClick={() => setSearchKind("mobile")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${searchKind === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Phone className="w-3 h-3" />Mobile
            </button>
            <button
              onClick={() => setSearchKind("email")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${searchKind === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Mail className="w-3 h-3" />Email
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder={searchKind === "mobile" ? "+91 98765 43210" : "member@email.com"}
              type={searchKind === "email" ? "email" : "tel"}
              className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || searching}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              {searching ? "..." : "Search"}
            </button>
          </div>
          <button
            onClick={() => { setStep("notfound"); setError(""); }}
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            Skip search — create new member directly
          </button>
        </div>
      )}

      {/* Step 2a: Member found */}
      {step === "found" && found && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
            <UserCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800">Member found</p>
              <p className="text-sm font-medium text-foreground mt-1">{found.name}</p>
              {found.mobile && <p className="text-xs text-muted-foreground">{found.mobile}</p>}
              {found.email && <p className="text-xs text-muted-foreground">{found.email}</p>}
              {found.height_cm && <p className="text-xs text-muted-foreground">Height: {found.height_cm} cm</p>}
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            <button
              onClick={() => { setFound(null); setStep("search"); setError(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Search again
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (searchKind === "mobile") setMobile(query.trim());
                  else setEmail(query.trim());
                  setStep("notfound");
                  setError("");
                }}
                className="px-3 py-2 rounded-lg text-xs border border-border hover:bg-muted transition-colors"
              >
                Create new instead
              </button>
              <button
                onClick={handleLink}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
                {saving ? "Linking..." : "Link to Center"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2b: Not found — create form */}
      {step === "notfound" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
            <UserX className="w-3.5 h-3.5 flex-shrink-0" />
            No existing member found — fill in details to create a new one.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mobile</label>
              <input
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+91 ..."
                type="tel"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Email</label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="member@email.com"
                type="email"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Height (cm)</label>
              <input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="e.g. 165"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date of Joining</label>
              <input
                type="date"
                value={doj}
                onChange={e => setDoj(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-between">
            <button
              onClick={() => { setStep("search"); setError(""); }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back to search
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {saving ? "Creating..." : "Create & Add"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, centerId, onRefresh }: {
  member: CenterMember; centerId: string; onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isCheckedIn = !!member.checkin_id;

  async function handleCheckin() {
    setBusy(true);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/checkin`, {});
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleCheckout() {
    setBusy(true);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/checkout`, {});
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${member.name} from this center?`)) return;
    setBusy(true);
    try {
      await apiDelete(`/admin/centers/${centerId}/members/${member.id}`);
      onRefresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Since {formatTime(member.checked_in_at)}
            </p>
          )}
          {!isCheckedIn && <p className="text-xs text-muted-foreground">Not checked in</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isCheckedIn ? (
          <button
            onClick={handleCheckout}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Check Out
          </button>
        ) : (
          <button
            onClick={handleCheckin}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            Check In
          </button>
        )}
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
  );
}

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
              {members.length} member{members.length !== 1 ? "s" : ""} · {checkedIn.length} checked in today
            </p>
          </div>
          {center && <AddMemberForm centerId={center.id} onAdded={load} />}
        </div>

        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground animate-pulse">Loading...</div>
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
