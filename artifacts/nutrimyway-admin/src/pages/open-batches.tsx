import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit2, Loader2, Save, X, Settings2, PackageOpen, Download, SlidersHorizontal, AlertTriangle, PackagePlus, MinusCircle, ChevronDown, ChevronUp } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, apiPatch, getAdminCenter, type Ingredient, type CheckinCategory, type IngredientBatch, type IngredientRequirement } from "@/lib/api";
import { StatusChip, fmt, exportInventoryXlsx, AdjustBatchForm, batchUnit, batchCapacity } from "@/lib/inventory-helpers";
import { Nav } from "@/components/nav";

export default function OpenBatchesPage() {
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  
  
  
  
  
  
  
  const [adjustingId, setAdjustingId] = useState<number | null>(null);

  
  const [openBatchesExpanded, setOpenBatchesExpanded] = useState(true);

  const centerId = getAdminCenter()?.id;

      async function load() {
    if (!centerId) return;
    try {
      const [ingsRes, batsRes, reqsRes] = await Promise.all([
        
        apiGet<Ingredient[]>("/admin/ingredients"),
        apiGet<IngredientBatch[]>(`/admin/centers/${centerId}/ingredient-batches`),
        apiGet<IngredientRequirement[]>(`/admin/centers/${centerId}/ingredient-requirements`),
      ]);
      
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
      await apiPatch(`/admin/ingredient-batches/${id}/consume`);
      await load();
    } catch (e) { alert((e as Error).message); }
  }

  async function openNewPack(openBatchId: number, ingredientId: number) {
    if (!confirm("This will mark the current batch as consumed and redirect you to inventory to open a new pack. Continue?")) return;
    await apiPatch(`/admin/ingredient-batches/${openBatchId}/consume`);
    window.location.href = `/admin/inventory`;
  }



  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-10">
      
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


      </main>
    </div>
  );
}
