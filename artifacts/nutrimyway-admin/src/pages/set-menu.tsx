import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit2, Loader2, Save, X, Settings2, PackageOpen, Download, SlidersHorizontal, AlertTriangle, PackagePlus, MinusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, getAdminCenter, type Ingredient, type CheckinCategory, type IngredientBatch, type IngredientRequirement } from "@/lib/api";
import { StatusChip, fmt, exportInventoryXlsx, AdjustBatchForm, batchUnit, batchCapacity } from "@/lib/inventory-helpers";
import { Nav } from "@/components/nav";

export default function SetMenuPage() {
  const [categories, setCategories] = useState<CheckinCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [selectedIngredients, setSelectedIngredients] = useState<number[]>([]);
  
  const [adjustingId, setAdjustingId] = useState<number | null>(null);

  const [mealCategoriesExpanded, setMealCategoriesExpanded] = useState(false);
  const [openBatchesExpanded, setOpenBatchesExpanded] = useState(true);

  const centerId = getAdminCenter()?.id;

  const assignedOtherIds = useMemo(() => {
    const ids = new Set<number>();
    categories.forEach(c => {
      if (c.id !== editId) {
        c.ingredients.forEach(i => ids.add(i.ingredient_id));
      }
    });
    return ids;
  }, [categories, editId]);

  const availableIngredients = useMemo(() => {
    return ingredients.filter(ing => !assignedOtherIds.has(ing.id));
  }, [ingredients, assignedOtherIds]);

  async function load() {
    if (!centerId) return;
    try {
      const [catsRes, ingsRes, batsRes, reqsRes] = await Promise.all([
        apiGet<CheckinCategory[]>(`/admin/centers/${centerId}/checkin-categories`),
        apiGet<Ingredient[]>("/admin/ingredients"),
        apiGet<IngredientBatch[]>(`/admin/centers/${centerId}/ingredient-batches`),
        apiGet<IngredientRequirement[]>(`/admin/centers/${centerId}/ingredient-requirements`),
      ]);
      setCategories(catsRes);
      setIngredients(ingsRes);
      setBatches(batsRes);
      setRequirements(reqsRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [centerId]);

  // Open Batches Logic
  const activeBatches = useMemo(() => batches.filter(b => b.status !== "consumed"), [batches]);

  const openGroups = useMemo(() => {
    const map = new Map<number, { ingredient: Ingredient; openBatch: IngredientBatch; reserveCount: number }>();
    for (const b of activeBatches) {
      if (b.status === "open" && !b.assigned_member_id) {
        const ing = ingredients.find(i => i.id === b.ingredient_id);
        if (ing) map.set(ing.id, { ingredient: ing, openBatch: b, reserveCount: 0 });
      }
    }
    for (const b of activeBatches) {
      if (b.status === "new" && !b.assigned_member_id) {
        const entry = map.get(b.ingredient_id);
        if (entry) entry.reserveCount++;
      }
    }
    return [...map.values()];
  }, [activeBatches, ingredients]);

  async function consumeBatch(id: number) {
    if (!confirm("Mark this batch as fully consumed?")) return;
    try {
      await apiPatch(`/admin/ingredient-batches/${id}`, { status: "consumed" });
      await load();
    } catch (e) { alert((e as Error).message); }
  }

  async function openNewPack(openBatchId: number, ingredientId: number) {
    if (!confirm("This will mark the current batch as consumed and redirect you to inventory to open a new pack. Continue?")) return;
    await apiPatch(`/admin/ingredient-batches/${openBatchId}/consume`);
    window.location.href = `/admin/inventory`;
  }

  function startCreate() {
    setEditId(null);
    setName("");
    setIsMandatory(true);
    setDisplayOrder(categories.length);
    setSelectedIngredients([]);
    setIsEditing(true);
  }

  function startEdit(cat: CheckinCategory) {
    setEditId(cat.id);
    setName(cat.name);
    setIsMandatory(cat.is_mandatory);
    setDisplayOrder(cat.display_order);
    setSelectedIngredients(cat.ingredients.map(i => i.ingredient_id));
    setIsEditing(true);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true);
    try {
      if (editId) {
        await apiPut(`/admin/centers/${centerId}/checkin-categories/${editId}`, {
          name, is_mandatory: isMandatory, display_order: displayOrder, ingredients: selectedIngredients
        });
      } else {
        await apiPost(`/admin/centers/${centerId}/checkin-categories`, {
          name, is_mandatory: isMandatory, display_order: displayOrder, ingredients: selectedIngredients
        });
      }
      setIsEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category?")) return;
    setLoading(true);
    try {
      await apiDelete(`/admin/centers/${centerId}/checkin-categories/${id}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  if (loading && categories.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-10">
      
      {/* -- Meal Categories -------------------------------------------- */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button
            onClick={() => setMealCategoriesExpanded(v => !v)}
            className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors flex-1"
          >
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">Meal Categories</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Configure groups of ingredients members can choose from during check-in.</p>
            </div>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {categories.length}
            </span>
          </button>
          <div className="flex items-center gap-2 ml-4">
            <button onClick={startCreate} className="bg-primary text-primary-foreground h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90 transition-colors shadow-sm">
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
            <button onClick={() => setMealCategoriesExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
              {mealCategoriesExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mealCategoriesExpanded && (
          <div className="p-5">
            {error && <div className="mb-4 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
              <div className="p-5 flex items-center justify-between border-b border-border/50 bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl"><Settings2 className="w-5 h-5" /></div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                      {cat.name}
                      {cat.is_mandatory && <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Mandatory</span>}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Order: {cat.display_order}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => startEdit(cat)} className="p-2 text-muted-foreground hover:bg-slate-200 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-5 bg-white">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Available Ingredients</h4>
                {cat.ingredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No ingredients assigned.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {cat.ingredients.map(ing => (
                      <div key={ing.ingredient_id} className="text-sm font-medium px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                        {ing.name} {ing.flavour ? `(${ing.flavour})` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-2xl bg-slate-50 text-muted-foreground">
              No categories found. Click Add Category to create your first check-in group.
            </div>
          )}
        </div>
        </div>
        )}
      </section>

      <hr className="border-border" />

      {/* -- Open Batches -------------------------------------------- */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button
            onClick={() => setOpenBatchesExpanded(v => !v)}
            className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors flex-1"
          >
            <div className="flex items-center gap-2">
              <PackageOpen className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-foreground">Open Batches</h2>
            </div>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {openGroups.length} in use
            </span>
          </button>
          <div className="flex items-center gap-2 ml-4">
            {activeBatches.length > 0 && (
              <button
                onClick={() => exportInventoryXlsx(activeBatches)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            )}
            <button onClick={() => setOpenBatchesExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
              {openBatchesExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {openBatchesExpanded && (
        <>
        {openGroups.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No open packs — open a batch from New Batches to start tracking consumption.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {openGroups.map(({ ingredient, openBatch, reserveCount }) => {
              const req = requirements.find(r => r.ingredient_id === ingredient.id);
              const cap = batchCapacity(openBatch);
              const unit = batchUnit(openBatch);
              const consumed = Number(openBatch.consumed_qty);
              const remaining = Math.max(0, cap - consumed);
              const minNeeded = req ? Number(req.min_serving_qty) : 0;
              const isLow = minNeeded > 0 && remaining < minNeeded;
              const pct = Math.min(100, cap > 0 ? (consumed / cap) * 100 : 0);
              const isAdjusting = adjustingId === openBatch.id;
              
              return (
                <div key={ingredient.id}>
                  <div className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-medium text-sm text-foreground">{ingredient.name}</span>
                        {ingredient.skus?.[0]?.material_code && (
                          <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{ingredient.skus[0].material_code}</span>
                        )}
                        {reserveCount > 0 && (
                          <span className="text-[10px] text-sky-700 bg-sky-100 border border-sky-200 px-1.5 py-0.5 rounded-full font-semibold">{reserveCount} in reserve</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[200px]">
                          <div
                            className={`h-full rounded-full transition-all ${isLow ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${isLow ? "text-red-600" : "text-emerald-700"}`}>
                          {remaining} {unit} left
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAdjustingId(isAdjusting ? null : openBatch.id)}
                        title="Adjust quantity"
                        className={`flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border transition-colors ${
                          isAdjusting
                            ? "bg-amber-100 text-amber-700 border-amber-300"
                            : "text-muted-foreground border-border hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50"
                        }`}
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Adjust
                      </button>
                      {isLow ? (
                        <>
                          <button
                            onClick={() => void openNewPack(openBatch.id, ingredient.id)}
                            className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                          >
                            <PackagePlus className="w-3 h-3" />
                            Open New Pack
                          </button>
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </>
                      ) : (
                        <button
                          onClick={() => void consumeBatch(openBatch.id)}
                          title="Mark pack as fully consumed"
                          className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdjusting && (
                    <AdjustBatchForm
                      batch={openBatch}
                      onClose={() => setAdjustingId(null)}
                      onRefresh={load}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </section>

      {/* -- Modals -------------------------------------------- */}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50">
              <h2 className="text-lg font-bold text-foreground">{editId ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 rounded-xl text-muted-foreground hover:bg-slate-200 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Category Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shake Flavour" className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Display Order</label>
                  <input type="number" value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" id="mandatory" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="w-5 h-5 rounded border-input text-primary focus:ring-primary/40" />
                  <label htmlFor="mandatory" className="text-sm font-bold text-foreground">Is Mandatory?</label>
                </div>
              </div>
              
              <div className="pt-2 border-t border-border">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">Select Ingredients</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {availableIngredients.length === 0 && (
                    <div className="col-span-full p-4 text-center text-sm text-muted-foreground italic">
                      No available ingredients left to add.
                    </div>
                  )}
                  {availableIngredients.map(ing => (
                    <label key={ing.id} className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-input text-primary"
                        checked={selectedIngredients.includes(ing.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedIngredients([...selectedIngredients, ing.id]);
                          else setSelectedIngredients(selectedIngredients.filter(id => id !== ing.id));
                        }}
                      />
                      <span className="text-sm font-medium">{ing.name} {ing.flavour ? `(${ing.flavour})` : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border bg-slate-50/50 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-slate-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2 shadow-sm disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Category
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
