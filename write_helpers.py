import os

helpers_code = """import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { apiGet, apiPost, apiDelete, type IngredientBatch, type BatchStatus, type BatchConsumptionLog, type BatchAdjustment } from "@/lib/api";
import { ClipboardList, MinusCircle, Loader2, SlidersHorizontal, X } from "lucide-react";

export function batchCapacity(b: IngredientBatch): number {
  return b.received_qty ?? b.pack_size;
}
export function batchUnit(b: IngredientBatch): string {
  return b.received_unit ?? b.pack_unit;
}

export function exportInventoryXlsx(batches: IngredientBatch[]) {
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

export function fmt(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function StatusChip({ status }: { status: BatchStatus }) {
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

export function AdjustBatchForm({ batch, onClose, onRefresh }: { batch: IngredientBatch, onClose: () => void, onRefresh: () => void }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState<BatchConsumptionLog[]>([]);
  const [adjustments, setAdjustments] = useState<BatchAdjustment[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    setLoadingLogs(true);
    apiGet<BatchConsumptionLog[]>(`/admin/ingredient-batches/${batch.id}/consumption-logs`)
      .then(setLogs)
      .finally(() => setLoadingLogs(false));
  }, [batch.id]);

  useEffect(() => {
    apiGet<BatchAdjustment[]>(`/admin/ingredient-batches/${batch.id}/adjustments`)
      .then(setAdjustments)
      .catch(() => {});
  }, [batch.id]);

  const totalConsumed = logs.reduce((s, l) => s + l.quantity, 0);

  async function save() {
    if (!qty || isNaN(Number(qty))) { setError("Invalid quantity"); return; }
    if (!reason.trim()) { setError("Reason is required"); return; }
    setLoading(true);
    try {
      await apiPost(`/admin/ingredient-batches/${batch.id}/adjustments`, {
        quantity: Number(qty),
        reason
      });
      onRefresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function undo(logId: number) {
    setLoading(true);
    try {
      await apiDelete(`/admin/ingredient-batches/${batch.id}/consumption-logs/${logId}`);
      onRefresh();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold">Adjust Batch #{batch.batch_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-md"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-6">
          {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
          
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" /> Add Manual Adjustment
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input type="number" step="0.01" value={qty} onChange={e => setQty(e.target.value)} placeholder={`Quantity (${batchUnit(batch)})`} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <div className="flex-[2]">
                <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (e.g. Spillage, Expiry)" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none" />
              </div>
              <button onClick={save} disabled={loading} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg shadow-sm disabled:opacity-50 min-w-[80px] flex justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save"}
              </button>
            </div>
            {adjustments.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Previous Adjustments:</div>
                {adjustments.map(adj => (
                  <div key={adj.id} className="text-xs flex items-center justify-between p-2 bg-slate-50 border rounded-lg">
                    <span>{adj.reason} <span className="text-muted-foreground">({fmtTime(adj.created_at)})</span></span>
                    <span className="font-bold font-mono">{adj.quantity > 0 ? '+' : ''}{adj.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ClipboardList className="w-4 h-4" /> Recent Consumption Logs
            </h3>
            <div className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border">
              <span className="font-medium text-slate-700">Total System Consumption</span>
              <span className="font-bold font-mono text-lg">{totalConsumed} {batchUnit(batch)}</span>
            </div>
            
            {loadingLogs ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No recent consumption logs</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-2.5 border rounded-lg hover:border-slate-300 transition-colors">
                    <div>
                      <div className="text-sm font-medium">Log #{log.member_log_id}</div>
                      <div className="text-xs text-muted-foreground">{fmtTime(log.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold">{log.quantity} {batchUnit(batch)}</span>
                      <button onClick={() => undo(log.id)} disabled={loading} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Undo this consumption">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
"""

with open("artifacts/nutrimyway-admin/src/lib/inventory-helpers.tsx", "w", encoding="utf-8") as f:
    f.write(helpers_code)
