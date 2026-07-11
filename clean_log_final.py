import re

with open('scratch_log.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Start of the types section:
type_start = content.find('interface BomComponent')
# End of the types section:
type_end = content.find('// Wizard states')

types_new = '''interface CategoryIngredient {
  category_id: number;
  ingredient_id: number;
  name: string;
  flavour: string | null;
}

interface CheckinCategory {
  id: number;
  center_id: string;
  name: string;
  is_mandatory: boolean;
  display_order: number;
  ingredients: CategoryIngredient[];
}

interface CheckinMenuResponse {
  categories: CheckinCategory[];
  selections: { category_id: number; ingredient_id: number }[];
}

'''
content = content[:type_start] + types_new + content[type_end:]

# Fix states
state_old = '''  const [checkinOptions, setCheckinOptions] = useState<CheckinOptions | null>(null);
  const [selections, setSelections] = useState<SelectionItem[]>([]);
  const [pendingFlavourFor, setPendingFlavourFor] = useState<{ item: CenterMenuItem } | null>(null);
  const [savingSelections, setSavingSelections] = useState(false);
  const [flavourOnly, setFlavourOnly] = useState(false);'''
state_new = '''  const [checkinMenu, setCheckinMenu] = useState<CheckinMenuResponse | null>(null);
  const [selections, setSelections] = useState<{ category_id: number; ingredient_id: number }[]>([]);
  const [savingSelections, setSavingSelections] = useState(false);'''
content = content.replace(state_old, state_new)

# Fix useEffect
fetch_old = '''apiFetch(`/members/${MEMBER_ID}/checkin-options`)
      .then(r => r.json())
      .then((data: CheckinOptions) => {
        setCheckinOptions(data);
        setSelections(data.selections ?? []);
      })'''
fetch_new = '''apiFetch(`/members/${MEMBER_ID}/checkin-menu`)
      .then(r => r.json())
      .then((data: CheckinMenuResponse) => {
        setCheckinMenu(data);
        setSelections(data.selections ?? []);
      })'''
content = content.replace(fetch_old, fetch_new)

# Find and replace old handlers
handlers_start = content.find('  function isMenuItemSelected(id: number)')
handlers_end = content.find('  function handleCameraClick()')

handlers_new = '''  function isIngredientSelected(categoryId: number, ingredientId: number) {
    return selections.some(s => s.category_id === categoryId && s.ingredient_id === ingredientId);
  }

  function handleIngredientSelect(categoryId: number, ingredientId: number, isMandatory: boolean) {
    if (isIngredientSelected(categoryId, ingredientId)) {
      if (!isMandatory) {
        setSelections(prev => prev.filter(s => !(s.category_id === categoryId && s.ingredient_id === ingredientId)));
      }
      return;
    }
    
    setSelections(prev => {
      const filtered = prev.filter(s => s.category_id !== categoryId);
      return [...filtered, { category_id: categoryId, ingredient_id: ingredientId }];
    });
  }

  async function saveSelections() {
    if (!MEMBER_ID) return;
    setSavingSelections(true);
    try {
      const res = await apiFetch(`/members/${MEMBER_ID}/checkin/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selections }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Check-in menu updated" });
    } catch {
      toast({ title: "Failed to update menu", variant: "destructive" });
    } finally {
      setSavingSelections(false);
    }
  }

'''
content = content[:handlers_start] + handlers_new + content[handlers_end:]

# Render Section
render_start = content.find('  const checkin = checkinOptions?.checkin ?? null;')
render_end = content.find('        {/* Slot selector */}')

render_new = '''  return (
    <>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
        <header className="pt-4 pb-2">
          <h1 className="text-2xl font-bold text-foreground">Log Meal</h1>
        </header>

        {/* Daily Club Check-in */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="bg-card border border-border rounded-[12px] p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Center Check-in Menu</h3>
                <p className="text-sm text-muted-foreground">Select what you're having today</p>
              </div>
            </div>

            {!checkinMenu ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading menu...</p>
            ) : checkinMenu.categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No check-in categories available at this center.</p>
            ) : (
              <div className="space-y-6">
                {checkinMenu.categories.map(cat => (
                  <div key={cat.id}>
                    <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                      {cat.name}
                      {cat.is_mandatory && <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Required</span>}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {cat.ingredients.map(ing => {
                        const selected = isIngredientSelected(cat.id, ing.ingredient_id);
                        return (
                          <button
                            key={ing.ingredient_id}
                            onClick={() => handleIngredientSelect(cat.id, ing.ingredient_id, cat.is_mandatory)}
                            className={`text-left p-3 rounded-[10px] border flex flex-col justify-between h-20 transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-muted/30 border-border text-foreground hover:bg-muted"
                            }`}
                          >
                            <span className={`text-sm font-medium line-clamp-2 leading-tight ${selected ? 'text-primary-foreground' : ''}`}>{ing.name}</span>
                            {ing.flavour && (
                              <span className={`text-xs mt-1 truncate ${selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                {ing.flavour}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {cat.ingredients.length === 0 && (
                        <div className="col-span-2 text-xs text-muted-foreground italic">No options available.</div>
                      )}
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={saveSelections}
                  disabled={savingSelections}
                  className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl shadow-sm hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
                >
                  {savingSelections ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Save Menu Selections
                </button>
              </div>
            )}
          </div>
        </motion.div>

'''
content = content[:render_start] + render_new + content[render_end:]

with open('artifacts/nutrimyway/src/pages/log.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
