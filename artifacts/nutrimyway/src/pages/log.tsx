import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sunrise, Sun, Apple, Moon, MapPin } from "lucide-react";
import { useCreateConsumptionLog, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const TODAY = new Date().toISOString().split('T')[0];
const BASE = "/api";

const slots = [
  { id: "Breakfast", icon: Sunrise },
  { id: "Lunch", icon: Sun },
  { id: "Snack", icon: Apple },
  { id: "Dinner", icon: Moon },
];

interface ActiveCheckin {
  id: number;
  center_id: string;
  center_name: string;
  checked_in_at: string;
}

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
  bom: BomComponent[];
}

export function Log() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { memberId: MEMBER_ID } = useAuth();
  const [activeSlot, setActiveSlot] = useState("Breakfast");
  const [foodItem, setFoodItem] = useState("");
  const [checkin, setCheckin] = useState<ActiveCheckin | null>(null);
  const [centerMenu, setCenterMenu] = useState<CenterMenuItem[]>([]);

  useEffect(() => {
    if (!MEMBER_ID) return;
    fetch(`${BASE}/members/${MEMBER_ID}/checkin/active`)
      .then(r => r.json())
      .then(async (data: ActiveCheckin | null) => {
        setCheckin(data);
        if (data) {
          const menu = await fetch(`${BASE}/members/${MEMBER_ID}/center-menu`).then(r => r.json());
          setCenterMenu(menu as CenterMenuItem[]);
        }
      })
      .catch(() => {});
  }, [MEMBER_ID]);

  const createLog = useCreateConsumptionLog();

  const handleSave = () => {
    if (!foodItem.trim()) return;
    createLog.mutate(
      {
        memberId: MEMBER_ID!,
        data: {
          meal_slot: activeSlot,
          food_item: foodItem,
          calories_kcal: 250,
          protein_g: 10,
          carbs_g: 30,
          fat_g: 5,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) });
          toast({ title: "Meal logged successfully!" });
          setLocation("/dashboard");
        }
      }
    );
  };

  const selectMenuItem = (item: CenterMenuItem) => {
    const totalKcal = item.bom.reduce((s, b) => s + (b.kcal ?? 0), 0);
    const hasKcal = item.bom.some(b => b.kcal != null);
    createLog.mutate(
      {
        memberId: MEMBER_ID!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          meal_slot: activeSlot,
          food_item: item.name,
          menu_item_id: item.id,
          calories_kcal: hasKcal ? totalKcal : null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
        } as any
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) });
          toast({ title: "Set menu item logged!" });
          setLocation("/dashboard");
        }
      }
    );
  };

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

      {/* Slot selector */}
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

      {/* Center set menu — shown only when checked in */}
      {checkin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {checkin.center_name} Set Menu
          </h2>
          <div className="bg-card border border-border rounded-[12px] overflow-hidden">
            {centerMenu.length > 0 ? centerMenu.map((item, i) => (
              <button
                key={item.id}
                onClick={() => selectMenuItem(item)}
                disabled={createLog.isPending}
                className={`w-full text-left px-4 py-3 flex justify-between items-start hover:bg-muted/50 transition-colors disabled:opacity-50 ${
                  i !== centerMenu.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  {item.bom.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.bom.map(b => `${b.ingredient} ${b.quantity}${b.unit}`).join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 ml-3 flex-shrink-0">
                  {(() => {
                    const totalKcal = item.bom.reduce((s, b) => s + (b.kcal ?? 0), 0);
                    const hasKcal = item.bom.some(b => b.kcal != null);
                    return hasKcal ? (
                      <span className="text-xs font-semibold text-amber-600">{Math.round(totalKcal)} kcal</span>
                    ) : null;
                  })()}
                  <span className="text-xs text-muted-foreground">{item.bom.length} ing.</span>
                </div>
              </button>
            )) : (
              <p className="p-4 text-sm text-muted-foreground text-center">No menu items at this center yet</p>
            )}
          </div>
        </section>
      )}

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
