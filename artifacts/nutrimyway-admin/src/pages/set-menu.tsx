import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Loader2, Check, X, UtensilsCrossed } from "lucide-react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, apiPut, apiDelete, getAdminCenter, bomPutPath, bomDeletePath,
  type MenuItem, type BomComponent
} from "@/lib/api";

function BomRow({ bom, menuItemId, onUpdate, onDelete }: {
  bom: BomComponent;
  menuItemId: number;
  onUpdate: (updated: BomComponent) => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ingredient, setIngredient] = useState(bom.ingredient);
  const [quantity, setQuantity] = useState(String(bom.quantity));
  const [unit, setUnit] = useState(bom.unit);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiPut<BomComponent>(bomPutPath(menuItemId, bom.id), {
        ingredient, quantity: Number(quantity), unit
      });
      onUpdate(updated);
      setEditing(false);
    } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 border-t border-border/50">
        <input value={ingredient} onChange={e => setIngredient(e.target.value)}
          className="flex-1 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Ingredient" />
        <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number"
          className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Qty" />
        <input value={unit} onChange={e => setUnit(e.target.value)}
          className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Unit" />
        <button onClick={save} disabled={saving} className="text-primary hover:text-primary/80 disabled:opacity-40">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 border-t border-border/50 group">
      <span className="flex-1 text-sm text-foreground">{bom.ingredient}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{bom.quantity} {bom.unit}</span>
      <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all">
        <Edit2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onDelete(bom.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddBomForm({ menuItemId, onAdded }: { menuItemId: number; onAdded: (b: BomComponent) => void }) {
  const [ingredient, setIngredient] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!ingredient.trim()) return;
    setSaving(true);
    try {
      const b = await apiPost<BomComponent>(`/admin/menu-items/${menuItemId}/bom`, {
        ingredient, quantity: Number(quantity) || 0, unit
      });
      onAdded(b);
      setIngredient(""); setQuantity(""); setUnit("g");
    } finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-dashed border-border">
      <input value={ingredient} onChange={e => setIngredient(e.target.value)}
        className="flex-1 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Add ingredient…"
        onKeyDown={e => e.key === "Enter" && add()} />
      <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number"
        className="w-20 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Qty" />
      <input value={unit} onChange={e => setUnit(e.target.value)}
        className="w-16 h-8 px-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="Unit" />
      <button onClick={add} disabled={!ingredient.trim() || saving}
        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function MenuItemCard({ item, onUpdate, onDelete }: {
  item: MenuItem;
  onUpdate: (updated: MenuItem) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [saving, setSaving] = useState(false);
  const [bom, setBom] = useState<BomComponent[]>(item.bom);

  async function saveItem() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const updated = await apiPut<MenuItem>(`/admin/menu-items/${item.id}`, { name, description });
      onUpdate({ ...updated, bom });
      setEditing(false);
    } finally { setSaving(false); }
  }

  async function deleteBom(bomId: number) {
    await apiDelete(bomDeletePath(item.id, bomId));
    setBom(prev => prev.filter(b => b.id !== bomId));
  }

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
              <p className="font-semibold text-foreground truncate">{item.name}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>}
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {bom.length} component{bom.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-primary transition-colors">
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
            <span className="w-20">Quantity</span>
            <span className="w-16">Unit</span>
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
              onUpdate={updated => setBom(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onDelete={deleteBom}
            />
          ))}
          <AddBomForm menuItemId={item.id} onAdded={b => setBom(prev => [...prev, b])} />
        </div>
      )}
    </div>
  );
}

export default function SetMenuPage() {
  const center = getAdminCenter();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!center) return;
    apiGet<MenuItem[]>(`/admin/centers/${center.id}/menu-items`)
      .then(setItems)
      .finally(() => setLoading(false));
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

