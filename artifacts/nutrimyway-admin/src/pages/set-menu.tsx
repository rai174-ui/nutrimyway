import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Loader2, Check, X, UtensilsCrossed, Lock } from "lucide-react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiPut, apiDelete, apiPatch, getAdminCenter, bomPutPath, bomDeletePath,
  type MenuItem, type BomComponent, type Ingredient, type OpenFlavour
} from "@/lib/api";

const UNITS = ["g", "ml", "mg", "kg", "L", "tsp", "tbsp", "cup", "oz", "pcs", "serving", "scoop"] as const;
type Unit = typeof UNITS[number];

function UnitSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const isKnown = UNITS.includes(value as Unit);
  return (
    <select
      value={isKnown ? value : "__other__"}
      onChange={e => onChange(e.target.value === "__other__" ? value : e.target.value)}
      className={className}
    >
      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      {!isKnown && value && <option value="__other__">{value}</option>}
    </select>
  );
}

function IngredientSelect({
  ingredients,
  value,
  onChange,
  className,
}: {
  ingredients: Ingredient[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className}>
      <option value="">— select ingredient —</option>
      {ingredients.map(i => (
        <option key={i.id} value={String(i.id)}>
          {i.name} ({i.pack_size}{i.pack_unit})
        </option>
      ))}
    </select>
  );
}

function BomRow({ bom, menuItemId, ingredients, onUpdate, onDelete }: {
  bom: BomComponent;
  menuItemId: number;
  ingredients: Ingredient[];
  onUpdate: (updated: BomComponent) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ingredientId, setIngredientId] = useState(bom.ingredient_id != null ? String(bom.ingredient_id) : "");
  const [quantity, setQuantity] = useState(String(bom.quantity));
  const [unit, setUnit] = useState(bom.unit);
  const [kcal, setKcal] = useState(bom.kcal != null ? String(bom.kcal) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleIngredientChange(id: string) {
    setIngredientId(id);
    if (id) {
      const ing = ingredients.find(i => String(i.id) === id);
      if (ing) setUnit(ing.pack_unit);
    }
  }

  async function save() {
    if (!ingredientId) { setError("Select an ingredient from the master list"); return; }
    setSaving(true); setError(null);
    try {
      const updated = await apiPut<BomComponent>(bomPutPath(menuItemId, bom.id), {
        ingredient_id: Number(ingredientId),
        quantity: Number(quantity),
        unit,
        kcal: kcal !== "" ? Number(kcal) : null,
      });
      onUpdate(updated);
      setEditing(false);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1 py-2 border-t border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <IngredientSelect
            ingredients={ingredients}
            value={ingredientId}
            onChange={handleIngredientChange}
            className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            type="number" min="0" step="any"
            className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Qty"
          />
          <UnitSelect
            value={unit}
            onChange={setUnit}
            className="w-24 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="relative">
            <input
              value={kcal}
              onChange={e => setKcal(e.target.value)}
              type="number" min="0" step="any"
              className="w-24 h-8 pl-2 pr-8 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="KCal"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">kcal</span>
          </div>
          <button onClick={save} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button onClick={() => { setEditing(false); setError(null); }} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && <p className="text-xs text-destructive pl-0.5">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 border-t border-border/50 group">
      <span className="flex-1 text-sm text-foreground">{bom.ingredient}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{bom.quantity} {bom.unit}</span>
      {bom.kcal != null
        ? <span className="text-xs font-medium text-amber-600 tabular-nums">{bom.kcal} kcal</span>
        : <span className="text-xs text-muted-foreground/40">—</span>
      }
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all">
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onDelete(bom.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddBomForm({ menuItemId, ingredients, onAdded }: {
  menuItemId: number;
  ingredients: Ingredient[];
  onAdded: (b: BomComponent) => void;
}) {
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<string>("g");
  const [kcal, setKcal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleIngredientChange(id: string) {
    setIngredientId(id);
    if (id) {
      const ing = ingredients.find(i => String(i.id) === id);
      if (ing) { setUnit(ing.pack_unit); }
    }
  }

  async function add() {
    if (!ingredientId) { setError("Select an ingredient from the master list"); return; }
    setSaving(true); setError(null);
    try {
      const b = await apiPost<BomComponent>(`/admin/menu-items/${menuItemId}/bom`, {
        ingredient_id: Number(ingredientId),
        quantity: Number(quantity) || 0,
        unit,
        kcal: kcal !== "" ? Number(kcal) : null,
      });
      onAdded(b);
      setIngredientId(""); setQuantity(""); setUnit("g"); setKcal("");
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  const noIngredients = ingredients.length === 0;

  return (
    <div className="flex flex-col gap-1 pt-2 border-t border-dashed border-border">
      {noIngredients && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          No ingredients in the master list yet. Go to <strong>Inventory</strong> to add ingredients first.
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <IngredientSelect
          ingredients={ingredients}
          value={ingredientId}
          onChange={handleIngredientChange}
          className="flex-1 min-w-[160px] h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        />
        <input
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          type="number" min="0" step="any"
          className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Qty"
        />
        <UnitSelect
          value={unit}
          onChange={setUnit}
          className="w-24 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="relative">
          <input
            value={kcal}
            onChange={e => setKcal(e.target.value)}
            type="number" min="0" step="any"
            className="w-24 h-8 pl-2 pr-8 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="KCal"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">kcal</span>
        </div>
        <button
          onClick={() => void add()}
          disabled={noIngredients || saving}
          className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive pl-0.5">{error}</p>}
    </div>
  );
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function parseDays(val: string): string[] {
  if (!val || val === "all") return [];
  return val.split(",").map(d => d.trim()).filter(Boolean);
}

function formatDays(selected: string[]): string {
  if (selected.length === 0 || selected.length === 7) return "all";
  return selected.join(",");
}

function MenuItemCard({ item, ingredients, onUpdate, onDelete, centerId }: {
  item: MenuItem;
  ingredients: Ingredient[];
  onUpdate: (updated: MenuItem) => void;
  onDelete: (id: number) => void;
  centerId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [selectedFlavours, setSelectedFlavours] = useState<string[]>(
    (item.flavours ?? "").split(",").map(f => f.trim()).filter(Boolean)
  );
  const [openFlavours, setOpenFlavours] = useState<OpenFlavour[]>([]);
  const [loadingFlavours, setLoadingFlavours] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(parseDays(item.available_days ?? "all"));
  const [trialEligible, setTrialEligible] = useState(item.trial_eligible ?? false);
  const [saving, setSaving] = useState(false);
  const [togglingMandatory, setTogglingMandatory] = useState(false);
  const [bom, setBom] = useState<BomComponent[]>(item.bom);

  const isAllDays = selectedDays.length === 0;

  function toggleDay(day: string) {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        const next = prev.filter(d => d !== day);
        return next;
      }
      return [...prev, day].sort((a, b) => ALL_DAYS.indexOf(a as typeof ALL_DAYS[number]) - ALL_DAYS.indexOf(b as typeof ALL_DAYS[number]));
    });
  }

  async function toggleMandatory() {
    setTogglingMandatory(true);
    try {
      const updated = await apiPatch<MenuItem>(`/admin/menu-items/${item.id}/toggle-mandatory`);
      onUpdate({ ...updated, bom });
    } finally { setTogglingMandatory(false); }
  }

  async function saveItem() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await apiPut<MenuItem>(`/admin/menu-items/${item.id}`, {
        name, description,
        flavours: selectedFlavours.join(","),
        available_days: formatDays(selectedDays),
        trial_eligible: trialEligible,
      });
      onUpdate({ ...updated, bom });
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function deleteBom(bomId: number) {
    await apiDelete(bomDeletePath(item.id, bomId));
    setBom(prev => prev.filter(b => b.id !== bomId));
  }

  const displayDays = item.available_days && item.available_days !== "all"
    ? item.available_days.split(",").map(d => d.trim()).filter(Boolean)
    : null;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        {editing ? (
          <>
            <div className="flex-1 flex flex-col gap-2">
              <input value={name} onChange={e => setName(e.target.value)}
                className="h-9 px-3 text-sm font-semibold rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Item name" />
              <input value={description} onChange={e => setDescription(e.target.value)}
                className="h-8 px-3 text-xs rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Description (optional)" />
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 min-h-[2rem]">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-0.5">Flavours:</span>
                {loadingFlavours ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : openFlavours.length === 0 && selectedFlavours.filter(f => f).length === 0 ? (
                  <span className="text-[11px] text-muted-foreground/60">No flavoured batches open at this center</span>
                ) : (
                  <>
                    {openFlavours.map(({ flavour }) => {
                      const active = selectedFlavours.includes(flavour);
                      return (
                        <button key={flavour} type="button"
                          onClick={() => setSelectedFlavours(prev => active ? prev.filter(f => f !== flavour) : [...prev, flavour])}
                          className={`h-5 px-2 rounded-full text-[10px] font-semibold border transition-colors ${active ? "bg-violet-600 text-white border-violet-600" : "border-border text-muted-foreground hover:border-violet-300 hover:text-violet-600"}`}
                        >
                          {flavour}
                        </button>
                      );
                    })}
                    {selectedFlavours.filter(f => f && !openFlavours.some(o => o.flavour === f)).map(f => (
                      <button key={f} type="button"
                        onClick={() => setSelectedFlavours(prev => prev.filter(x => x !== f))}
                        title="No open batch — click to remove"
                        className="h-5 px-2 rounded-full text-[10px] font-semibold border border-amber-300 text-amber-700 bg-amber-50 transition-colors"
                      >
                        {f} ✕
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">Days:</span>
                <button
                  type="button"
                  onClick={() => setSelectedDays([])}
                  className={`h-6 px-2.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    isAllDays
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  All
                </button>
                {ALL_DAYS.map(day => {
                  const active = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`h-6 w-9 rounded-full text-[11px] font-semibold border transition-colors ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-600"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trialEligible}
                  onChange={e => setTrialEligible(e.target.checked)}
                  className="w-3.5 h-3.5 accent-primary"
                />
                Trial-eligible (shown to trial members regardless of day)
              </label>
            </div>
            <button onClick={saveItem} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-40">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-foreground truncate">{item.name}</p>
                {item.is_mandatory && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 flex-shrink-0">
                    <Lock className="w-2.5 h-2.5" />Mandatory
                  </span>
                )}
              </div>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>}
              <div className="flex flex-wrap gap-1 mt-1">
                {displayDays ? (
                  displayDays.map(d => (
                    <span key={d} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-1.5 py-0.5 font-semibold">{d}</span>
                  ))
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">All days</span>
                )}
                {item.flavours && item.flavours.trim() && item.flavours.split(",").filter(f => f.trim()).map(f => (
                  <span key={f} className="text-[10px] bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5 font-medium">{f.trim()}</span>
                ))}
                {item.trial_eligible && (
                  <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5 font-semibold">Trial-eligible</span>
                )}
              </div>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {bom.length} component{bom.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => void toggleMandatory()}
              disabled={togglingMandatory}
              title={item.is_mandatory ? "Remove mandatory flag" : "Mark as mandatory (always served)"}
              className={`transition-colors disabled:opacity-40 ${item.is_mandatory ? "text-teal-600 hover:text-teal-800" : "text-muted-foreground hover:text-teal-600"}`}
            >
              <Lock className="w-4 h-4" />
            </button>
            <button onClick={() => {
              setEditing(true);
              setLoadingFlavours(true);
              apiGet<OpenFlavour[]>(`/admin/centers/${centerId}/open-flavours`)
                .then(data => setOpenFlavours(data))
                .finally(() => setLoadingFlavours(false));
            }} className="text-muted-foreground hover:text-primary transition-colors">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-4 border-t border-border/50">
          <div className="flex items-center gap-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex-1">Ingredient</span>
            <span className="w-20">Qty</span>
            <span className="w-24">Unit</span>
            <span className="w-16 text-right">KCal</span>
            <span className="w-12" />
          </div>
          {bom.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">No components yet. Add one below.</p>
          )}
          {bom.map(b => (
            <BomRow
              key={b.id}
              bom={b}
              menuItemId={item.id}
              ingredients={ingredients}
              onUpdate={updated => setBom(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDelete={deleteBom}
            />
          ))}
          {bom.length > 0 && (() => {
            const totalKcal = bom.reduce((s, b) => s + (b.kcal ?? 0), 0);
            const hasAnyKcal = bom.some(b => b.kcal != null);
            return hasAnyKcal ? (
              <div className="flex items-center gap-2 pt-2 mt-1 border-t border-border text-xs font-semibold text-foreground">
                <span className="flex-1 text-muted-foreground">Total (1 serving)</span>
                <span className="text-amber-600">{Math.round(totalKcal)} kcal</span>
              </div>
            ) : null;
          })()}
          <AddBomForm menuItemId={item.id} ingredients={ingredients} onAdded={b => setBom(prev => [...prev, b])} />
        </div>
      )}
    </div>
  );
}

export default function SetMenuPage() {
  const center = getAdminCenter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!center) return;
    Promise.all([
      apiGet<MenuItem[]>(`/admin/centers/${center.id}/menu-items`),
      apiGet<Ingredient[]>("/admin/ingredients"),
    ]).then(([menuItems, ings]) => {
      setItems(menuItems);
      setIngredients(ings);
    }).finally(() => setLoading(false));
  }, [center?.id]);

  async function addItem() {
    if (!newName.trim() || !center) return;
    setSaving(true);
    try {
      const item = await apiPost<MenuItem>(`/admin/centers/${center.id}/menu-items`, {
        name: newName, description: newDesc
      });
      setItems(prev => [...prev, item]);
      setNewName(""); setNewDesc(""); setAdding(false);
    } finally { setSaving(false); }
  }

  async function deleteItem(id: number) {
    await apiDelete(`/admin/menu-items/${id}`);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Set Menu</h1>
            <p className="text-muted-foreground text-sm mt-1">Define items offered at {center?.name} with their BOM components</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {adding && (
          <div className="bg-card rounded-2xl border border-primary/40 shadow-sm p-5 mb-4 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">New Menu Item</h3>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              className="h-10 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Item name (e.g. Morning Shake)" autoFocus />
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              className="h-10 px-3 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Description (optional)" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAdding(false); setNewName(""); setNewDesc(""); }}
                className="h-9 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button onClick={addItem} disabled={!newName.trim() || saving}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No menu items yet</p>
            <p className="text-sm mt-1">Add your first item to get started</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => (
              <MenuItemCard
                key={item.id}
                item={item}
                ingredients={ingredients}
                centerId={center?.id ?? ""}
                onUpdate={updated => setItems(prev => prev.map(i => i.id === updated.id ? updated : i))}
                onDelete={deleteItem}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
