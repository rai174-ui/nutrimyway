import os

with open("artifacts/nutrimyway-admin/src/pages/inventory.tsx", "r", encoding="utf-8") as f:
    inv = f.read()

# We need to extract:
# batchCapacity, batchUnit, exportInventoryXlsx, fmt, fmtTime, StatusChip, ConsumptionPanel, AdjustBatchForm
# And put them in src/lib/inventory-helpers.tsx

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
  if (!iso) return "—";
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
"""

with open("artifacts/nutrimyway-admin/src/lib/inventory-helpers.tsx", "w", encoding="utf-8") as f:
    f.write(helpers_code)

