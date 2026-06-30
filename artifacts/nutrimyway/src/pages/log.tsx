import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Sunrise, Sun, Apple, Moon, MapPin, Check, Loader2, X } from "lucide-react";
import { useCreateConsumptionLog, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

function todayLocal() { return new Date().toLocaleDateString("en-CA"); }
const BASE = "/api";

function autoSlot(): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const h = new Date(Date.now() + IST_OFFSET_MS).getUTCHours();
  if (h < 12) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 18) return "Snack";
  return "Dinner";
}

const slots = [
  { id: "Breakfast", icon: Sunrise },
  { id: "Lunch", icon: Sun },
  { id: "Snack", icon: Apple },
  { id: "Dinner", icon: Moon },
];

interface BomComponent {
  id: number;
  ingredient: string;
  quantity: number;
  unit: string;
  kcal: number | null;
}

interface CenterMenuItem {
  id: number;
  name: string;
  description: string | null;
  flavours?: string | null;
  bom: BomComponent[];
}

interface DirectFlavourItem {
  id: number;
  name: string;
  flavour: string;
  unit: string;
}

type SelectionItem =
  | { type: "menu_item"; menu_item_id: number; name: string; selected_flavour?: string | null }
  | { type: "direct_flavour"; ingredient_id: number; name: string; flavour: string };

interface CheckinOptions {
  checkin: { id: number; center_id: string; center_name: string; checked_in_at: string } | null;
  menuItems: CenterMenuItem[];
  directFlavours: DirectFlavourItem[];
  selections: SelectionItem[];
}

export function Log() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { memberId: MEMBER_ID } = useAuth();
  const [activeSlot, setActiveSlot] = useState(autoSlot);
  const [foodItem, setFoodItem] = useState("");
  const [customKcal, setCustomKcal] = useState("");

  const [checkinOptions, setCheckinOptions] = useState<CheckinOptions | null>(null);
  const [selections, setSelections] = useState<SelectionItem[]>([]);
  const [pendingFlavourFor, setPendingFlavourFor] = useState<{ item: CenterMenuItem } | null>(null);
  const [savingSelections, setSavingSelections] = useState(false);

  useEffect(() => {
    if (!MEMBER_ID) return;
    fetch(`${BASE}/members/${MEMBER_ID}/checkin-options`)
      .then(r => r.json())
      .then((data: CheckinOptions) => {
        setCheckinOptions(data);
        setSelections(data.selections ?? []);
      })
      .catch(() => {});
  }, [MEMBER_ID]);

  const createLog = useCreateConsumptionLog();

  const handleSave = () => {
    if (!foodItem.trim()) return;
    const kcal = customKcal !== "" ? Number(customKcal) : null;
    createLog.mutate(
      {
        memberId: MEMBER_ID!,
        data: {
          meal_slot: activeSlot,
          food_item: foodItem,
          calories_kcal: kcal,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: todayLocal() }) });
          toast({ title: "Meal logged successfully!" });
          setFoodItem("");
          setCustomKcal("");
        }
      }
    );
  };

  function isMenuItemSelected(id: number) {
    return selections.some(s => s.type === "menu_item" && s.menu_item_id === id);
  }
  function isDirectFlavourSelected(id: number) {
    return selections.some(s => s.type === "direct_flavour" && s.ingredient_id === id);
  }

  function handleMenuItemToggle(item: CenterMenuItem) {
    if (isMenuItemSelected(item.id)) {
      setSelections(prev => prev.filter(s => !(s.type === "menu_item" && s.menu_item_id === item.id)));
      setPendingFlavourFor(null);
      return;
    }
    if (selections.length >= 3) return;
    const flavourList = (item.flavours ?? "").split(",").map(f => f.trim()).filter(Boolean);
    if (flavourList.length > 0) {
      setPendingFlavourFor({ item });
    } else {
      setSelections(prev => [...prev, { type: "menu_item", menu_item_id: item.id, name: item.name, selected_flavour: null }]);
    }
  }

  function confirmMenuItemFlavour(flavour: string) {
    if (!pendingFlavourFor) return;
    const item = pendingFlavourFor.item;
    setSelections(prev => [...prev, { type: "menu_item", menu_item_id: item.id, name: item.name, selected_flavour: flavour }]);
    setPendingFlavourFor(null);
  }

  function handleDirectFlavourToggle(item: DirectFlavourItem) {
    if (isDirectFlavourSelected(item.id)) {
      setSelections(prev => prev.filter(s => !(s.type === "direct_flavour" && s.ingredient_id === item.id)));
      return;
    }
    if (selections.length >= 3) return;
    setSelections(prev => [...prev, { type: "direct_flavour", ingredient_id: item.id, name: item.name, flavour: item.flavour }]);
  }

  function removeSelection(sel: SelectionItem) {
    if (sel.type === "menu_item") {
      setSelections(prev => prev.filter(s => !(s.type === "menu_item" && s.menu_item_id === sel.menu_item_id)));
    } else {
      setSelections(prev => prev.filter(s => !(s.type === "direct_flavour" && s.ingredient_id === sel.ingredient_id)));
    }
  }

  async function saveSelections() {
    if (!MEMBER_ID) return;
    setSavingSelections(true);
    try {
      const res = await fetch(`${BASE}/members/${MEMBER_ID}/checkin/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selections }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: `${selections.length} item${selections.length !== 1 ? "s" : ""} saved for your visit` });
    } catch {
      toast({ title: "Could not save selections", variant: "destructive" });
    } finally {
      setSavingSelections(false);
    }
  }

  const checkin = checkinOptions?.checkin ?? null;
  const hasItems = (checkinOptions?.menuItems.length ?? 0) + (checkinOptions?.directFlavours.length ?? 0) > 0;
  const allItems = [...(checkinOptions?.menuItems ?? []), ...(checkinOptions?.directFlavours ?? [])];
  const totalCount = allItems.length;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Log Meal</h1>
        {checkin && (
          <p className="text-sm text-primary flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5" />
            Checked in at {checkin.center_name}
          </p>
        )}
      </header>

      {/* Check-in item selection — shown only when checked in and items exist */}
      {checkin && hasItems && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Choose Visit Items
            </h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
              selections.length === 3
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {selections.length} / 3
            </span>
          </div>

          <div className="bg-card border border-border rounded-[12px] overflow-hidden">
            {/* Menu items */}
            {(checkinOptions?.menuItems ?? []).map((item, i) => {
              const selected = isMenuItemSelected(item.id);
              const isPendingFlavour = pendingFlavourFor?.item.id === item.id;
              const flavourList = (item.flavours ?? "").split(",").map(f => f.trim()).filter(Boolean);
              const selEntry = selections.find(s => s.type === "menu_item" && s.menu_item_id === item.id) as (Extract<SelectionItem, { type: "menu_item" }>) | undefined;
              const totalKcal = item.bom.reduce((s, b) => s + (b.kcal ?? 0), 0);
              const hasKcal = item.bom.some(b => b.kcal != null);
              const isLast = i === totalCount - 1 && (checkinOptions?.directFlavours.length ?? 0) === 0;
              return (
                <div key={item.id} className={!isLast ? "border-b border-border" : ""}>
                  <button
                    onClick={() => handleMenuItemToggle(item)}
                    disabled={!selected && selections.length >= 3}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors disabled:opacity-40 ${selected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.name}</p>
                      {selEntry?.selected_flavour && (
                        <p className="text-xs text-primary font-medium">{selEntry.selected_flavour}</p>
                      )}
                      {item.description && !selEntry && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                      )}
                      {!selected && flavourList.length > 0 && (
                        <p className="text-xs text-primary/70 mt-0.5">Tap to pick flavour</p>
                      )}
                    </div>
                    {hasKcal && (
                      <span className="text-xs font-semibold text-amber-600 flex-shrink-0">{Math.round(totalKcal)} kcal</span>
                    )}
                  </button>
                  {isPendingFlavour && (
                    <div className="px-4 pb-3 bg-primary/5 border-t border-primary/10">
                      <p className="text-xs font-semibold text-primary mb-2 mt-2">Choose flavour:</p>
                      <div className="flex flex-wrap gap-2">
                        {flavourList.map(f => (
                          <button
                            key={f}
                            onClick={() => confirmMenuItemFlavour(f)}
                            className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                          >
                            {f}
                          </button>
                        ))}
                        <button
                          onClick={() => setPendingFlavourFor(null)}
                          className="px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Direct-order flavoured items */}
            {(checkinOptions?.directFlavours ?? []).map((item, i) => {
              const selected = isDirectFlavourSelected(item.id);
              const menuLen = checkinOptions?.menuItems.length ?? 0;
              const isLast = menuLen + i === totalCount - 1;
              return (
                <button
                  key={item.id}
                  onClick={() => handleDirectFlavourToggle(item)}
                  disabled={!selected && selections.length >= 3}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors disabled:opacity-40 ${!isLast ? "border-b border-border" : ""} ${selected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${selected ? "bg-primary border-primary" : "border-border"}`}>
                    {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-violet-600 font-medium">{item.flavour}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected items chips + save button */}
          {selections.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {selections.map((s, idx) => {
                  const label = s.type === "menu_item"
                    ? `${s.name}${s.selected_flavour ? ` · ${s.selected_flavour}` : ""}`
                    : `${s.name} · ${s.flavour}`;
                  return (
                    <span key={idx} className="inline-flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-medium">
                      {label}
                      <button onClick={() => removeSelection(s)} className="text-primary/50 hover:text-primary ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <button
                onClick={saveSelections}
                disabled={savingSelections}
                className="w-full bg-primary text-primary-foreground font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSelections && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Selections
              </button>
            </div>
          )}
        </section>
      )}

      {/* Slot selector — for custom entry */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        {slots.map((slot) => {
          const isActive = activeSlot === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => setActiveSlot(slot.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${
                isActive ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <slot.icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{slot.id}</span>
            </button>
          );
        })}
      </div>

      {/* Custom entry */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Custom Entry</h2>
        <div className="space-y-3">
          <input
            type="text"
            value={foodItem}
            onChange={(e) => setFoodItem(e.target.value)}
            placeholder="What did you eat?"
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={customKcal}
              onChange={(e) => setCustomKcal(e.target.value)}
              placeholder="Calories (optional)"
              className="w-full bg-card border border-border rounded-lg px-4 py-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kcal</span>
          </div>
          <button
            onClick={handleSave}
            disabled={!foodItem.trim() || createLog.isPending}
            className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createLog.isPending ? "Saving..." : "Save Custom Meal"}
          </button>
        </div>
      </section>
    </motion.div>
  );
}
