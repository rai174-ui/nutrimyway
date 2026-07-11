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
  const [aiEstimated, setAiEstimated] = useState(false);

  const [checkinOptions, setCheckinOptions] = useState<CheckinOptions | null>(null);
  const [selections, setSelections] = useState<SelectionItem[]>([]);
  const [pendingFlavourFor, setPendingFlavourFor] = useState<{ item: CenterMenuItem } | null>(null);
  const [savingSelections, setSavingSelections] = useState(false);
  const [flavourOnly, setFlavourOnly] = useState(false);

  // AI scan state
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("permission");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null);

  const consentKey = `aiScanConsented_${MEMBER_ID}`;

  useEffect(() => {
    if (!MEMBER_ID) return;
    apiFetch(`/members/${MEMBER_ID}/checkin-options`)
      .then(r => r.json())
      .then((data: CheckinOptions) => {
        setCheckinOptions(data);
        setSelections(data.selections ?? []);
      })
      .catch(() => {});

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
          setAiEstimated(false);
          setPendingPhoto(null);
        },
        onError: () => {
          setPendingPhoto(null);
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
      const res = await apiFetch(`/members/${MEMBER_ID}/checkin/selections`, {
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
      const data = await res.json() as { food_item?: string; calories_kcal?: number | null; protein_g?: number | null; error?: string };
      if (!res.ok || data.error) {
        toast({ title: data.error ?? "Could not identify food", variant: "destructive", duration: 6000 });
        return;
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
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
      const data = await res.json() as { food_item?: string; calories_kcal?: number | null; protein_g?: number | null; error?: string };
      if (!res.ok || data.error) {
        setPendingPhoto(null);
        toast({ title: data.error ?? "Could not identify food", variant: "destructive", duration: 6000 });
        return;
      }
      setFoodItem(data.food_item ?? "");
      setCustomKcal(data.calories_kcal != null ? String(Math.round(data.calories_kcal)) : "");
      setCustomProtein(data.protein_g != null ? String(Math.round(data.protein_g)) : "");
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

  const checkin = checkinOptions?.checkin ?? null;
  const allMenuItems = checkinOptions?.menuItems ?? [];
  const directFlavours = checkinOptions?.directFlavours ?? [];
  const visibleMenuItems = flavourOnly ? [] : allMenuItems;
  const hasItems = allMenuItems.length + directFlavours.length > 0;
  const hasFlavourItems = directFlavours.length > 0;
  const totalCount = visibleMenuItems.length + directFlavours.length;

  return (
    <>
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
              <div className="flex items-center gap-2">
                {hasFlavourItems && (
                  <button
                    onClick={() => setFlavourOnly(v => !v)}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      flavourOnly
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-background text-muted-foreground border-border hover:border-violet-400 hover:text-violet-600"
                    }`}
                    title="Show only flavoured items from open batches"
                  >
                    <Flame className="w-3 h-3" />
                    Flavour only
                  </button>
                )}
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                  selections.length === 3
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {selections.length} / 3
                </span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-[12px] overflow-hidden">
              {visibleMenuItems.map((item, i) => {
                const selected = isMenuItemSelected(item.id);
                const isPendingFlavour = pendingFlavourFor?.item.id === item.id;
                const flavourList = (item.flavours ?? "").split(",").map(f => f.trim()).filter(Boolean);
                const selEntry = selections.find(s => s.type === "menu_item" && s.menu_item_id === item.id) as (Extract<SelectionItem, { type: "menu_item" }>) | undefined;
                const totalKcal = item.bom.reduce((s, b) => s + (b.kcal ?? 0), 0);
                const hasKcal = item.bom.some(b => b.kcal != null);
                const isLast = i === totalCount - 1 && directFlavours.length === 0;
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

              {directFlavours.map((item, i) => {
                const selected = isDirectFlavourSelected(item.id);
                const isLast = visibleMenuItems.length + i === totalCount - 1;
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

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customKcal}
                  onChange={(e) => setCustomKcal(e.target.value)}
                  placeholder="Calories"
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">kcal</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={customProtein}
                  onChange={(e) => setCustomProtein(e.target.value)}
                  placeholder="Protein"
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-0"
            onClick={(e) => { if (e.target === e.currentTarget) setShowWizard(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-card w-full max-w-lg rounded-t-[20px] p-6 space-y-5 shadow-xl"
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
