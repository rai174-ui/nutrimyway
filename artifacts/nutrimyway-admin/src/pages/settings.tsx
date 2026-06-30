import { useState, useEffect, useRef } from "react";
import { KeyRound, CheckCircle2, Loader2, Package, Plus, Edit2, Check, X, Trash2, Users, AlertTriangle, QrCode, Download, Tag } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Nav } from "@/components/nav";
import { apiPost, apiGet, apiPut, apiDelete, getAdminCenter, type Ingredient, type CenterFlavour, type CenterMember } from "@/lib/api";

const UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];

// ── Flavour Master ────────────────────────────────────────────────────────────

function FlavourMaster() {
  const center = getAdminCenter();
  const [flavours, setFlavours] = useState<CenterFlavour[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await apiPost(`/admin/centers/${center.id}/flavours`, { name: newName.trim() });
      setNewName(""); setAdding(false);
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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <Tag className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Flavour Master</h2>
            <p className="text-xs text-muted-foreground">Define flavour options available in Item Master</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {flavours.length}
          </span>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setError(null); setNewName(""); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
      )}

      {adding && (
        <div className="px-5 py-4 border-b border-dashed border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void addFlavour()}
              autoFocus
              placeholder="Flavour name e.g. Chocolate, Vanilla"
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
        <div className="flex flex-wrap gap-2 px-5 py-4">
          {flavours.map(f => (
            <span key={f.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-sm">
              {f.name}
              <button onClick={() => void deleteFlavour(f.id)} className="text-violet-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
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
  const [newFlavour, setNewFlavour] = useState("");
  const [newServingQty, setNewServingQty] = useState("1");

  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editMaterialCode, setEditMaterialCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFlavour, setEditFlavour] = useState("");
  const [editServingQty, setEditServingQty] = useState("1");

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
    setSaving(true); setError(null);
    try {
      await apiPost<Ingredient>("/admin/ingredients", {
        name: newName.trim(),
        pack_size: 1,
        pack_unit: newUnit,
        material_code: newMaterialCode.trim() || null,
        description: newDescription.trim() || null,
        flavour: newFlavour.trim() || null,
        serving_qty: Number(newServingQty) || 1,
      });
      setNewName(""); setNewUnit("g");
      setNewMaterialCode(""); setNewDescription(""); setNewFlavour(""); setNewServingQty("1");
      setAdding(false);
      void load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    setSaving(true); setError(null);
    try {
      const cur = ingredients.find(i => i.id === id);
      await apiPut<Ingredient>(`/admin/ingredients/${id}`, {
        name: editName.trim(),
        pack_size: cur?.pack_size ?? 1,
        pack_unit: editUnit,
        material_code: editMaterialCode.trim() || null,
        description: editDescription.trim() || null,
        flavour: editFlavour.trim() || null,
        serving_qty: Number(editServingQty) || 1,
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
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
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
              placeholder="Material code"
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
          <div className="flex items-center gap-2">
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
        <div className="divide-y divide-border">
          {ingredients.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No items yet. Add one above — BOM and inventory can only use items from this list.
            </p>
          )}
          {ingredients.map(ing => (
            <div key={ing.id} className="group">
              {editId === ing.id ? (
                <div className="px-5 py-3 space-y-2 bg-muted/20">
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
                      placeholder="Material code"
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
                  <div className="flex items-center gap-2">
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
                <div className="flex items-start gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{ing.name}</span>
                      {ing.material_code && (
                        <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ing.material_code}</span>
                      )}
                      {ing.flavour && (
                        <span className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full">{ing.flavour}</span>
                      )}
                      {ing.flavour && (
                        <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full">{ing.serving_qty} {ing.pack_unit}/serve</span>
                      )}
                    </div>
                    {ing.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{ing.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">Unit: {ing.pack_unit}</p>
                  </div>
                  <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEdit(ing)} className="text-muted-foreground hover:text-primary">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => void deleteIngredient(ing.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Center QR Code ─────────────────────────────────────────────────────────────

function CenterQRCode() {
  const center = getAdminCenter();
  const canvasRef = useRef<HTMLDivElement>(null);

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
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <QrCode className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground leading-tight">Check-In QR Code</h2>
          <p className="text-xs text-muted-foreground">Members scan this QR to check in to your center</p>
        </div>
      </div>

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
          <p className="text-muted-foreground text-sm mt-1">Manage flavours, item master, center QR code, and admin password</p>
        </div>

        <FlavourMaster />

        <ItemMaster />

        <CenterQRCode />

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
