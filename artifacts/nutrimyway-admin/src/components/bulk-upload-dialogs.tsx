import { useState, useRef } from "react";
import { Upload, Loader2, Download } from "lucide-react";
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
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            const headers = ["name","membership_no","email","mobile","height_cm","date_of_joining","dob","age_at_joining","valid_until"];
            const sample = [["Amit Sharma","MEM-001","amit@example.com","9876543210","170","01-01-2024","15-05-1990","34","31-12-2025"]];
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Members");
            XLSX.writeFile(wb, "sample-members-upload.xlsx");
          }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Download sample
          </button>
        </div>
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

// ── Upload Batches Dialog ──────────────────────────────────────────────────────

export function UploadBatchesDialog({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: (count: number) => void }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ batches: number; errors: string[] } | null>(null);
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
      const res = await superFetch<{ batches: number; errors: string[] }>(
        "/admin/super/upload/batches",
        { method: "POST", body: JSON.stringify({ rows }) },
      );
      setResult(res);
      onSuccess(res.batches);
    } catch (err) {
      setResult({ batches: 0, errors: [err instanceof Error ? err.message : "Upload failed"] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Upload Batches</h3>
            <p className="text-xs text-muted-foreground">Upload stock batches across all centers in one file</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
        </div>
        <p className="text-xs text-muted-foreground">
          Required columns: <strong>CenterID</strong>, <strong>MaterialCode</strong>, <strong>BatchLotNumber</strong>, <strong>Qty</strong>, <strong>Status</strong> (New or Open), <strong>ReceiptDate</strong>
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            const headers = ["CenterID", "MaterialCode", "BatchLotNumber", "Qty", "Status", "ReceiptDate"];
            const sample = [
              ["CTR-001", "MAT-001", "LOT-2024-001", 100, "New", "2024-07-01"],
              ["CTR-001", "MAT-002", "LOT-2024-002", 50, "Open", "2024-07-02"],
              ["CTR-002", "MAT-001", "LOT-2024-003", 200, "New", "2024-07-03"],
            ];
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Batches");
            XLSX.writeFile(wb, "sample-batches-upload.xlsx");
          }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Download sample
          </button>
        </div>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Batches"}
            </button>
          </>
        )}
        {result && (
          <div className="space-y-1">
            <p className="text-sm text-emerald-700 font-medium">Batches uploaded: {result.batches}</p>
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
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            const headers = ["item_type","name","pack_size","pack_unit","material_code","description","flavour","serving_qty","kcal_per_serving","menu_item_name","ingredient_name","quantity","unit","kcal","is_mandatory","flavours","available_days"];
            const sample = [
              ["ingredient","Almonds",100,"g","MAT-001","Raw almonds","nut",10,58,null,null,null,null,null,null,null,null],
              ["ingredient","Whey Protein",500,"g","MAT-002","Vanilla whey","vanilla",1,120,null,null,null,null,null,null,null,null],
              ["menu_item","Morning Shake",null,null,null,"Daily protein shake","yes","vanilla,choco","Mon,Tue,Wed,Thu,Fri",null,null,null,null,null,"yes","vanilla,choco","Mon,Tue,Wed,Thu,Fri"],
              ["bom",null,null,null,null,null,null,null,null,"Morning Shake","Almonds",10,"g",58,null,null,null],
              ["bom",null,null,null,null,null,null,null,null,"Morning Shake","Whey Protein",1,"scoop",120,null,null,null],
            ];
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventory");
            XLSX.writeFile(wb, "sample-inventory-upload.xlsx");
          }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Download sample
          </button>
        </div>
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

// ── Upload Flavours Dialog ──────────────────────────────────────────────────────

export function UploadFlavoursDialog({
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
        `/admin/super/centers/${center.id}/upload/flavours`,
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
            <h3 className="text-base font-bold text-foreground">Bulk Upload Flavours</h3>
            <p className="text-xs text-muted-foreground">{center.name} &middot; {center.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload an XLSX or CSV with columns: <strong>name</strong>, available_days (comma-separated
          days or "all"), <strong>center</strong> (required on every row — a center ID or name, e.g.{" "}
          <strong>{center.id}</strong> or <strong>{center.name}</strong>). Rows can target different
          centers in the same file; rows with a missing or unrecognized center are rejected with an
          error and nothing is created for that row.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            const headers = ["name", "available_days", "center"];
            const sample = [
              ["Vanilla", "all", center.id],
              ["Chocolate", "Mon,Wed,Fri", center.id],
            ];
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Flavours");
            XLSX.writeFile(wb, "sample-flavours-upload.xlsx");
          }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Download sample
          </button>
        </div>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Flavours"}
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

// ── Upload Items Dialog ──────────────────────────────────────────────────────

export function UploadItemsDialog({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: (count: number) => void }) {
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
        "/admin/super/upload/items",
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
            <h3 className="text-base font-bold text-foreground">Bulk Upload Items</h3>
            <p className="text-xs text-muted-foreground">Item Master applies to specific centers</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">&#10005;</button>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload an XLSX or CSV with columns: <strong>name</strong>, <strong>center</strong> (required on every row — a center ID or name), <strong>material_code</strong>, pack_size, pack_unit, description, flavour, serving_qty, kcal_per_serving, protein_per_serving, fiber_per_serving, trial_eligible (yes/no)
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => {
            const headers = ["name", "center", "material_code", "pack_size", "pack_unit", "description", "flavour", "serving_qty", "kcal_per_serving", "protein_per_serving", "fiber_per_serving", "trial_eligible"];
            const sample = [
              ["Almonds", "DWK-1", "MAT-001", 100, "g", "Raw almonds", "nut", 10, 58, 2, 1.2, "no"],
              ["Whey Protein", "DWK-1", "MAT-002", 500, "g", "Vanilla whey", "vanilla", 1, 120, 24, 0, "yes"],
            ];
            const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Items");
            XLSX.writeFile(wb, "sample-items-upload.xlsx");
          }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Download sample
          </button>
        </div>
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
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload Items"}
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
