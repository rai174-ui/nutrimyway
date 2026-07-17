import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sunrise, Sun, Apple, Moon, MapPin, Check, Loader2, X, Camera, Sparkles, Search, UtensilsCrossed, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
  fiber_g: number | null;
  water_ml: number | null;
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
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const fetchLogs = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const [logRes, sumRes] = await Promise.all([
        apiFetch(`/members/${memberId}/consumption?date=${date}`),
        apiFetch(`/members/${memberId}/summary?date=${date}`)
      ]);
      const data = await logRes.json() as MealLog[];
      const sumData = await sumRes.json();
      setLogs(Array.isArray(data) ? data : []);
      setSummary(sumData);
    } catch {
      setLogs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  async function deleteLog(logId: number) {
    if (!window.confirm("Are you sure you want to delete this meal?")) return;
    try {
      const res = await apiFetch(`/members/${memberId}/consumption/${logId}`, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(memberId, { date: selectedDate }) });
        await fetchLogs(selectedDate);
      }
    } catch (e) {
      console.error("Failed to delete log", e);
    }
  }

  useEffect(() => { void fetchLogs(selectedDate); }, [selectedDate, fetchLogs]);

  function shiftDate(delta: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toLocaleDateString("en-CA"));
  }

  // Include all meals (both center and outside)
  const allLogs = logs;

  const filtered = allLogs.filter(l =>
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
  const totalFiber = filtered.reduce((sum, l) => sum + (l.fiber_g ?? 0), 0);

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
          <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-2 text-center">
            <p className="text-[9px] text-orange-500 font-bold uppercase">Kcal</p>
            <p className="text-sm font-bold text-orange-700">{Math.round(totalKcal)}</p>
          </div>
          <div className="flex-1 bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
            <p className="text-[9px] text-blue-500 font-bold uppercase">Pro</p>
            <p className="text-sm font-bold text-blue-700">{totalProtein.toFixed(1)}<span className="text-[10px] font-normal">g</span></p>
          </div>
          <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-2 text-center">
            <p className="text-[9px] text-green-500 font-bold uppercase">Fib</p>
            <p className="text-sm font-bold text-green-700">{totalFiber.toFixed(1)}<span className="text-[10px] font-normal">g</span></p>
          </div>
          <div className="flex-1 bg-cyan-50 border border-cyan-100 rounded-lg p-2 text-center">
            <p className="text-[9px] text-cyan-500 font-bold uppercase">Water</p>
            <p className="text-sm font-bold text-cyan-700">{summary?.water_logged_ml > 0 ? (summary.water_logged_ml/1000).toFixed(1) + 'L' : '—'}</p>
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
            {allLogs.length === 0
              ? "No outside meals logged for this date"
              : "No meals match your search"}
          </p>
          {allLogs.length === 0 && isToday && (
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
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div className="text-right">
                        {log.calories_kcal != null && (
                          <p className="text-xs font-semibold text-foreground">{Math.round(log.calories_kcal)} kcal</p>
                        )}
                        {(log.protein_g != null || log.fiber_g != null) && (
                          <p className="text-[10px] text-muted-foreground">
                            {log.protein_g != null ? `${log.protein_g.toFixed(1)}g Pro` : ''}
                            {log.protein_g != null && log.fiber_g != null ? ' · ' : ''}
                            {log.fiber_g != null ? `${log.fiber_g.toFixed(1)}g Fib` : ''}
                          </p>
                        )}
                      </div>
                      <button onClick={() => deleteLog(log.id)} className="text-muted-foreground hover:text-red-500 transition-colors p-1" aria-label="Delete log">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
  const [isSaving, setIsSaving] = useState(false);

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

  // Gemini API key / wizard state
  const consentKey = MEMBER_ID ? `gemini_consent_${MEMBER_ID}` : "gemini_consent";
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);

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
        // Seed selections from server
        const existing = data.selections ?? [];
        const existingCatIds = new Set(existing.map(s => s.category_id));
        // Auto-add single-ingredient categories that aren't already selected
        const autoAdded = (data.categories as CheckinCategory[])
          .filter(cat => cat.ingredients.length === 1 && !existingCatIds.has(cat.id))
          .map(cat => ({ category_id: cat.id, ingredient_id: cat.ingredients[0].ingredient_id }));
        const allSelections = [...existing, ...autoAdded];
        setSelections(allSelections);
        // Persist auto-added items immediately so checkout logs them correctly
        if (autoAdded.length > 0) {
          apiFetch(`/members/${MEMBER_ID}/checkin/selections`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: allSelections }),
          }).catch(() => { /* non-blocking, best-effort */ });
        }
      })
      .catch(() => {
        setCheckinMenu({ categories: [], selections: [], error: "Failed to load check-in menu" });
      });
  }, [MEMBER_ID]);

  const createLog = useCreateConsumptionLog();

  const handleSave = async () => {
    if (!foodItem.trim() || !MEMBER_ID) return;
    setIsSaving(true);
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
            const controller = new AbortController();
            const putRes = await Promise.race([
              fetch(uploadURL, { 
                method: "PUT", 
                body: pendingPhoto, 
                headers: { "Content-Type": pendingPhoto.type },
                signal: controller.signal
              }),
              new Promise<Response>((_, reject) => 
                setTimeout(() => {
                  controller.abort();
                  reject(new Error("Photo upload timed out"));
                }, 10000)
              )
            ]);
            if (putRes.ok) {
            photoUrl = objectPath;
          }
        }
      } catch {
        // non-blocking: log without photo if upload fails
      }
    }
    let loggedAtStr = new Date().toISOString();

    try {
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
            logged_at: loggedAtStr,
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
          setIsSaving(false);
        },
        onError: () => {
          setPendingPhoto(null);
          if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); setPhotoPreviewUrl(null); }
          setIsSaving(false);
        }
      }
    );
    } catch (e) {
      setIsSaving(false);
      console.error(e);
    }
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
          <>
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
              <>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border/60">
                {checkinMenu.categories.map(cat => {
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
                                  onClick={() => handleIngredientSelect(cat.id, ing.ingredient_id, cat.is_mandatory)}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
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
                            className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive transition-colors"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={saveSelections}
                disabled={savingSelections}
                className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-sm hover:bg-primary/90 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {savingSelections ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirm Selection
              </button>
              </>
            )}

          </div>

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
                  <label className="absolute left-3 top-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider pointer-events-none">
                    Calorie
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg pl-3 pr-8 pt-5 pb-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-2.5 top-[60%] -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">kcal</span>
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider pointer-events-none">
                    Protein
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customProtein}
                    onChange={(e) => setCustomProtein(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg pl-3 pr-6 pt-5 pb-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-2.5 top-[60%] -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">g</span>
                </div>
                <div className="relative">
                  <label className="absolute left-3 top-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider pointer-events-none">
                    Fiber
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={customFiber}
                    onChange={(e) => setCustomFiber(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg pl-3 pr-6 pt-5 pb-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <span className="absolute right-2.5 top-[60%] -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">g</span>
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
                disabled={!foodItem.trim() || createLog.isPending || isSaving || aiLoading}
                className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLog.isPending || isSaving ? "Saving..." : "Save Meal"}
              </button>
            </div>
          </section>
          </>
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
