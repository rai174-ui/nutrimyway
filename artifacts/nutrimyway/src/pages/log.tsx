import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sunrise, Sun, Apple, Moon, MapPin, Check, Loader2, X, Camera, ChevronRight, ExternalLink, Sparkles, Flame } from "lucide-react";
import { useCreateConsumptionLog, getGetDailySummaryQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { native, snapPhoto } from "@/lib/capacitor";
import { apiFetch } from "@/lib/api-base";

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

export function Log() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { memberId: MEMBER_ID } = useAuth();
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
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("permission");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const consentKey = "gemini_consent_v1";
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

    apiFetch(`/members/${MEMBER_ID}/gemini-key`)
      .then(r => r.json())
      .then((d: { has_key: boolean }) => setHasGeminiKey(d.has_key))
      .catch(() => {});
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
        },
        onError: () => {
          setPendingPhoto(null);
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
    const consented = localStorage.getItem(consentKey);
    if (hasGeminiKey) {
      if (native()) {
        handleNativeCamera();
      } else {
        fileInputRef.current?.click();
      }
    } else if (consented === "yes") {
      setWizardStep("setup-1");
      setShowWizard(true);
    } else {
      setWizardStep("permission");
      setShowWizard(true);
    }
  }

  async function handleNativeCamera() {
    if (!MEMBER_ID) return;
    setAiLoading(true);
    try {
      const base64 = await snapPhoto();
      if (!base64) {
        setAiLoading(false);
        return;
      }
      const res = await apiFetch(`/members/${MEMBER_ID}/analyze-food-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, mime_type: "image/jpeg" }),
      });
      const data = await res.json() as { food_item?: string; calories_kcal?: number | null; protein_g?: number | null; fiber_g?: number | null; error?: string };
      if (!res.ok || data.error) {
        toast({ title: data.error ?? "Could not identify food", variant: "destructive", duration: 6000 });
        return;
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
      setCustomFiber(data.fiber_g != null ? String(Math.round(data.fiber_g)) : "");
      setAiEstimated(true);
      toast({ title: "AI estimate ready — review and save!" });
    } catch {
      toast({ title: "Photo analysis failed. Try again.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !MEMBER_ID) return;
    e.target.value = "";
    setPendingPhoto(file);

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
        setPendingPhoto(null);
        toast({ title: data.error ?? "Could not identify food", variant: "destructive", duration: 6000 });
        return;
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
      setCustomFiber(data.fiber_g != null ? String(Math.round(data.fiber_g)) : "");
      setAiEstimated(true);
      toast({ title: "AI estimate ready — review and save!" });
    } catch {
      setPendingPhoto(null);
      toast({ title: "Photo analysis failed. Try again.", variant: "destructive" });
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

        {/* Custom entry */}
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
      </motion.div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* AI Setup Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowWizard(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-card w-full max-w-md rounded-2xl p-6 space-y-5 shadow-xl overflow-hidden"
            >
              {/* Permission step */}
              {wizardStep === "permission" && (
                <>
                  <div className="text-center space-y-3 pt-2">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Camera className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Enable AI Food Scan?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        NutriMyWay can analyse photos of your meals to instantly estimate calories and protein. Uses Google's free Gemini AI — your photos are never stored.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <button
                      onClick={() => {
                        localStorage.setItem(consentKey, "yes");
                        setWizardStep("setup-1");
                      }}
                      className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl"
                    >
                      Enable — Set Up Free Key
                    </button>
                    <button
                      onClick={() => setShowWizard(false)}
                      className="w-full py-3 text-sm text-muted-foreground font-medium"
                    >
                      Not now
                    </button>
                  </div>
                </>
              )}

              {/* Setup step 1 */}
              {wizardStep === "setup-1" && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base">Set Up AI Food Scan</h3>
                    <button onClick={() => setShowWizard(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                    <StepRow n={1} active>
                      <p className="text-sm font-medium">Open Google AI Studio</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Sign in with your Google account (it's free)</p>
                    </StepRow>
                    <StepRow n={2} onClick={() => setWizardStep("setup-2")}>
                      <p className="text-sm font-medium text-muted-foreground">Click "Get API Key"</p>
                    </StepRow>
                    <StepRow n={3} onClick={() => setWizardStep("setup-3")}>
                      <p className="text-sm font-medium text-muted-foreground">Paste your key here</p>
                    </StepRow>
                  </div>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl"
                  >
                    Open Google AI Studio <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => setWizardStep("setup-2")}
                    className="w-full flex items-center justify-center gap-1 text-sm text-primary font-medium py-1"
                  >
                    I'm signed in — next <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Setup step 2 */}
              {wizardStep === "setup-2" && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base">Get Your API Key</h3>
                    <button onClick={() => setShowWizard(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                    <StepRow n={1} done>
                      <p className="text-sm font-medium text-muted-foreground">Open Google AI Studio ✓</p>
                    </StepRow>
                    <StepRow n={2} active>
                      <p className="text-sm font-medium">Click <span className="font-bold">"Get API Key"</span></p>
                      <p className="text-xs text-muted-foreground mt-0.5">Choose "Create API key in new project" when prompted</p>
                    </StepRow>
                    <StepRow n={3} onClick={() => setWizardStep("setup-3")}>
                      <p className="text-sm font-medium text-muted-foreground">Paste your key here</p>
                    </StepRow>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep("setup-1")} className="flex-1 border border-border rounded-xl py-3 text-sm font-medium">Back</button>
                    <button
                      onClick={() => setWizardStep("setup-3")}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold"
                    >
                      I have my key →
                    </button>
                  </div>
                </>
              )}

              {/* Setup step 3 — paste key */}
              {wizardStep === "setup-3" && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base">Paste Your Key</h3>
                    <button onClick={() => setShowWizard(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                    <StepRow n={1} done><p className="text-sm text-muted-foreground">Open Google AI Studio ✓</p></StepRow>
                    <StepRow n={2} done><p className="text-sm text-muted-foreground">Get API key ✓</p></StepRow>
                    <StepRow n={3} active>
                      <p className="text-sm font-medium">Paste your key below</p>
                    </StepRow>
                  </div>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={e => setApiKeyInput(e.target.value)}
                    placeholder="AIza…"
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setWizardStep("setup-2")} className="flex-1 border border-border rounded-xl py-3 text-sm font-medium">Back</button>
                    <button
                      onClick={saveApiKey}
                      disabled={!apiKeyInput.trim() || savingKey}
                      className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {savingKey && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save &amp; Activate
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
