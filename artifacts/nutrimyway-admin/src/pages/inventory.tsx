import { useState, useEffect, useMemo } from "react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiPut, apiDelete, apiPatch,
  getAdminCenter,
  type Ingredient, type IngredientBatch, type BatchStatus,
} from "@/lib/api";
import {
  Package, Plus, Edit2, Check, X, Loader2, Trash2,
  PackageOpen, PackageCheck, ChevronDown, ChevronRight,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function StatusChip({ status }: { status: BatchStatus }) {
  const cfg = {
    new: "bg-sky-100 text-sky-700 border-sky-200",
    open: "bg-emerald-100 text-emerald-700 border-emerald-200",
    consumed: "bg-slate-100 text-slate-500 border-slate-200",
  }[status];
  const label = status === "new" ? "New" : status === "open" ? "Open" : "Consumed";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg}`}>
      {label}
    </span>
  );
}

// ── Ingredient Catalog ────────────────────────────────────────────────────────

const UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];

function IngredientCatalog({
  ingredients,
  onRefresh,
}: {
  ingredients: Ingredient[];
  onRefresh: () => void;
}) {
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

  async function addIngredient() {
    if (!newName.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiPost<Ingredient>("/admin/ingredients", {
        name: newName.trim(),
        pack_size: Number(newSize) || 1,
        pack_unit: newUnit,
      });
      setNewName(""); setNewSize("1"); setNewUnit("g"); setAdding(false);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function saveEdit(id: number) {
    if (!editName.trim()) return;
    setSaving(true); setError(null);
    try {
      await apiPut<Ingredient>(`/admin/ingredients/${id}`, {
        name: editName.trim(),
        pack_size: Number(editSize) || 1,
        pack_unit: editUnit,
      });
      setEditId(null);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteIngredient(id: number) {
    if (!confirm("Delete this ingredient? All batch records for this ingredient will also be removed.")) return;
    try {
      await apiDelete(`/admin/ingredients/${id}`);
      onRefresh();
    } catch (e) { setError((e as Error).message); }
  }

  function startEdit(ing: Ingredient) {
    setEditId(ing.id);
    setEditName(ing.name);
    setEditSize(String(ing.pack_size));
    setEditUnit(ing.pack_unit);
  }

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Ingredient Catalog</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {ingredients.length}
          </span>
        </div>
        <button
          onClick={() => { setAdding(v => !v); setError(null); }}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Ingredient
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
            className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Pack size"
          />
          <select
            value={newUnit}
            onChange={e => setNewUnit(e.target.value)}
            className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
          <button onClick={() => void addIngredient()} disabled={!newName.trim() || saving}
            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
          </button>
          <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="divide-y divide-border">
        {ingredients.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No ingredients yet. Add one above.</p>
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
                  className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <select
                  value={editUnit}
                  onChange={e => setEditUnit(e.target.value)}
                  className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
                <button onClick={() => void saveEdit(ing.id)} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium text-foreground">{ing.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {ing.pack_size} {ing.pack_unit} / pack
                </span>
                <button onClick={() => startEdit(ing)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => void deleteIngredient(ing.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Add Batch Form ─────────────────────────────────────────────────────────────

function AddBatchForm({
  centerId,
  ingredients,
  onAdded,
  onCancel,
}: {
  centerId: string;
  ingredients: Ingredient[];
  onAdded: (b: IngredientBatch) => void;
  onCancel: () => void;
}) {
  const [ingredientId, setIngredientId] = useState<string>(ingredients[0]?.id ? String(ingredients[0].id) : "");
  const [batchNumber, setBatchNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!ingredientId || !batchNumber.trim()) return;
    setSaving(true); setError(null);
    try {
      const b = await apiPost<IngredientBatch>(
        `/admin/centers/${centerId}/ingredient-batches`,
        { ingredient_id: Number(ingredientId), batch_number: batchNumber.trim() }
      );
      onAdded(b);
      setBatchNumber(""); setIngredientId(ingredients[0]?.id ? String(ingredients[0].id) : "");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-5 py-3 border-b border-dashed border-border bg-muted/30">
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={ingredientId}
          onChange={e => setIngredientId(e.target.value)}
          className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.pack_size}{i.pack_unit})</option>)}
        </select>
        <input
          value={batchNumber}
          onChange={e => setBatchNumber(e.target.value)}
          className="w-40 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Batch / lot number"
          onKeyDown={e => e.key === "Enter" && void add()}
        />
        <button onClick={() => void add()} disabled={!ingredientId || !batchNumber.trim() || saving}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add Batch"}
        </button>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Batch row ──────────────────────────────────────────────────────────────────

function BatchRow({
  batch,
  onOpen,
  onConsume,
  onDelete,
}: {
  batch: IngredientBatch;
  onOpen: (id: number) => Promise<void>;
  onConsume: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 py-2.5 pl-6 pr-4 group">
        <StatusChip status={batch.status} />
        <span className="text-sm font-mono text-foreground">{batch.batch_number}</span>
        <span className="flex-1 text-xs text-muted-foreground">
          {batch.status === "new" && `Added ${fmt(batch.created_at)}`}
          {batch.status === "open" && `Opened ${fmt(batch.opened_at)}`}
          {batch.status === "consumed" && `Consumed ${fmt(batch.consumed_at)}`}
        </span>

        {batch.status === "new" && (
          <>
            <button
              onClick={() => void act(() => onOpen(batch.id))}
              disabled={busy}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
              Open
            </button>
            <button
              onClick={() => void act(() => onDelete(batch.id))}
              disabled={busy}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {batch.status === "open" && (
          <button
            onClick={() => void act(() => onConsume(batch.id))}
            disabled={busy}
            className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
            Mark Empty
          </button>
        )}
      </div>
      {error && (
        <p className="pl-6 pr-4 pb-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// ── Batch Inventory ─────────────────────────────────────────────────────────────

function BatchInventory({
  centerId,
  ingredients,
  batches,
  onRefresh,
}: {
  centerId: string;
  ingredients: Ingredient[];
  batches: IngredientBatch[];
  onRefresh: () => void;
}) {
  const [addingBatch, setAddingBatch] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<number, { ingredient: Ingredient; batches: IngredientBatch[] }>();
    for (const ing of ingredients) {
      map.set(ing.id, { ingredient: ing, batches: [] });
    }
    for (const b of batches) {
      const g = map.get(b.ingredient_id);
      if (g) g.batches.push(b);
    }
    return [...map.values()].filter(g => g.batches.length > 0 || ingredients.length > 0);
  }, [ingredients, batches]);

  async function openBatch(id: number) {
    await apiPatch(`/admin/ingredient-batches/${id}/open`);
    onRefresh();
  }

  async function consumeBatch(id: number) {
    await apiPatch(`/admin/ingredient-batches/${id}/consume`);
    onRefresh();
  }

  async function deleteBatch(id: number) {
    await apiDelete(`/admin/ingredient-batches/${id}`);
    onRefresh();
  }

  function toggleCollapse(id: number) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allIngredientGroups = grouped.filter(g => g.batches.length > 0);

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <PackageOpen className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Batch Inventory</h2>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
            {batches.filter(b => b.status !== "consumed").length} active
          </span>
        </div>
        <button
          onClick={() => setAddingBatch(v => !v)}
          disabled={ingredients.length === 0}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
          title={ingredients.length === 0 ? "Add ingredients to the catalog first" : undefined}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Batch
        </button>
      </div>

      {addingBatch && (
        <AddBatchForm
          centerId={centerId}
          ingredients={ingredients}
          onAdded={(b) => { onRefresh(); setAddingBatch(false); void b; }}
          onCancel={() => setAddingBatch(false)}
        />
      )}

      {allIngredientGroups.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No batch records yet. Use "Add Batch" to register a received pack.
        </p>
      )}

      <div className="divide-y divide-border">
        {allIngredientGroups.map(({ ingredient, batches: grpBatches }) => {
          const isCollapsed = collapsed.has(ingredient.id);
          const openBatchCount = grpBatches.filter(b => b.status === "open").length;
          const newBatchCount = grpBatches.filter(b => b.status === "new").length;
          return (
            <div key={ingredient.id}>
              <button
                onClick={() => toggleCollapse(ingredient.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="flex-1 font-medium text-sm text-foreground">{ingredient.name}</span>
                <span className="text-xs text-muted-foreground">{ingredient.pack_size}{ingredient.pack_unit}/pack</span>
                {openBatchCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">
                    {openBatchCount} open
                  </span>
                )}
                {newBatchCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200">
                    {newBatchCount} new
                  </span>
                )}
              </button>
              {!isCollapsed && (
                <div className="bg-muted/20 border-t border-border/50 divide-y divide-border/50">
                  {grpBatches.map(b => (
                    <BatchRow
                      key={b.id}
                      batch={b}
                      onOpen={openBatch}
                      onConsume={consumeBatch}
                      onDelete={deleteBatch}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const center = getAdminCenter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!center) return;
    setError(null);
    try {
      const [ings, bats] = await Promise.all([
        apiGet<Ingredient[]>("/admin/ingredients"),
        apiGet<IngredientBatch[]>(`/admin/centers/${center.id}/ingredient-batches`),
      ]);
      setIngredients(ings);
      setBatches(bats);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void fetchAll(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage ingredient catalog and track batch status per pack
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <IngredientCatalog ingredients={ingredients} onRefresh={fetchAll} />
            {center && (
              <BatchInventory
                centerId={center.id}
                ingredients={ingredients}
                batches={batches}
                onRefresh={fetchAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
