import re

with open('artifacts/nutrimyway/src/pages/log.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace types and fetch logic
types_block_old = r'''interface BomComponent {.*?interface CheckinOptions {.*?selections: SelectionItem\[\];\n}'''
types_block_new = '''
interface CategoryIngredient {
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
content = re.sub(types_block_old, types_block_new, content, flags=re.DOTALL)

# Replace state variables
state_old = r'''  const \[checkinOptions, setCheckinOptions\] = useState<CheckinOptions \| null>\(null\);\n  const \[selections, setSelections\] = useState<SelectionItem\[\]>\(\[\]\);\n  const \[pendingFlavourFor, setPendingFlavourFor\] = useState<\{ item: CenterMenuItem \} \| null>\(null\);\n  const \[savingSelections, setSavingSelections\] = useState\(false\);\n  const \[flavourOnly, setFlavourOnly\] = useState\(false\);'''
state_new = '''  const [checkinMenu, setCheckinMenu] = useState<CheckinMenuResponse | null>(null);
  const [selections, setSelections] = useState<{ category_id: number; ingredient_id: number }[]>([]);
  const [savingSelections, setSavingSelections] = useState(false);'''
content = re.sub(state_old, state_new, content)

# Replace useEffect fetch
fetch_old = r'''apiFetch\(/members/\$\{MEMBER_ID\}/checkin-options\)\n      \.then\(r => r\.json\(\)\)\n      \.then\(\(data: CheckinOptions\) => \{\n        setCheckinOptions\(data\);\n        setSelections\(data\.selections \?\? \[\]\);\n      \}\)\n      \.catch\(\(\) => \{\}\);'''
fetch_new = '''apiFetch(/members//checkin-menu)
      .then(r => r.json())
      .then((data: CheckinMenuResponse) => {
        setCheckinMenu(data);
        setSelections(data.selections ?? []);
      })
      .catch(() => {});'''
content = re.sub(fetch_old, fetch_new, content)

# Remove isMenuItemSelected and isFlavourSelected
content = re.sub(r'  function isMenuItemSelected.*?\n  \}', '', content, flags=re.DOTALL)
content = re.sub(r'  function isFlavourSelected.*?\n  \}', '', content, flags=re.DOTALL)

# Add isIngredientSelected
is_selected_new = '''  function isIngredientSelected(categoryId: number, ingredientId: number) {
    return selections.some(s => s.category_id === categoryId && s.ingredient_id === ingredientId);
  }

  function handleIngredientSelect(categoryId: number, ingredientId: number, isMandatory: boolean) {
    if (isIngredientSelected(categoryId, ingredientId)) {
      if (!isMandatory) {
        setSelections(prev => prev.filter(s => !(s.category_id === categoryId && s.ingredient_id === ingredientId)));
      }
      return;
    }
    
    // Replace the selection for this category
    setSelections(prev => {
      const filtered = prev.filter(s => s.category_id !== categoryId);
      return [...filtered, { category_id: categoryId, ingredient_id: ingredientId }];
    });
  }'''
content = content.replace('  const createLog = useCreateConsumptionLog();', is_selected_new + '\n\n  const createLog = useCreateConsumptionLog();')

# Replace saveSelections
save_old = r'''  async function saveSelections\(newSelections: SelectionItem\[\]\) \{.*?finally \{ setSavingSelections\(false\); \}\n  \}'''
save_new = '''  async function saveSelections(newSelections: { category_id: number; ingredient_id: number }[]) {
    if (!MEMBER_ID) return;
    setSavingSelections(true);
    try {
      const res = await apiFetch(/members//checkin/selections, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: newSelections }),
      });
      if (!res.ok) throw new Error("Failed to save selection");
      toast({ title: "Check-in menu updated" });
    } catch {
      toast({ title: "Failed to update menu", variant: "destructive" });
    } finally { setSavingSelections(false); }
  }'''
content = re.sub(save_old, save_new, content, flags=re.DOTALL)

# Remove Modals
content = re.sub(r'      \{/\* Modal for selecting a flavour \*/\}.*?(?=      \{showWizard)', '', content, flags=re.DOTALL)

# Rewrite the "Daily Club Check-in" section
render_old = r'''            \{/\* Daily Club Check-in \*/\}.*?(?=            \{/\* External Food Log \*/\})'''
render_new = '''            {/* Daily Club Check-in */}
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
                                className={	ext-left p-3 rounded-[10px] border flex flex-col justify-between h-20 transition-all }
                              >
                                <span className={	ext-sm font-medium line-clamp-2 leading-tight }>{ing.name}</span>
                                {ing.flavour && (
                                  <span className={	ext-xs mt-1 truncate }>
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
                      onClick={() => saveSelections(selections)}
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
content = re.sub(render_old, render_new, content, flags=re.DOTALL)

with open('artifacts/nutrimyway/src/pages/log.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
