import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { superFetch, type CenterWithStatus } from "@/lib/api";

// ── Upload Members Dialog ──────────────────────────────────────────────────────

export function UploadMembersDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: (count: number) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!rows) return;
    setLoading(true);
    try {
      const res = await superFetch<{ created: number; skipped: number; errors: string[] }>(
        `/admin/super/centers/${center.id}/upload/members`,
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      setResult(res);
      onSuccess(res.created);
    } catch (err) {
      setResult({ created: 0, skipped: 0, errors: [err instanceof Error ? err.message : "Upload failed"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Bulk Upload Members</h3>
            <p className="text-xs text-muted-foreground">{center.name} &middot; {center.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload an XLSX or CSV with columns: <strong>name</strong>, <strong>membership_no</strong>, email, mobile, height_cm, date_of_joining, dob, age_at_joining, valid_until
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Members"}
            </button>
          </>
        )}
        {result && (
          <div className="space-y-1">
            <p className="text-sm text-emerald-700 font-medium">Created: {result.created} &middot; Skipped (duplicates): {result.skipped}</p>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2 max-h-32 overflow-auto">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upload Inventory Dialog ────────────────────────────────────────────────────

export function UploadInventoryDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: (res: { ingredients: number; menuItems: number; bom: number }) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ingredients: number; menuItems: number; bom: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!rows) return;
    setLoading(true);
    try {
      const res = await superFetch<{ ingredients: number; menuItems: number; bom: number; errors: string[] }>(
        `/admin/super/centers/${center.id}/upload/inventory`,
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      setResult(res);
      onSuccess({ ingredients: res.ingredients, menuItems: res.menuItems, bom: res.bom });
    } catch (err) {
      setResult({ ingredients: 0, menuItems: 0, bom: 0, errors: [err instanceof Error ? err.message : "Upload failed"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Bulk Upload Inventory</h3>
            <p className="text-xs text-muted-foreground">{center.name} &middot; {center.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
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
              Ingredients: {result.ingredients} &middot; Menu Items: {result.menuItems} &middot; BOM rows: {result.bom}
            </p>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-2 max-h-32 overflow-auto">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
