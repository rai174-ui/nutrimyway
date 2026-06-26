import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Sunrise, Sun, Apple, Moon } from "lucide-react";
import { useGetBomItems, getGetBomItemsQueryKey, useCreateConsumptionLog, useGetDailySummary, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";

const TODAY = new Date().toISOString().split('T')[0];

const slots = [
  { id: "Breakfast", icon: Sunrise },
  { id: "Lunch", icon: Sun },
  { id: "Snack", icon: Apple },
  { id: "Dinner", icon: Moon },
];

export function Log() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { memberId: MEMBER_ID } = useAuth();
  const [activeSlot, setActiveSlot] = useState("Breakfast");
  const [foodItem, setFoodItem] = useState("");

  const { data: bomItems } = useGetBomItems({}, {
    query: { queryKey: getGetBomItemsQueryKey({}) }
  });

  const createLog = useCreateConsumptionLog();

  const handleSave = () => {
    if (!foodItem.trim()) return;

    createLog.mutate(
      {
        memberId: MEMBER_ID,
        data: {
          meal_slot: activeSlot,
          food_item: foodItem,
          calories_kcal: 250, // dummy value for custom text
          protein_g: 10,
          carbs_g: 30,
          fat_g: 5
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID, { date: TODAY }) });
          toast({ title: "Meal logged successfully!" });
          setLocation("/dashboard");
        }
      }
    );
  };

  const selectBom = (item: any) => {
    createLog.mutate(
      {
        memberId: MEMBER_ID,
        data: {
          meal_slot: activeSlot,
          food_item: item.food_item,
          quantity_g: item.quantity_g,
          calories_kcal: item.calories_kcal,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID, { date: TODAY }) });
          toast({ title: "Plan item logged!" });
          setLocation("/dashboard");
        }
      }
    );
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Log Meal</h1>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">From your plan</h2>
        <div className="bg-card border border-border rounded-[12px] overflow-hidden">
          {bomItems?.map((item, i) => (
            <button
              key={item.id}
              onClick={() => selectBom(item)}
              className={`w-full text-left px-4 py-3 flex justify-between items-center hover:bg-muted/50 transition-colors ${
                i !== bomItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div>
                <p className="font-medium text-sm">{item.food_item}</p>
                <p className="text-xs text-muted-foreground">{item.quantity_g}g</p>
              </div>
              <span className="text-sm font-semibold text-primary">{item.calories_kcal?.toFixed(0)} kcal</span>
            </button>
          ))}
          {(!bomItems || bomItems.length === 0) && (
            <p className="p-4 text-sm text-muted-foreground text-center">No plan items available</p>
          )}
        </div>
      </section>

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
