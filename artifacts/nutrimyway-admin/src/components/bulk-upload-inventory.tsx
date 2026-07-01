import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { apiPost, getAdminCenter } from "@/lib/api";

export function BulkUploadInventory({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ingredients: number; menuItems: number; bom: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const center = getAdminCenter();

  function parseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      setRows(json as Record<string, unknown>[]);
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function upload() {
    if (!rows || !center) return;
    setLoading(true);
    try {
      const res = await apiPost<{ ingredients: number; menuItems: number; bom: number; errors: string[] }>(
        `/admin/centers/${center.id}/upload/inventory`,
        { rows }
      );
      setResult(res);
      onSuccess();
    } catch (err) {
      setResult({ ingredients: 0, menuItems: 0, bom: 0, errors: [err instanceof Error ? err.message : "Upload failed"] });
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-border bg-card text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors">
        <Upload className="w-4 h-4" /> Bulk Upload
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Bulk Upload Inventory</h3>
        <button onClick={() => { setOpen(false); setRows(null); setResult(null); }} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload an XLSX/CSV with rows of type: <strong>ingredient</strong>, <strong>menu_item</strong>, or <strong>bom</strong>.<br/>
        ingredient: name, pack_size, pack_unit, material_code, description, flavour, serving_qty, kcal_per_serving<br/>
        menu_item: name, description, is_mandatory, flavours, available_days<br/>
        bom: menu_item_name, ingredient_name, quantity, unit, kcal
      </p>
      <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={parseFile} className="hidden" />
      <div className="flex items-center gap-2">
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 border border-border bg-muted px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
          <Upload className="w-4 h-4" /> Choose File
        </button>
        {rows && <span className="text-sm text-muted-foreground">{rows.length} rows ready</span>}
      </div>
      {rows && (
        <>
          <div className="max-h-48 overflow-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>{Object.keys(rows[0]).map(k => <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>)}</tr>
              </thead>
              <tbody>{rows.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {Object.values(r).map((v, j) => <td key={j} className="px-2 py-1">{String(v)}</td>)}
                </tr>
              ))}</tbody>
            </table>
            {rows.length > 5 && <p className="text-xs text-muted-foreground px-2 py-1">...and {rows.length - 5} more rows</p>}
          </div>
          <button onClick={() => void upload()} disabled={loading}
            className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Inventory"}
          </button>
        </>
      )}
      {result && (
        <div className="space-y-1">
          <p className="text-sm text-emerald-700 font-medium">
            Ingredients: {result.ingredients} &#183; Menu Items: {result.menuItems} &#183; BOM rows: {result.bom}
          </p>
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-2 max-h-32 overflow-auto">
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
