import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiDelete, apiPatch,
  getAdminCenter,
  type Ingredient, type IngredientBatch, type BatchStatus,
  type BatchConsumptionLog, type IngredientRequirement,
  type CenterMember, type BatchAdjustment,
} from "@/lib/api";
import {
  Plus, X, Loader2, Trash2, FileDown,
  PackageOpen, PackageCheck,
  ClipboardList, MinusCircle, AlertTriangle, PackagePlus,
  SlidersHorizontal, Users,
} from "lucide-react";

function batchCapacity(b: IngredientBatch): number {
  return b.received_qty ?? b.pack_size;
}
function batchUnit(b: IngredientBatch): string {
  return b.received_unit ?? b.pack_unit;
}

function exportInventoryXlsx(batches: IngredientBatch[]) {
  const rows = batches.map(b => {
    const cap = batchCapacity(b);
    return {
      Ingredient: b.ingredient_name,
      "Batch #": b.batch_number,
      Status: b.status,
      "Received Qty": cap,
      Unit: batchUnit(b),
      "Consumed Qty": Number(b.consumed_qty),
      "Balance": b.status === "new" ? cap : Math.max(0, cap - Number(b.consumed_qty)),
      "Created": b.created_at ? new Date(b.created_at).toLocaleDateString() : "",
      "Opened": b.opened_at ? new Date(b.opened_at).toLocaleDateString() : "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `batch-inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

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
  centerId, ingredients, members, onSuccess,
}: {
  centerId: string;
  ingredients: Ingredient[];
  members: CenterMember[];
  onSuccess: () => void;
}) {
  const [ingredientId, setIngredientId] = useState<string>(
    ingredients[0]?.id ? String(ingredients[0].id) : ""
  );
  const [batchNumber, setBatchNumber] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [noOfPacks, setNoOfPacks] = useState<string>("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReceived, setLastReceived] = useState<{ batch: string; count: number } | null>(null);

  const selectedIngredient = ingredients.find(i => String(i.id) === ingredientId);
  const skuId = selectedIngredient?.skus?.[0]?.id;
  const receivedUnit = selectedIngredient?.skus?.[0]?.pack_unit ?? "g";

  async function receive() {
    if (!skuId || !batchNumber.trim()) return;
    setSaving(true); setError(null); setLastReceived(null);
    try {
      const count = Number(noOfPacks) || 1;
      const body: Record<string, unknown> = {
        sku_id: skuId,
        batch_number: batchNumber.trim(),
        no_of_packs: count
      };
      const batch = await apiPost<IngredientBatch>(
        `/admin/centers/${centerId}/ingredient-batches`,
        body
      );
      if (openNow) {
        await apiPatch(`/admin/ingredient-batches/${batch.id}/open`);
      }
      setLastReceived({ batch: batchNumber.trim(), count });
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
          <p className="text-xs text-muted-foreground">Log an incoming pack — assign to center stock or directly to a member</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
        )}
        {lastReceived && !error && (
          <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            ✓ Received {lastReceived.count} pack(s) of batch &ldquo;{lastReceived.batch}&rdquo; {openNow ? " (one opened for consumption)" : " (sealed)"}.
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
                  {i.name}
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
              Number of packs
            </label>
            <input
              value={noOfPacks}
              onChange={e => setNoOfPacks(e.target.value)}
              type="number" min="1" step="1"
              className="w-24 h-9 px-2.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. 5"
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
              <span className="text-sm text-foreground">Open one pack</span>
            </label>
          </div>

          <button
            onClick={() => void receive()}
            disabled={!skuId || !batchNumber.trim() || saving}
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
  const initId = defaultIngredientId
    ? String(defaultIngredientId)
    : (ingredients[0]?.id ? String(ingredients[0].id) : "");
  const [ingredientId, setIngredientId] = useState<string>(initId);
  const [batchNumber, setBatchNumber] = useState("");
  const [receivedQty, setReceivedQty] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIng = ingredients.find(i => String(i.id) === ingredientId);
  const receivedUnit = selectedIng?.skus?.[0]?.pack_unit ?? "g";

  async function add() {
    if (!ingredientId || !batchNumber.trim()) return;
    setSaving(true); setError(null);
    try {
      const b = await apiPost<IngredientBatch>(
        `/admin/centers/${centerId}/ingredient-batches`,
        {
          ingredient_id: Number(ingredientId),
          batch_number: batchNumber.trim(),
          received_qty: receivedQty ? Number(receivedQty) : undefined,
          received_unit: receivedUnit,
        }
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
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input
          value={batchNumber}
          onChange={e => setBatchNumber(e.target.value)}
          className="w-40 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Batch / lot number"
          onKeyDown={e => e.key === "Enter" && void add()}
        />
        <input
          value={receivedQty}
          onChange={e => setReceivedQty(e.target.value)}
          type="number" min="0" step="any"
          className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Qty"
          title="Received quantity"
        />
        <span className="h-8 px-2 flex items-center text-xs font-medium text-muted-foreground bg-muted rounded-lg border border-input min-w-[2.5rem]">
          {receivedUnit}
        </span>
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
            {totalConsumed} {batchUnit(batch)} used so far
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
            {batchUnit(batch)}
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
              <span className="font-semibold text-emerald-700 tabular-nums w-16">{log.quantity} {batchUnit(batch)}</span>
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

// ── Adjust Batch Form ─────────────────────────────────────────────────────────

function AdjustBatchForm({
  batch,
  onDone,
}: {
  batch: IngredientBatch;
  onDone: () => void;
}) {
  const [qty, setQty] = useState("");
  const [sign, setSign] = useState<"+" | "-">("+");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<BatchAdjustment[]>([]);

  useEffect(() => {
    apiGet<BatchAdjustment[]>(`/admin/ingredient-batches/${batch.id}/adjustments`)
      .then(setAdjustments)
      .catch(() => {});
  }, [batch.id]);

  async function save() {
    const q = Number(qty);
    if (!q || q <= 0) { setError("Enter a positive number"); return; }
    setSaving(true); setError(null);
    const qtyChange = sign === "+" ? q : -q;
    try {
      const adj = await apiPost<BatchAdjustment>(
        `/admin/ingredient-batches/${batch.id}/adjust`,
        { qty_change: qtyChange, note: note.trim() || undefined }
      );
      setAdjustments(prev => [adj, ...prev]);
      setQty(""); setNote("");
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-200/70 space-y-2">
      <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Adjust Quantity — {batch.ingredient_name}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-input overflow-hidden">
          <button
            onClick={() => setSign("+")}
            className={`px-3 h-8 text-sm font-bold transition-colors ${sign === "+" ? "bg-emerald-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >+</button>
          <button
            onClick={() => setSign("-")}
            className={`px-3 h-8 text-sm font-bold transition-colors ${sign === "-" ? "bg-red-500 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >−</button>
        </div>
        <div className="relative">
          <input
            value={qty}
            onChange={e => setQty(e.target.value)}
            type="number" min="0" step="any"
            className="w-24 h-8 pl-2 pr-7 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-amber-400"
            placeholder="Qty"
            autoFocus
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{batchUnit(batch)}</span>
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-amber-400"
          placeholder="Reason (spillage, recount…)"
          onKeyDown={e => e.key === "Enter" && void save()}
        />
        <button
          onClick={() => void save()}
          disabled={!qty || saving}
          className="h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-amber-700"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
        </button>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      {adjustments.length > 0 && (
        <div className="space-y-0.5 pt-1 border-t border-amber-200/60">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recent adjustments</p>
          {adjustments.slice(0, 5).map(a => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <span className={`font-semibold tabular-nums w-16 shrink-0 ${Number(a.qty_change) > 0 ? "text-emerald-700" : "text-red-600"}`}>
                {Number(a.qty_change) > 0 ? "+" : ""}{Number(a.qty_change)} {batchUnit(batch)}
              </span>
              <span className="text-muted-foreground flex-1 truncate">{a.note ?? "—"}</span>
              <span className="text-muted-foreground/70 shrink-0">{fmtTime(a.adjusted_at)}</span>
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

  const cap = batchCapacity(batch);
  const unit = batchUnit(batch);
  const consumed = Number(batch.consumed_qty);
  const balance = batch.status === "new" ? cap : Math.max(0, cap - consumed);
  const balancePct = cap > 0 ? (balance / cap) * 100 : 0;
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
              <span className="text-xs text-muted-foreground">{unit}</span>
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
            <span className="text-xs font-normal text-muted-foreground">{unit}</span>
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
  const [adjustingId, setAdjustingId] = useState<number | null>(null);

  const activeBatches = useMemo(() => batches.filter(b => b.status !== "consumed"), [batches]);

  // Center-stock open batches only (no member-assigned packs)
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

  // Center-stock new (sealed) batches only
  const newBatches = useMemo(() =>
    activeBatches
      .filter(b => b.status === "new" && !b.assigned_member_id)
      .map(b => ({ ...b, ingredient: ingredients.find(i => i.id === b.ingredient_id) }))
      .filter(b => b.ingredient),
    [activeBatches, ingredients]
  );

  // Member-assigned packs (open or new, shown in their own section)
  const memberBatches = useMemo(() =>
    activeBatches
      .filter(b => b.assigned_member_id != null)
      .map(b => ({ ...b, ingredient: ingredients.find(i => i.id === b.ingredient_id) }))
      .filter(b => b.ingredient),
    [activeBatches, ingredients]
  );

  async function openBatch(id: number) { await apiPatch(`/admin/ingredient-batches/${id}/open`); onRefresh(); }
  async function consumeBatch(id: number) { await apiPatch(`/admin/ingredient-batches/${id}/consume`); onRefresh(); }
  async function deleteBatch(id: number) { await apiDelete(`/admin/ingredient-batches/${id}`); onRefresh(); }

  async function openNewPack(openBatchId: number, ingredientId: number) {
    await apiPatch(`/admin/ingredient-batches/${openBatchId}/consume`);
    onRefresh();
    setPendingIngredientId(ingredientId);
    setAddingBatch(true);
  }

  return (
    <div className="space-y-4">
      {/* ── New Batches ──────────────────────────────────────────── */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-semibold text-foreground">New Batches</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {newBatches.length} sealed
            </span>
          </div>
          <button
            onClick={() => { setAddingBatch(v => !v); setPendingIngredientId(undefined); }}
            disabled={ingredients.length === 0}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
            title={ingredients.length === 0 ? "Add items in Item Master first" : undefined}
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

        {newBatches.length === 0 && !addingBatch ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No sealed batches. Use "Add Batch" to register a received pack.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="py-2 pl-5 pr-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ingredient</th>
                  <th className="py-2 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Batch #</th>
                  <th className="py-2 px-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Size</th>
                  <th className="py-2 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Added</th>
                  <th className="py-2 pl-3 pr-5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {newBatches.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 pl-5 pr-3 font-medium text-foreground">{b.ingredient_name}</td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-xs">{b.batch_number}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{batchCapacity(b)} {batchUnit(b)}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{fmt(b.created_at)}</td>
                    <td className="py-2.5 pl-3 pr-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void openBatch(b.id)}
                          className="flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                        >
                          <PackageOpen className="w-3 h-3" />
                          Open
                        </button>
                        <button
                          onClick={() => void deleteBatch(b.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete batch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Member Packs ──────────────────────────────────────────── */}
      {memberBatches.length > 0 && (
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <Users className="w-5 h-5 text-violet-600" />
            <h2 className="text-base font-semibold text-foreground">Member Packs</h2>
            <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              {memberBatches.length} assigned
            </span>
          </div>
          <div className="divide-y divide-border">
            {memberBatches.map(b => {
              const cap = batchCapacity(b);
              const bUnit = batchUnit(b);
              const consumed = Number(b.consumed_qty);
              const remaining = Math.max(0, cap - consumed);
              const pct = cap > 0 ? Math.min(100, (consumed / cap) * 100) : 0;
              const isAdjusting = adjustingId === b.id;
              return (
                <div key={b.id}>
                  <div className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">
                          <Users className="w-3 h-3" />
                          {b.assigned_member_name ?? "Member"}
                        </span>
                        <span className="font-medium text-sm text-foreground">{b.ingredient_name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{b.batch_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-violet-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                          {consumed} / {cap} {bUnit}
                        </span>
                        <span className="text-xs font-semibold text-violet-700 tabular-nums whitespace-nowrap">
                          {remaining} {bUnit} left
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setAdjustingId(isAdjusting ? null : b.id)}
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
                      <button
                        onClick={() => void consumeBatch(b.id)}
                        title="Mark pack as fully consumed"
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isAdjusting && (
                    <AdjustBatchForm
                      batch={b}
                      onDone={() => { onRefresh(); setAdjustingId(null); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}


// ── Page ───────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const center = getAdminCenter();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [batches, setBatches] = useState<IngredientBatch[]>([]);
  const [requirements, setRequirements] = useState<IngredientRequirement[]>([]);
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchAll() {
    if (!center) return;
    setError(null);
    try {
      const [ings, bats, reqs, mems] = await Promise.all([
        apiGet<Ingredient[]>("/admin/ingredients"),
        apiGet<IngredientBatch[]>(`/admin/centers/${center.id}/ingredient-batches`),
        apiGet<IngredientRequirement[]>(`/admin/centers/${center.id}/ingredient-requirements`),
        apiGet<CenterMember[]>(`/admin/centers/${center.id}/members`),
      ]);
      setIngredients(ings);
      setBatches(bats);
      setRequirements(reqs);
      setMembers(mems);
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
                members={members}
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
