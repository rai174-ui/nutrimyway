import './_group.css';
import { useState } from "react";
import { Package, Plus, Edit2, Check, X, Trash2, Tag, Loader2, ChevronDown, ChevronUp } from "lucide-react";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = typeof ALL_DAYS[number];

const UNITS = ["g", "kg", "ml", "L", "pcs", "oz", "lb"];

type CenterFlavour = { id: number; name: string; available_days: string };
type Ingredient = {
  id: number;
  name: string;
  pack_size: number;
  pack_unit: string;
  material_code: string | null;
  description: string | null;
  flavour: string | null;
  serving_qty: number;
  kcal_per_serving: number | null;
  trial_eligible: boolean;
};

function parseDays(val: string): Day[] {
  if (!val || val === "all") return [...ALL_DAYS];
  return val.split(",").map(d => d.trim()).filter((d): d is Day => ALL_DAYS.includes(d as Day));
}
function formatDays(days: Day[]): string {
  if (days.length === ALL_DAYS.length) return "all";
  return days.join(",");
}

function DayPicker({ value, onChange }: { value: Day[]; onChange: (v: Day[]) => void }) {
  function toggle(day: Day) {
    onChange(
      value.includes(day)
        ? value.filter(d => d !== day)
        : [...value, day].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b))
    );
  }
  return (
    <div className="flex gap-1 flex-wrap">
      {ALL_DAYS.map(day => (
        <button key={day} type="button" onClick={() => toggle(day)}
          className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
            value.includes(day)
              ? "bg-violet-600 text-white"
              : "bg-muted text-muted-foreground hover:bg-violet-100 hover:text-violet-600"
          }`}>
          {day}
        </button>
      ))}
    </div>
  );
}

const MOCK_FLAVOURS: CenterFlavour[] = [
  { id: 1, name: "Chocolate Supreme Dark", available_days: "Mon,Tue,Wed" },
  { id: 2, name: "Strawberry Delight", available_days: "all" },
  { id: 3, name: "Vanilla Classic", available_days: "Thu,Fri,Sat" },
  { id: 4, name: "Mango Tango with a Twist", available_days: "Mon,Wed,Fri,Sun" },
  { id: 5, name: "Mint Chip", available_days: "Tue,Thu,Sat" },
  { id: 6, name: "Cookies and Cream Deluxe", available_days: "all" },
  { id: 7, name: "Salted Caramel", available_days: "Wed,Fri" },
  { id: 8, name: "Blueberry Burst", available_days: "Mon,Tue" },
];

const MOCK_INGREDIENTS: Ingredient[] = [
  { id: 1, name: "Chocolate Protein Shake", pack_size: 1, pack_unit: "pcs", material_code: "MAT-001", description: "Premium whey isolate with dark cocoa notes. Best consumed post-workout.", flavour: "Chocolate Supreme Dark", serving_qty: 2, kcal_per_serving: 180, trial_eligible: true },
  { id: 2, name: "Strawberry Smoothie Base", pack_size: 1, pack_unit: "ml", material_code: "MAT-002", description: "Natural strawberry puree with low-fat yogurt base.", flavour: "Strawberry Delight", serving_qty: 1, kcal_per_serving: 120, trial_eligible: false },
  { id: 3, name: "Vanilla Protein Bar", pack_size: 1, pack_unit: "pcs", material_code: "MAT-003", description: "Soft-baked bar with real vanilla bean extract.", flavour: "Vanilla Classic", serving_qty: 1, kcal_per_serving: 210, trial_eligible: true },
  { id: 4, name: "Mango Energy Bowl", pack_size: 1, pack_unit: "g", material_code: "MAT-004", description: "Tropical mango with chia seeds and coconut flakes.", flavour: "Mango Tango with a Twist", serving_qty: 3, kcal_per_serving: 340, trial_eligible: false },
  { id: 5, name: "Plain Greek Yogurt", pack_size: 1, pack_unit: "g", material_code: "MAT-005", description: "Unflavoured high-protein Greek yogurt base.", flavour: null, serving_qty: 1, kcal_per_serving: 90, trial_eligible: true },
  { id: 6, name: "Oatmeal Meal Pack", pack_size: 1, pack_unit: "pcs", material_code: "MAT-006", description: "Steel-cut oats with flaxseed and dried berries.", flavour: null, serving_qty: 2, kcal_per_serving: 250, trial_eligible: false },
];

function FlavourMaster() {
  const [flavours, setFlavours] = useState<CenterFlavour[]>(MOCK_FLAVOURS);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDays, setNewDays] = useState<Day[]>([...ALL_DAYS]);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editDays, setEditDays] = useState<Day[]>([...ALL_DAYS]);
  const [expanded, setExpanded] = useState(true);

  function addFlavour() {
    if (!newName.trim()) return;
    const id = Math.max(...flavours.map(f => f.id), 0) + 1;
    setFlavours(prev => [...prev, { id, name: newName.trim(), available_days: formatDays(newDays) }]);
    setNewName(""); setNewDays([...ALL_DAYS]); setAdding(false);
  }
  function startEdit(f: CenterFlavour) { setEditId(f.id); setEditDays(parseDays(f.available_days ?? "all")); }
  function saveEdit(id: number) {
    setFlavours(prev => prev.map(f => f.id === id ? { ...f, available_days: formatDays(editDays) } : f));
    setEditId(null);
  }
  function deleteFlavour(id: number) { setFlavours(prev => prev.filter(f => f.id !== id)); }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center"><Tag className="w-4 h-4 text-violet-600" /></div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Flavour Master</h2>
            <p className="text-xs text-muted-foreground">Set serving qty and available days per flavour</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">{flavours.length}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAdding(v => !v); setNewName(""); setNewDays([...ALL_DAYS]); }} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {expanded && (<>
        {adding && (
          <div className="px-5 py-4 border-b border-dashed border-border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Flavour name e.g. Chocolate"
                className="flex-1 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-violet-500" />
              <button onClick={() => addFlavour()} disabled={!newName.trim()} className="h-9 px-3 rounded-lg bg-violet-600 text-white text-xs font-medium disabled:opacity-40">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
              </button>
              <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Available</label>
              <DayPicker value={newDays} onChange={setNewDays} />
            </div>
          </div>
        )}
        <div className="divide-y divide-border">
          {flavours.map(f => (
            <div key={f.id} className="px-5 py-3 hover:bg-muted/20 transition-colors">
              {editId === f.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground flex-1">{f.name}</span>
                    <button onClick={() => saveEdit(f.id)} className="text-violet-600 hover:text-violet-700"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <DayPicker value={editDays} onChange={setEditDays} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-violet-700">{f.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {f.available_days && f.available_days !== "all" ? (
                        f.available_days.split(",").map(d => (
                          <span key={d} className="text-xs bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">{d.trim()}</span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">All days</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(f)} className="text-muted-foreground hover:text-violet-600 p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteFlavour(f.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

function ItemMaster() {
  const [ingredients, setIngredients] = useState<Ingredient[]>(MOCK_INGREDIENTS);
  const [flavours] = useState<CenterFlavour[]>(MOCK_FLAVOURS);
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("g");
  const [newMaterialCode, setNewMaterialCode] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newFlavour, setNewFlavour] = useState("");
  const [newServingQty, setNewServingQty] = useState("1");
  const [newKcal, setNewKcal] = useState("");
  const [newTrial, setNewTrial] = useState(false);

  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editMaterialCode, setEditMaterialCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFlavour, setEditFlavour] = useState("");
  const [editServingQty, setEditServingQty] = useState("1");
  const [editKcal, setEditKcal] = useState("");
  const [editTrial, setEditTrial] = useState(false);

  function addIngredient() {
    if (!newName.trim()) return;
    const id = Math.max(...ingredients.map(i => i.id), 0) + 1;
    setIngredients(prev => [...prev, {
      id, name: newName.trim(), pack_size: 1, pack_unit: newUnit,
      material_code: newMaterialCode.trim() || null,
      description: newDescription.trim() || null,
      flavour: newFlavour.trim() || null,
      serving_qty: Number(newServingQty) || 1,
      kcal_per_serving: newKcal.trim() ? Number(newKcal) : null,
      trial_eligible: newTrial,
    }]);
    setNewName(""); setNewUnit("g"); setNewMaterialCode(""); setNewDescription(""); setNewFlavour(""); setNewServingQty("1"); setNewKcal(""); setNewTrial(false);
    setAdding(false);
  }
  function saveEdit(id: number) {
    setIngredients(prev => prev.map(i => i.id === id ? {
      ...i, name: editName.trim(), pack_unit: editUnit, material_code: editMaterialCode.trim() || null,
      description: editDescription.trim() || null, flavour: editFlavour.trim() || null,
      serving_qty: Number(editServingQty) || 1, kcal_per_serving: editKcal.trim() ? Number(editKcal) : null,
      trial_eligible: editTrial,
    } : i));
    setEditId(null);
  }
  function deleteIngredient(id: number) { setIngredients(prev => prev.filter(i => i.id !== id)); }
  function startEdit(ing: Ingredient) {
    setEditId(ing.id); setEditName(ing.name); setEditUnit(ing.pack_unit); setEditMaterialCode(ing.material_code ?? "");
    setEditDescription(ing.description ?? ""); setEditFlavour(ing.flavour ?? "");
    setEditServingQty(String(ing.serving_qty ?? 1)); setEditKcal(ing.kcal_per_serving != null ? String(ing.kcal_per_serving) : ""); setEditTrial(ing.trial_eligible ?? false);
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button onClick={() => setExpanded(v => !v)} className="flex items-center gap-3 text-left hover:bg-muted/30 -m-2 p-2 rounded-lg transition-colors">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="w-4 h-4 text-primary" /></div>
          <div>
            <h2 className="font-semibold text-foreground leading-tight">Item Master</h2>
            <p className="text-xs text-muted-foreground">Define items with material code, flavour and pack sizes used in BOM &amp; inventory</p>
          </div>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">{ingredients.length}</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => { setAdding(v => !v); }} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
            <Plus className="w-3.5 h-3.5" />Add
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {expanded && (<>
        {adding && (
          <div className="px-5 py-4 border-b border-dashed border-border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Item name *" autoFocus className="flex-1 min-w-[200px] h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              <input value={newMaterialCode} onChange={e => setNewMaterialCode(e.target.value)} placeholder="Material code *" className="w-40 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              <select value={newFlavour} onChange={e => setNewFlavour(e.target.value)} className="w-40 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">— Flavour —</option>
                {flavours.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
            </div>
            <input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Description (optional)" className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
            <div className="flex items-center gap-3 flex-wrap">
              <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="w-24 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Serving qty</label>
                <input type="number" min="0.1" step="0.1" value={newServingQty} onChange={e => setNewServingQty(e.target.value)} className="w-20 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-muted-foreground whitespace-nowrap">kcal/serve</label>
                <input type="number" min="0" step="1" value={newKcal} onChange={e => setNewKcal(e.target.value)} placeholder="—" className="w-20 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={newTrial} onChange={e => setNewTrial(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />Trial-eligible
              </label>
              <button onClick={() => addIngredient()} disabled={!newName.trim()} className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
                Add
              </button>
              <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        <div className="divide-y divide-border">
          {ingredients.map(ing => (
            <div key={ing.id} className="px-5 py-4 hover:bg-muted/20 transition-colors">
              {editId === ing.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Item name *" className="flex-1 min-w-[200px] h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    <input value={editMaterialCode} onChange={e => setEditMaterialCode(e.target.value)} placeholder="Material code *" className="w-40 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    <select value={editFlavour} onChange={e => setEditFlavour(e.target.value)} className="w-40 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">— Flavour —</option>
                      {flavours.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                  <input value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Description" className="w-full h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <select value={editUnit} onChange={e => setEditUnit(e.target.value)} className="w-24 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">Serving qty</label>
                      <input type="number" min="0.1" step="0.1" value={editServingQty} onChange={e => setEditServingQty(e.target.value)} className="w-20 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-muted-foreground whitespace-nowrap">kcal/serve</label>
                      <input type="number" min="0" step="1" value={editKcal} onChange={e => setEditKcal(e.target.value)} placeholder="—" className="w-20 h-9 px-3 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                      <input type="checkbox" checked={editTrial} onChange={e => setEditTrial(e.target.checked)} className="w-3.5 h-3.5 accent-primary" />Trial-eligible
                    </label>
                    <button onClick={() => saveEdit(ing.id)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{ing.name}</span>
                      {ing.material_code && <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">{ing.material_code}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{ing.description || "No description"}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {ing.flavour && <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{ing.flavour}</span>}
                      <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">{ing.serving_qty} {ing.pack_unit}/serve</span>
                      {ing.kcal_per_serving != null && <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{ing.kcal_per_serving} kcal/serve</span>}
                      {ing.trial_eligible && <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">Trial-eligible</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(ing)} className="text-muted-foreground hover:text-primary p-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteIngredient(ing.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </>)}
    </div>
  );
}

export function VariantA() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      <FlavourMaster />
      <ItemMaster />
    </div>
  );
}
