import { useState, useEffect, useMemo } from "react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiDelete, apiPatch,
  getAdminCenter,
  type Ingredient, type IngredientBatch, type BatchStatus,
  type BatchConsumptionLog, type IngredientRequirement,
} from "@/lib/api";
import {
  Plus, X, Loader2, Trash2,
  PackageOpen, PackageCheck, ChevronDown, ChevronRight,
  ClipboardList, MinusCircle, AlertTriangle, PackagePlus,
} from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

// ── Quick Receipt Form ────────────────────────────────────────────────────────

function QuickReceiptForm({
  centerId, ingredients, onSuccess,
}: {
  centerId: string;
  ingredients: Ingredient[];
  onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState<string>(
    ingredients[0]?.id ? String(ingredients[0].id) : ""
  );
  const [batchNumber, setBatchNumber] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceived, setLastReceived] = useState<{ batch: string; opened: boolean } | null>(null);

  async function receive() {
    if (!ingredientId || !batchNumber.trim()) return;
    setSaving(true); setError(null); setLastReceived(null);
    try {
      const batch = await apiPost<IngredientBatch>(
        `/admin/centers/${centerId}/ingredient-batches`,
        { ingredient_id: Number(ingredientId), batch_number: batchNumber.trim() }
      );
      if (openNow) {
        await apiPatch(`/admin/ingredient-batches/${batch.id}/open`);
      }
      setLastReceived({ batch: batchNumber.trim(), opened: openNow });
      setBatchNumber("");
      onSuccess();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (ingredients.length === 0) return null;

  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
        <PackagePlus className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">Receive Stock</h2>
          <p className="text-xs text-muted-foreground">Log an incoming pack for any ingredient</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
        )}
        {lastReceived && !error && (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            ✓ Batch &ldquo;{lastReceived.batch}&rdquo; received{lastReceived.opened ? " and opened for consumption" : " (sealed)"}.
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 min-w-[200px] flex-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ingredient
            </label>
            <select
              value={ingredientId}
              onChange={e => setIngredientId(e.target.value)}
              className="h-9 px-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {ingredients.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.pack_size} {i.pack_unit}/pack)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Batch / Lot Number
            </label>
            <input
              value={batchNumber}
              onChange={e => setBatchNumber(e.target.value)}
              onKeyDown={e => e.key === "Enter" && void receive()}
              className="h-9 px-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. LOT-2024-001"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Open now?
            </label>
            <label className="flex items-center gap-2 h-9 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openNow}
                onChange={e => setOpenNow(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground">Open for consumption</span>
            </label>
          </div>

          <button
            onClick={() => void receive()}
            disabled={!ingredientId || !batchNumber.trim() || saving}
            className="flex items-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            Receive
          </button>
        </div>
      </div>
    </section>
  );
}

// ── Add Batch Form ─────────────────────────────────────────────────────────────

function AddBatchForm({
  centerId, ingredients, defaultIngredientId, onAdded, onCancel,
}: {
  centerId: string;
  ingredients: Ingredient[];
  defaultIngredientId?: number;
  onAdded: (b: IngredientBatch) => void;
  onCancel: () => void;
}) {
  const [ingredientId, setIngredientId] = useState<string>(
    defaultIngredientId
      ? String(defaultIngredientId)
      : (ingredients[0]?.id ? String(ingredients[0].id) : "")
  );
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
          className="w-44 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
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

// ── Consumption Log Panel ──────────────────────────────────────────────────────

function ConsumptionPanel({
  batch,
  onLogAdded,
}: {
  batch: IngredientBatch;
  onLogAdded: () => void;
}) {
  const [logs, setLogs] = useState<BatchConsumptionLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<BatchConsumptionLog[]>(`/admin/ingredient-batches/${batch.id}/consumption-logs`)
      .then(setLogs)
      .finally(() => setLoadingLogs(false));
  }, [batch.id]);

  const totalConsumed = logs.reduce((s, l) => s + l.quantity, 0);

  async function record() {
    const q = Number(qty);
    if (!q || q <= 0) { setError("Enter a positive quantity"); return; }
    setSaving(true); setError(null);
    try {
      const log = await apiPost<BatchConsumptionLog>(
        `/admin/ingredient-batches/${batch.id}/consumption-logs`,
        { quantity: q, notes: notes.trim() || undefined }
      );
      setLogs(prev => [log, ...prev]);
      setQty(""); setNotes("");
      onLogAdded();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function removeLog(id: number) {
    try {
      await apiDelete(`/admin/consumption-logs/${id}`);
      setLogs(prev => prev.filter(l => l.id !== id));
      onLogAdded();
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="pl-6 pr-4 pb-3 bg-emerald-50/40 border-t border-emerald-100">
      <p className="text-xs font-semibold text-emerald-700 pt-2 mb-2 flex items-center gap-1.5">
        <ClipboardList className="w-3.5 h-3.5" />
        Record Consumption
        {totalConsumed > 0 && (
          <span className="ml-auto font-normal text-emerald-600">
            {totalConsumed} {batch.pack_unit} used so far
          </span>
        )}
      </p>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <input
            value={qty}
            onChange={e => setQty(e.target.value)}
            type="number" min="0" step="any"
            className="w-28 h-8 pl-2 pr-8 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-emerald-400"
            placeholder="Qty used"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
            {batch.pack_unit}
          </span>
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="flex-1 min-w-[120px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-emerald-400"
          placeholder="Notes (optional)"
          onKeyDown={e => e.key === "Enter" && void record()}
        />
        <button
          onClick={() => void record()}
          disabled={!qty || saving}
          className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-40 hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Record"}
        </button>
      </div>

      {loadingLogs ? (
        <p className="text-xs text-muted-foreground py-1">Loading logs…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">No consumption recorded yet.</p>
      ) : (
        <div className="space-y-1">
          {logs.map(log => (
            <div key={log.id} className="flex items-center gap-2 group text-xs">
              <span className="font-semibold text-emerald-700 tabular-nums w-16">{log.quantity} {batch.pack_unit}</span>
              <span className="text-muted-foreground flex-1 truncate">{log.notes ?? "—"}</span>
              <span className="text-muted-foreground/70 shrink-0">{fmtTime(log.recorded_at)}</span>
              <button
                onClick={() => void removeLog(log.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <MinusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Batch Table Row ────────────────────────────────────────────────────────────

function BatchTableRow({
  batch,
  minNeeded,
  onOpen,
  onConsume,
  onDelete,
}: {
  batch: IngredientBatch;
  minNeeded: number;
  onOpen: (id: number) => Promise<void>;
  onConsume: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConsumption, setShowConsumption] = useState(false);

  const consumed = Number(batch.consumed_qty);
  const balance =
    batch.status === "new"
      ? batch.pack_size
      : Math.max(0, batch.pack_size - consumed);
  const balancePct = batch.pack_size > 0 ? (balance / batch.pack_size) * 100 : 0;
  const isLow = batch.status === "open" && minNeeded > 0 && balance < minNeeded;

  const barColor =
    batch.status === "consumed" ? "bg-slate-300" :
    batch.status === "new"      ? "bg-slate-400" :
    isLow                       ? "bg-red-400"   :
    balancePct > 50             ? "bg-emerald-500" : "bg-amber-400";

  async function act(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors group">
        {/* Batch # */}
        <td className="py-2.5 pl-5 pr-3 font-mono text-sm text-foreground whitespace-nowrap align-middle">
          {batch.batch_number}
        </td>

        {/* Status + date */}
        <td className="py-2.5 px-3 whitespace-nowrap align-middle">
          <div className="flex items-center gap-1.5">
            <StatusChip status={batch.status} />
            <span className="text-[10px] text-muted-foreground">
              {batch.status === "new" && fmt(batch.created_at)}
              {batch.status === "open" && fmt(batch.opened_at)}
              {batch.status === "consumed" && fmt(batch.consumed_at)}
            </span>
          </div>
        </td>

        {/* Consumed */}
        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap align-middle">
          {batch.status === "new" ? (
            <span className="text-muted-foreground text-sm">—</span>
          ) : (
            <span className="text-sm">
              {consumed}{" "}
              <span className="text-xs text-muted-foreground">{batch.pack_unit}</span>
            </span>
          )}
        </td>

        {/* Balance */}
        <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap align-middle">
          <span className={`text-sm font-semibold ${
            batch.status === "consumed" ? "text-muted-foreground" :
            isLow ? "text-red-600" : "text-foreground"
          }`}>
            {batch.status === "consumed" ? 0 : balance}{" "}
            <span className="text-xs font-normal text-muted-foreground">{batch.pack_unit}</span>
          </span>
        </td>

        {/* Level — graphical bar */}
        <td className="py-2.5 px-3 align-middle min-w-[160px]">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${balancePct}%` }}
              />
              {batch.status === "new" && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-slate-600 leading-none">
                  SEALED
                </span>
              )}
              {isLow && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-red-700 leading-none">
                  LOW
                </span>
              )}
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-9 text-right shrink-0">
              {Math.round(balancePct)}%
            </span>
          </div>
        </td>

        {/* Actions */}
        <td className="py-2.5 pl-3 pr-4 align-middle whitespace-nowrap">
          <div className="flex items-center gap-1.5 justify-end">
            {batch.status === "open" && (
              <>
                <button
                  onClick={() => setShowConsumption(v => !v)}
                  className={`flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium border transition-colors ${
                    showConsumption
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  <ClipboardList className="w-3 h-3" />
                  Log
                </button>
                <button
                  onClick={() => void act(() => onConsume(batch.id))}
                  disabled={busy}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageCheck className="w-3 h-3" />}
                  Empty
                </button>
              </>
            )}
            {batch.status === "new" && (
              <>
                <button
                  onClick={() => void act(() => onOpen(batch.id))}
                  disabled={busy}
                  className="flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
                  Open
                </button>
                <button
                  onClick={() => void act(() => onDelete(batch.id))}
                  disabled={busy}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
          {error && <p className="text-[10px] text-destructive mt-0.5 text-right">{error}</p>}
        </td>
      </tr>

      {showConsumption && batch.status === "open" && (
        <tr>
          <td colSpan={6} className="pb-2 px-5 bg-emerald-50/40">
            <ConsumptionPanel batch={batch} onLogAdded={() => {}} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Batch Inventory ─────────────────────────────────────────────────────────────

function BatchInventory({
  centerId, ingredients, batches, requirements, onRefresh,
}: {
  centerId: string;
  ingredients: Ingredient[];
  batches: IngredientBatch[];
  requirements: IngredientRequirement[];
  onRefresh: () => void;
}) {
  const [addingBatch, setAddingBatch] = useState(false);
  const [pendingIngredientId, setPendingIngredientId] = useState<number | undefined>();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<number, { ingredient: Ingredient; batches: IngredientBatch[] }>();
    for (const ing of ingredients) map.set(ing.id, { ingredient: ing, batches: [] });
    for (const b of batches) {
      const g = map.get(b.ingredient_id);
      if (g) g.batches.push(b);
    }
    return [...map.values()].filter(g => g.batches.length > 0);
  }, [ingredients, batches]);

  async function openBatch(id: number) { await apiPatch(`/admin/ingredient-batches/${id}/open`); onRefresh(); }
  async function consumeBatch(id: number) { await apiPatch(`/admin/ingredient-batches/${id}/consume`); onRefresh(); }
  async function deleteBatch(id: number) { await apiDelete(`/admin/ingredient-batches/${id}`); onRefresh(); }

  async function openNewPack(openBatchId: number, ingredientId: number) {
    await apiPatch(`/admin/ingredient-batches/${openBatchId}/consume`);
    onRefresh();
    setPendingIngredientId(ingredientId);
    setAddingBatch(true);
  }

  function toggleCollapse(id: number) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

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
          onClick={() => { setAddingBatch(v => !v); setPendingIngredientId(undefined); }}
          disabled={ingredients.length === 0}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
          title={ingredients.length === 0 ? "Add ingredients to the master list first" : undefined}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Batch
        </button>
      </div>

      {addingBatch && (
        <AddBatchForm
          centerId={centerId}
          ingredients={ingredients}
          defaultIngredientId={pendingIngredientId}
          onAdded={() => { onRefresh(); setAddingBatch(false); setPendingIngredientId(undefined); }}
          onCancel={() => { setAddingBatch(false); setPendingIngredientId(undefined); }}
        />
      )}

      {grouped.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No batch records yet. Use "Add Batch" to register a received pack.
        </p>
      )}

      <div className="divide-y divide-border">
        {grouped.map(({ ingredient, batches: grpBatches }) => {
          const currentOpenBatch = grpBatches.find(b => b.status === "open");
          const req = requirements.find(r => r.ingredient_id === ingredient.id);
          const consumed = currentOpenBatch ? Number(currentOpenBatch.consumed_qty) : 0;
          const remaining = currentOpenBatch ? Math.max(0, currentOpenBatch.pack_size - consumed) : 0;
          const minNeeded = req ? Number(req.min_serving_qty) : 0;
          const isLow = !!currentOpenBatch && minNeeded > 0 && remaining < minNeeded;
          const hasNoOpen = !currentOpenBatch;
          const pct = currentOpenBatch ? Math.min(100, (consumed / currentOpenBatch.pack_size) * 100) : 0;

          const isCollapsed = collapsed.has(ingredient.id);
          const newCount = grpBatches.filter(b => b.status === "new").length;

          return (
            <div key={ingredient.id}>
              <button
                onClick={() => toggleCollapse(ingredient.id)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors text-left"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="flex-1 font-medium text-sm text-foreground">{ingredient.name}</span>
                <span className="text-xs text-muted-foreground">{ingredient.pack_size} {ingredient.pack_unit}/pack</span>

                {currentOpenBatch && !isLow && (
                  <span className="text-xs font-semibold tabular-nums text-emerald-700">
                    {remaining} {ingredient.pack_unit} left
                  </span>
                )}
                {isLow && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    {remaining} {ingredient.pack_unit} left
                  </span>
                )}
                {hasNoOpen && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    No open pack
                  </span>
                )}
                {newCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200">
                    {newCount} new
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <div className="border-t border-border/50">
                  {/* No open pack callout */}
                  {hasNoOpen && (
                    <div className="mx-4 mt-2.5 mb-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800 flex-1">
                        <strong>No open pack</strong> — open one of the batches below to start recording consumption for this ingredient.
                      </p>
                    </div>
                  )}

                  {/* Low-stock callout */}
                  {currentOpenBatch && isLow && (
                    <div className="mx-4 mt-2.5 mb-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-700 flex-1">
                        Only <strong>{remaining} {currentOpenBatch.pack_unit}</strong> remaining — not enough for one serving ({minNeeded} {currentOpenBatch.pack_unit} needed).
                      </p>
                      <button
                        onClick={() => void openNewPack(currentOpenBatch.id, ingredient.id)}
                        className="flex items-center gap-1 h-6 px-2.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 shrink-0"
                      >
                        <PackagePlus className="w-3.5 h-3.5" />
                        Open New Pack
                      </button>
                    </div>
                  )}

                  {/* Batch table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/40">
                          <th className="py-2 pl-5 pr-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Batch #</th>
                          <th className="py-2 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                          <th className="py-2 px-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Consumed</th>
                          <th className="py-2 px-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Balance</th>
                          <th className="py-2 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Inventory Level</th>
                          <th className="py-2 pl-3 pr-4 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {grpBatches.map(b => (
                          <BatchTableRow
                            key={b.id}
                            batch={b}
                            minNeeded={minNeeded}
                            onOpen={openBatch}
                            onConsume={consumeBatch}
                            onDelete={deleteBatch}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
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
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!center) return;
    setError(null);
    try {
      const [ings, bats, reqs] = await Promise.all([
        apiGet<Ingredient[]>("/admin/ingredients"),
        apiGet<IngredientBatch[]>(`/admin/centers/${center.id}/ingredient-batches`),
        apiGet<IngredientRequirement[]>(`/admin/centers/${center.id}/ingredient-requirements`),
      ]);
      setIngredients(ings);
      setBatches(bats);
      setRequirements(reqs);
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
            Manage ingredient master and track batch lifecycle — open a batch to record consumption
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
            {center && (
              <QuickReceiptForm
                centerId={center.id}
                ingredients={ingredients}
                onSuccess={fetchAll}
              />
            )}
            {center && (
              <BatchInventory
                centerId={center.id}
                ingredients={ingredients}
                batches={batches}
                requirements={requirements}
                onRefresh={fetchAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
