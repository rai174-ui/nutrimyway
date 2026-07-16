import { useEffect, useState, useCallback } from "react";
import { 
  Loader2, XCircle, AlertTriangle, UserCheck, Flame, 
  RotateCcw, ShieldCheck 
} from "lucide-react";
import { Nav } from "@/components/nav";
import {
  apiGet, apiPost, getAdminCenter,
  type CenterMember, type CenterSettings
} from "@/lib/api";

interface MenuCategory {
  id: number;
  name: string;
  display_order: number;
  is_mandatory: boolean;
  ingredients: {
    ingredient_id: number;
    name: string;
    flavour: string | null;
  }[];
}

interface IngredientSelection {
  category_id: number | null;
  ingredient_id: number;
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function VisitPanel({
  member, centerId, autoCheckoutMin, onCheckout,
}: {
  member: CenterMember;
  centerId: string;
  autoCheckoutMin: number;
  onCheckout: () => void;
}) {
  const checkinId = member.checkin_id!;
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [selections, setSelections] = useState<IngredientSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"checkout" | "cancel" | null>(null);
  const [, forceUpdate] = useState(0);

  // Refresh time display every minute
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const data = await apiGet<{ categories: MenuCategory[], selections: IngredientSelection[] }>(`/admin/checkins/${checkinId}/menu`);
      
      const cats = data.categories;
      let sels = data.selections;

      // Auto-select single-item groups not already selected
      let needsSave = false;
      for (const cat of cats) {
        if (cat.ingredients.length === 1) {
          const ingId = cat.ingredients[0].ingredient_id;
          if (!sels.some(s => s.category_id === cat.id && s.ingredient_id === ingId)) {
            // Remove any other selection in this category just in case
            sels = sels.filter(s => s.category_id !== cat.id);
            sels.push({ category_id: cat.id, ingredient_id: ingId });
            needsSave = true;
          }
        }
      }

      setMenuCategories(cats);
      setSelections(sels);
      
      if (needsSave) {
        // Save the auto-selections silently in the background
        apiPost(`/admin/checkins/${checkinId}/selections`, { items: sels }).catch(() => {});
      }
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [centerId, checkinId]);

  useEffect(() => { void loadData(); }, [loadData]);

  function isIngredientSelected(categoryId: number, ingredientId: number) {
    return selections.some(s => s.category_id === categoryId && s.ingredient_id === ingredientId);
  }

  async function handleIngredientSelect(categoryId: number, ingredientId: number, isMandatory: boolean) {
    setBusy(true); setError(null);
    let newSels = [...selections];
    
    if (isIngredientSelected(categoryId, ingredientId)) {
      if (!isMandatory) {
        newSels = newSels.filter(s => !(s.category_id === categoryId && s.ingredient_id === ingredientId));
      } else {
        setBusy(false);
        return; // mandatory category, can't deselect the only option
      }
    } else {
      const filtered = newSels.filter(s => s.category_id !== categoryId);
      newSels = [...filtered, { category_id: categoryId, ingredient_id: ingredientId }];
    }
    
    setSelections(newSels);

    try {
      await apiPost(`/admin/checkins/${checkinId}/selections`, { items: newSels });
    } catch (e) { 
      setError((e as Error).message);
      // Revert on error
      void loadData();
    } finally { 
      setBusy(false); 
    }
  }

  async function handleCheckout() {
    setCheckingOut(true); setError(null);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/checkout`, {});
      onCheckout();
    } catch (e) { setError((e as Error).message); }
    finally { setCheckingOut(false); }
  }

  async function handleCancelCheckin() {
    setCheckingOut(true); setError(null);
    try {
      await apiPost(`/admin/centers/${centerId}/members/${member.id}/cancel-checkin`, {});
      onCheckout();
    } catch (e) { setError((e as Error).message); }
    finally { setCheckingOut(false); }
  }

  const mins = minutesSince(member.checked_in_at!);
  const remaining = autoCheckoutMin - mins;

  const selectionCount = selections.length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading visit options…
      </div>
    );
  }

  return (
    <div className="border-t border-border/50 bg-muted/20 px-5 py-4 space-y-4">
      {/* Already-consumed-today notice */}
      {member.already_consumed_today && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <span className="font-semibold">Repeat visit today.</span> This member has already visited today — items can still be selected and logged below.
          </p>
        </div>
      )}
      {/* Time bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${mins >= autoCheckoutMin ? "bg-red-500" : mins >= autoCheckoutMin * 0.83 ? "bg-amber-400" : "bg-emerald-400"}`}
            style={{ width: `${Math.min(100, (mins / autoCheckoutMin) * 100)}%` }}
          />
        </div>
        <span className={`text-xs font-medium tabular-nums flex-shrink-0 ${remaining <= 0 ? "text-red-500" : remaining <= 30 ? "text-amber-600" : "text-muted-foreground"}`}>
          {remaining <= 0
            ? "Auto-checkout overdue"
            : remaining <= 30
            ? `Auto-checkout in ${remaining} min`
            : `${mins} min of ${autoCheckoutMin} min`}
        </span>
      </div>

      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

      {/* Items — compact list matching log.tsx */}
      {menuCategories.length === 0 ? (
        <p className="text-xs text-muted-foreground">No check-in categories available at this center.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
          {menuCategories.map(cat => {
            const isSingle = cat.ingredients.length === 1;
            const sel = selections.find(s => s.category_id === cat.id);
            const selectedIng = sel ? cat.ingredients.find(i => i.ingredient_id === sel.ingredient_id) : null;

            return (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-2 min-h-[40px]">
                {/* Category label */}
                <div className="w-20 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-tight line-clamp-2">{cat.name}</span>
                  {cat.is_mandatory && <span className="block text-[8px] text-amber-600 font-semibold">Required</span>}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {isSingle ? (
                    <span className="text-xs font-medium text-foreground">
                      {cat.ingredients[0].name}
                      {cat.ingredients[0].flavour && cat.ingredients[0].flavour !== cat.ingredients[0].name && (
                        <span className="text-muted-foreground font-normal"> · {cat.ingredients[0].flavour}</span>
                      )}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {cat.ingredients.map(ing => {
                        const isSelected = isIngredientSelected(cat.id, ing.ingredient_id);
                        return (
                          <button
                            key={ing.ingredient_id}
                            disabled={busy}
                            onClick={() => handleIngredientSelect(cat.id, ing.ingredient_id, cat.is_mandatory)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all disabled:opacity-50 ${
                              isSelected
                                ? "bg-violet-100 text-violet-800 border-violet-300"
                                : "bg-muted/50 text-muted-foreground border-border hover:border-violet-400 hover:text-violet-700"
                            }`}
                          >
                            {ing.flavour ?? ing.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right badge / action */}
                <div className="shrink-0 flex items-center gap-1.5">
                  {isSingle && (
                    <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">Auto</span>
                  )}
                  {!isSingle && selectedIng && (
                    <button
                      onClick={() => handleIngredientSelect(cat.id, selectedIng.ingredient_id, cat.is_mandatory)}
                      disabled={busy}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                      title="Remove"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout footer */}
      <div className="pt-2 border-t border-border/50 space-y-2">
        {/* Confirmation prompt */}
        {pendingAction && (
          <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${
            pendingAction === "cancel"
              ? "bg-red-50 border-red-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <p className={`text-xs font-medium flex-1 ${pendingAction === "cancel" ? "text-red-800" : "text-amber-800"}`}>
              {pendingAction === "cancel"
                ? `Cancel ${member.name}'s check-in? No consumption will be recorded.`
                : selectionCount > 0
                  ? `Check out ${member.name} and log ${selectionCount} item${selectionCount !== 1 ? "s" : ""}?`
                  : `Check out ${member.name}? No items are selected — nothing will be logged.`}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPendingAction(null)}
                disabled={checkingOut}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Go back
              </button>
              <button
                onClick={() => {
                  if (pendingAction === "cancel") void handleCancelCheckin();
                  else void handleCheckout();
                  setPendingAction(null);
                }}
                disabled={checkingOut}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-colors ${
                  pendingAction === "cancel"
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {pendingAction === "cancel" ? "Yes, Cancel Check-in" : "Yes, Check Out"}
              </button>
            </div>
          </div>
        )}
        {!pendingAction && (
          <div className="flex items-center gap-2 justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              {selectionCount} item{selectionCount !== 1 ? "s" : ""} will be logged at checkout
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setPendingAction("cancel")}
                disabled={checkingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Check-in
              </button>
              <button
                onClick={() => setPendingAction("checkout")}
                disabled={checkingOut}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-sm hover:shadow disabled:opacity-50 transition-all"
              >
                <Flame className="w-3.5 h-3.5" /> Check Out & Book
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckinsPage() {
  const center = getAdminCenter();
  const [members, setMembers] = useState<CenterMember[]>([]);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!center) return;
    try {
      const [mems, sets] = await Promise.all([
        apiGet<CenterMember[]>(`/admin/centers/${center.id}/members`),
        apiGet<CenterSettings>(`/admin/centers/${center.id}/settings`)
      ]);
      setMembers(mems);
      setSettings(sets);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [center]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const checkedIn = members.filter(m => m.checked_in_at && !m.checked_out_at);

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Currently Checked In</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage active check-ins and log consumption.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground/30" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-bold text-emerald-800">Currently Checked In ({checkedIn.length})</h2>
              </div>
              {settings && (
                <p className="text-[11px] text-emerald-700 font-medium">
                  Auto-checkout at {settings.auto_checkout_min} min · select items below each member
                </p>
              )}
            </div>

            {checkedIn.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-muted/20 border border-border rounded-xl">
                <UserCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No members currently checked in</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Members checked in via app will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {checkedIn.map(m => (
                  <div key={m.id} className="bg-card border border-emerald-100 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow">
                    <div className="p-4 flex items-center justify-between gap-4">
                      {/* Left: Avatar & Name */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                          {m.name.split(" ").map(p => p[0]).join("").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                            {m.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px]">
                            <span className="text-muted-foreground font-medium">ID #{m.id}</span>
                            {m.membership_no && <span className="text-muted-foreground">{m.membership_no}</span>}
                            
                            {m.member_type !== 'virtual' && (
                              <span className="text-muted-foreground flex items-center gap-1">
                                <RotateCcw className="w-3 h-3" />
                                {m.checkins_used} / {m.effective_checkin_cap} check-ins
                              </span>
                            )}
                            
                            {m.daily_kcal && (
                              <span className="font-medium text-amber-600 flex items-center gap-0.5 bg-amber-50 px-1.5 py-0.5 rounded">
                                <Flame className="w-3 h-3" /> {m.daily_kcal} kcal
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <VisitPanel 
                      member={m} 
                      centerId={center!.id} 
                      autoCheckoutMin={settings?.auto_checkout_min ?? 180} 
                      onCheckout={loadMembers} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
