import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sunrise, Sun, Apple, Moon, MapPin, Check, Loader2, X, Camera, Sparkles, Search, CalendarDays, UtensilsCrossed, ChevronLeft, ChevronRight } from "lucide-react";
import { useCreateConsumptionLog, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { native, snapPhoto } from "@/lib/capacitor";
import { apiFetch } from "@/lib/api-base";
import { format, parseISO, isValid } from "date-fns";

function todayLocal() { return new Date().toLocaleDateString("en-CA"); }

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
  error?: string;
}

// Wizard states
type WizardStep = "permission" | "setup-1" | "setup-2" | "setup-3";

interface MealLog {
  id: number;
  meal_slot: string;
  food_item: string;
  calories_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  checkin_id: number | null;
  selected_flavour: string | null;
  photo_url: string | null;
}

function safeFormat(val: string | null | undefined, fmt: string, fallback = "--"): string {
  if (!val) return fallback;
  try { const d = parseISO(val); return isValid(d) ? format(d, fmt) : fallback; } catch { return fallback; }
}

// ── Meal History Tab ──────────────────────────────────────────────────────────
function MealHistory({ memberId }: { memberId: number }) {
  const [selectedDate, setSelectedDate] = useState(todayLocal());
  const [search, setSearch] = useState("");
  const [logs, setLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/members/${memberId}/consumption?date=${date}`);
      const data = await res.json() as MealLog[];
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { void fetchLogs(selectedDate); }, [selectedDate, fetchLogs]);

  function shiftDate(delta: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toLocaleDateString("en-CA"));
  }

  // Filter: exclude center check-in logs (they have a checkin_id), only show outside/custom meals
  const outsideLogs = logs.filter(l => l.checkin_id === null);

  const filtered = outsideLogs.filter(l =>
    !search.trim() ||
    l.food_item.toLowerCase().includes(search.trim().toLowerCase()) ||
    (l.meal_slot ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const grouped: Record<string, MealLog[]> = {};
  for (const log of filtered) {
    const slot = log.meal_slot ?? "Other";
    if (!grouped[slot]) grouped[slot] = [];
    grouped[slot].push(log);
  }

  const slotOrder = ["Breakfast", "Lunch", "Snack", "Dinner", "Other"];
  const sortedSlots = Object.keys(grouped).sort(
    (a, b) => slotOrder.indexOf(a) - slotOrder.indexOf(b)
  );

  const totalKcal = filtered.reduce((sum, l) => sum + (l.calories_kcal ?? 0), 0);
  const totalProtein = filtered.reduce((sum, l) => sum + (l.protein_g ?? 0), 0);

  const isToday = selectedDate === todayLocal();

  return (
    <div className="space-y-4">
      {/* Date Navigator */}
      <div className="bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => shiftDate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <input
              type="date"
              value={selectedDate}
              max={todayLocal()}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={() => shiftDate(1)}
            disabled={isToday}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search meals..."
            className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex gap-2">
          <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-orange-500 font-bold uppercase">Calories</p>
            <p className="text-sm font-bold text-orange-700">{Math.round(totalKcal)} <span className="text-[10px] font-normal">kcal</span></p>
          </div>
          <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-blue-500 font-bold uppercase">Protein</p>
            <p className="text-sm font-bold text-blue-700">{totalProtein.toFixed(1)} <span className="text-[10px] font-normal">g</span></p>
          </div>
          <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
            <p className="text-[10px] text-emerald-500 font-bold uppercase">Items</p>
            <p className="text-sm font-bold text-emerald-700">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Meal List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <UtensilsCrossed className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {outsideLogs.length === 0
              ? "No outside meals logged for this date"
              : "No meals match your search"}
          </p>
          {outsideLogs.length === 0 && isToday && (
            <p className="text-xs text-muted-foreground/60">Use the Log tab to add a meal</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedSlots.map(slot => (
            <div key={slot} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 border-b border-border/60">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{slot}</h3>
              </div>
              <div className="divide-y divide-border/40">
                {grouped[slot].map(log => (
                  <div key={log.id} className="px-3 py-2.5 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{log.food_item}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {safeFormat(log.logged_at, "h:mm a")}
                        {log.selected_flavour && <span className="ml-1 text-primary/70">· {log.selected_flavour}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {log.calories_kcal != null && (
                        <p className="text-xs font-semibold text-foreground">{Math.round(log.calories_kcal)} kcal</p>
                      )}
                      {log.protein_g != null && (
                        <p className="text-[10px] text-muted-foreground">{log.protein_g.toFixed(1)}g protein</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Log() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { memberId: MEMBER_ID } = useAuth();
  const [activeTab, setActiveTab] = useState<"log" | "history">("log");
  const [activeSlot, setActiveSlot] = useState(autoSlot);
  const [foodItem, setFoodItem] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customFiber, setCustomFiber] = useState("");
  const [aiEstimated, setAiEstimated] = useState(false);

  const [checkinMenu, setCheckinMenu] = useState<CheckinMenuResponse | null>(null);
  const [selections, setSelections] = useState<{ category_id: number; ingredient_id: number }[]>([]);
  const [savingSelections, setSavingSelections] = useState(false);

  // AI scan state
  const [aiLoading, setAiLoading] = useState(false);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!MEMBER_ID) return;
    apiFetch(`/members/${MEMBER_ID}/checkin-menu`)
      .then(r => r.json())
      .then((data: CheckinMenuResponse & { error?: string }) => {
        if (data.error) {
          setCheckinMenu({ categories: [], selections: [], error: data.error });
          return;
        }
        setCheckinMenu(data);
        setSelections(data.selections ?? []);
      })
      .catch(() => {
        setCheckinMenu({ categories: [], selections: [], error: "Failed to load check-in menu" });
      });
  }, [MEMBER_ID]);

  const createLog = useCreateConsumptionLog();

  const handleSave = async () => {
    if (!foodItem.trim()) return;
    const kcal = customKcal !== "" ? Number(customKcal) : null;
    const protein = customProtein !== "" ? Number(customProtein) : null;
    const fiber = customFiber !== "" ? Number(customFiber) : null;
    let photoUrl: string | null = null;
    if (pendingPhoto) {
      try {
        const urlRes = await apiFetch(`/storage/uploads/request-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pendingPhoto.name, size: pendingPhoto.size, contentType: pendingPhoto.type }),
        });
        if (urlRes.ok) {
          const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };
          const putRes = await fetch(uploadURL, { method: "PUT", body: pendingPhoto, headers: { "Content-Type": pendingPhoto.type } });
          if (putRes.ok) {
            photoUrl = objectPath;
          }
        }
      } catch {
        // non-blocking: log without photo if upload fails
      }
    }
    createLog.mutate(
      {
        memberId: MEMBER_ID!,
        data: {
          meal_slot: activeSlot,
          food_item: foodItem,
          calories_kcal: kcal,
          protein_g: protein,
          fiber_g: fiber,
          carbs_g: null,
          fat_g: null,
          photo_url: photoUrl,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: todayLocal() }) });
          toast({ title: "Meal logged!" });
          setFoodItem("");
          setCustomKcal("");
          setCustomProtein("");
          setCustomFiber("");
          setAiEstimated(false);
          setPendingPhoto(null);
          if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); }
        },
        onError: () => {
          setPendingPhoto(null);
          if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); }
        }
      }
    );
  };

  function isIngredientSelected(categoryId: number, ingredientId: number) {
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

  function handleCameraClick() {
    // Camera opens immediately — no wizard, no key check required.
    // Server uses its own GEMINI_API_KEY; member key is an optional override.
    if (native()) {
      void handleNativeCamera();
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleNativeCamera() {
    if (!MEMBER_ID) return;
    setAiLoading(true);
    try {
      const base64 = await snapPhoto();
      if (!base64) { setAiLoading(false); return; }

      // Photo-first: create a Blob/File from base64 so we can show a thumbnail
      // and attach it to the meal log even if AI fails.
      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const photoFile = new File([byteArr], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
      setPendingPhoto(photoFile);
      setPhotoPreviewUrl(URL.createObjectURL(photoFile));

      const res = await apiFetch(`/members/${MEMBER_ID}/analyze-food-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, mime_type: "image/jpeg" }),
      });
      const data = await res.json() as { food_item?: string; calories_kcal?: number | null; protein_g?: number | null; fiber_g?: number | null; error?: string };
      if (!res.ok || data.error) {
        toast({ title: data.error ?? "Could not identify food — photo saved, fill in estimates", variant: "destructive", duration: 6000 });
        return; // photo stays in form
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
      setCustomFiber(data.fiber_g != null ? String(Math.round(data.fiber_g)) : "");
      setAiEstimated(true);
      toast({ title: "AI estimate ready — review and save!" });
    } catch {
      toast({ title: "Photo analysis failed — photo saved, fill in estimates manually.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !MEMBER_ID) return;
    e.target.value = "";

    // Photo-first: set photo immediately so the thumbnail appears and it
    // gets attached to the meal log even if AI analysis fails.
    setPendingPhoto(file);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(URL.createObjectURL(file));

    setAiLoading(true);
    try {
      const base64 = await compressAndEncode(file);
      const res = await apiFetch(`/members/${MEMBER_ID}/analyze-food-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, mime_type: "image/jpeg" }),
      });
      const data = await res.json() as { food_item?: string; calories_kcal?: number | null; protein_g?: number | null; fiber_g?: number | null; error?: string };
      if (!res.ok || data.error) {
        // Photo stays in the form — member can still save with manual estimates
        toast({ title: data.error ?? "Could not identify food — photo saved, fill in estimates", variant: "destructive", duration: 6000 });
        return;
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
      setCustomFiber(data.fiber_g != null ? String(Math.round(data.fiber_g)) : "");
      setAiEstimated(true);
      toast({ title: "AI estimate ready — review and save!" });
    } catch {
      toast({ title: "Photo analysis failed — photo saved, fill in estimates manually.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function compressAndEncode(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function saveApiKey() {
    if (!MEMBER_ID || !apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const res = await apiFetch(`/members/${MEMBER_ID}/gemini-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKeyInput.trim() }),
      });
      const d = await res.json() as { has_key: boolean };
      setHasGeminiKey(d.has_key);
      localStorage.setItem(consentKey, "yes");
      setShowWizard(false);
      setApiKeyInput("");
      toast({ title: "AI Food Scan activated! Tap the camera to try it." });
    } catch {
      toast({ title: "Could not save key", variant: "destructive" });
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="p-4 space-y-6">
        <header className="pt-4 pb-2">
          <h1 className="text-2xl font-bold text-foreground">Log Meal</h1>
        </header>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setActiveTab("log")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "log" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Log Meal
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
              activeTab === "history" ? "bg-card shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            History
          </button>
        </div>

        {activeTab === "history" ? (
          MEMBER_ID ? <MealHistory memberId={MEMBER_ID} /> : null
        ) : (
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
            ) : checkinMenu.error ? (
              <p className="text-sm text-amber-600 font-medium py-4 text-center bg-amber-50 rounded-xl border border-amber-100">{checkinMenu.error}</p>
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
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Custom Entry</h2>
              <button
                onClick={handleCameraClick}
                disabled={aiLoading}
                className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {aiLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
                  : <><Camera className="w-3.5 h-3.5" /> Snap &amp; Analyse</>
                }
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={foodItem}
                onChange={(e) => { setFoodItem(e.target.value); setAiEstimated(false); }}
                placeholder="What did you eat?"
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    placeholder="Calories"
                    className="w-full bg-card border border-border rounded-lg px-3 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kcal</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customProtein}
                    onChange={(e) => setCustomProtein(e.target.value)}
                    placeholder="Protein"
                    className="w-full bg-card border border-border rounded-lg px-3 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customFiber}
                    onChange={(e) => setCustomFiber(e.target.value)}
                    placeholder="Fiber"
                    className="w-full bg-card border border-border rounded-lg px-3 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">g</span>
                </div>
              </div>

              {/* Photo thumbnail preview */}
              {photoPreviewUrl && (
                <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-sm">
                  <img src={photoPreviewUrl} alt="Food photo" className="w-full max-h-48 object-cover" />
                  {aiLoading && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-7 h-7 animate-spin text-white" />
                      <span className="text-xs text-white font-medium">Analysing…</span>
                    </div>
                  )}
                  <button
                    onClick={() => { setPendingPhoto(null); URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {aiEstimated && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  AI estimate — tap any field to adjust
                </p>
              )}

              <button
                onClick={handleSave}
                disabled={!foodItem.trim() || createLog.isPending}
                className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLog.isPending ? "Saving..." : "Save Meal"}
              </button>
            </div>
          </section>
        )}
      </motion.div>

    </>
  );
}


function StepRow({ n, active, done, onClick, children }: { n: number; active?: boolean; done?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex items-start gap-3 w-full text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}
    >
      <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
        active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted-foreground/20 text-muted-foreground"
      }`}>{n}</span>
      <div className="flex-1">{children}</div>
    </button>
  );
}
