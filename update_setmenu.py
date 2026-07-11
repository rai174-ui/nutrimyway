content = '''import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Loader2, Save, X, Settings2, GripVertical } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, type Ingredient, type CheckinCategory } from "@/lib/api";

export default function SetMenuPage() {
  const [categories, setCategories] = useState<CheckinCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [selectedIngredients, setSelectedIngredients] = useState<number[]>([]);

  const centerId = localStorage.getItem("admin_center_id");

  async function load() {
    if (!centerId) return;
    try {
      const [catsRes, ingsRes] = await Promise.all([
        apiGet<CheckinCategory[]>(/admin/centers//checkin-categories),
        apiGet<Ingredient[]>("/admin/ingredients")
      ]);
      setCategories(catsRes);
      setIngredients(ingsRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [centerId]);

  function startCreate() {
    setEditId(null);
    setName("");
    setIsMandatory(true);
    setDisplayOrder(categories.length);
    setSelectedIngredients([]);
    setIsEditing(true);
  }

  function startEdit(cat: CheckinCategory) {
    setEditId(cat.id);
    setName(cat.name);
    setIsMandatory(cat.is_mandatory);
    setDisplayOrder(cat.display_order);
    setSelectedIngredients(cat.ingredients.map(i => i.ingredient_id));
    setIsEditing(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    try {
      if (editId) {
        await apiPut(/admin/centers//checkin-categories/, {
          name, is_mandatory: isMandatory, display_order: displayOrder, ingredients: selectedIngredients
        });
      } else {
        await apiPost(/admin/centers//checkin-categories, {
          name, is_mandatory: isMandatory, display_order: displayOrder, ingredients: selectedIngredients
        });
      }
      setIsEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this category?")) return;
    setLoading(true);
    try {
      await apiDelete(/admin/centers//checkin-categories/);
      await load();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  if (loading && categories.length === 0) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check-in Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure groups of ingredients members can choose from during check-in.</p>
        </div>
        <button onClick={startCreate} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Add Category
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">{error}</div>}

      <div className="space-y-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
            <div className="p-5 flex items-center justify-between border-b border-border/50 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 text-primary rounded-xl"><Settings2 className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-bold text-foreground text-lg flex items-center gap-2">
                    {cat.name}
                    {cat.is_mandatory && <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Mandatory</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Order: {cat.display_order}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(cat)} className="p-2 text-muted-foreground hover:bg-slate-200 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(cat.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-5 bg-white">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Available Ingredients</h4>
              {cat.ingredients.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No ingredients assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cat.ingredients.map(ing => (
                    <div key={ing.ingredient_id} className="text-sm font-medium px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                      {ing.name} {ing.flavour ? () : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-slate-50 text-muted-foreground">
            No categories found. Click Add Category to create your first check-in group.
          </div>
        )}
      </div>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-50/50">
              <h2 className="text-lg font-bold text-foreground">{editId ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 rounded-xl text-muted-foreground hover:bg-slate-200 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Category Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Shake Flavour" className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Display Order</label>
                  <input type="number" value={displayOrder} onChange={e => setDisplayOrder(Number(e.target.value))} className="w-full px-4 py-2.5 bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm font-medium" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <input type="checkbox" id="mandatory" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="w-5 h-5 rounded border-input text-primary focus:ring-primary/40" />
                  <label htmlFor="mandatory" className="text-sm font-bold text-foreground">Is Mandatory?</label>
                </div>
              </div>
              
              <div className="pt-2 border-t border-border">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 ml-1">Select Ingredients</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {ingredients.map(ing => (
                    <label key={ing.id} className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-input text-primary"
                        checked={selectedIngredients.includes(ing.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedIngredients([...selectedIngredients, ing.id]);
                          else setSelectedIngredients(selectedIngredients.filter(id => id !== ing.id));
                        }}
                      />
                      <span className="text-sm font-medium">{ing.name} {ing.flavour ? () : ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border bg-slate-50/50 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-slate-200 transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={loading} className="px-6 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm flex items-center gap-2 shadow-sm disabled:opacity-50">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''
with open('artifacts/nutrimyway-admin/src/pages/set-menu.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
