import { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, Loader2, Package, Plus, Edit2, Check, X, Trash2, Users, AlertTriangle } from "lucide-react";
import { Nav } from "@/components/nav";
import { apiPost, apiGet, apiPut, apiDelete, getAdminCenter, type Ingredient, type CenterMember } from "@/lib/api";

const UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];

// ── Ingredient Master ─────────────────────────────────────────────────────────

function IngredientMaster() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState("1");
  const [newUnit, setNewUnit] = useState("g");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiGet<Ingredient[]>("/admin/ingredients");
      setIngredients(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function addIngredient() {
    if (!newName.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiPost<Ingredient>("/admin/ingredients", {
        name: newName.trim(), pack_size: Number(newSize) || 1, pack_unit: newUnit,
      });
      setNewName(""); setNewSize("1"); setNewUnit("g"); setAdding(false);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiPut<Ingredient>(`/admin/ingredients/${id}`, {
        name: editName.trim(), pack_size: Number(editSize) || 1, pack_unit: editUnit,
      });
      setEditId(null);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteIngredient(id: number) {
    if (!confirm("Delete this ingredient? All batch records for this ingredient will also be removed.")) return;
    try {
      await apiDelete(`/admin/ingredients/${id}`);
      void load();
    } catch (e) { setError((e as Error).message); }
  }

  function startEdit(ing: Ingredient) {
    setEditId(ing.id);
    setEditName(ing.name);
    setEditSize(String(ing.pack_size));
    setEditUnit(ing.pack_unit);
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Ingredient Master</h2>
            <p className="text-xs text-muted-foreground">Define ingredients and pack sizes used in BOM &amp; inventory</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {ingredients.length}
          </span>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setError(null); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {adding && (
        <div className="px-5 py-3 border-b border-dashed border-border bg-muted/30 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Ingredient name…"
            onKeyDown={e => e.key === "Enter" && void addIngredient()}
            autoFocus
          />
          <input
            value={newSize}
            onChange={e => setNewSize(e.target.value)}
            type="number" min="0" step="any"
            className="w-24 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Pack size"
          />
          <select
            value={newUnit}
            onChange={e => setNewUnit(e.target.value)}
            className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
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
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {ingredients.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No ingredients yet. Add one above — BOM and inventory can only use ingredients from this list.
            </p>
          )}
          {ingredients.map(ing => (
            <div key={ing.id} className="flex items-center gap-3 px-5 py-3 group">
              {editId === ing.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <input
                    value={editSize}
                    onChange={e => setEditSize(e.target.value)}
                    type="number" min="0" step="any"
                    className="w-24 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <select
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
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
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-foreground">{ing.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{ing.pack_size} {ing.pack_unit} / pack</span>
                  <button
                    onClick={() => startEdit(ing)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void deleteIngredient(ing.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
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
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
          <Users className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground leading-tight">Delete Member</h2>
          <p className="text-xs text-muted-foreground">Permanently remove a member and all their data</p>
        </div>
      </div>

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
          <p className="text-muted-foreground text-sm mt-1">Manage ingredients master and center admin password</p>
        </div>

        <IngredientMaster />

        <MemberManager />

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground leading-tight">Change Password</h2>
              <p className="text-xs text-muted-foreground">Update your center admin login password</p>
            </div>
          </div>

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
      </main>
    </div>
  );
}
