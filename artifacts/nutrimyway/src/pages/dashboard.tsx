import { useState, useEffect, useRef, Fragment, type ReactNode } from "react";
import { useGetMember, getGetMemberQueryKey, useGetDailySummary, getGetDailySummaryQueryKey, useGetMemberStatus, getGetMemberStatusQueryKey } from "@workspace/api-client-react";
import { format, isValid } from "date-fns";
import { Link } from "wouter";
import { Plus, LogOut, MapPin, Camera, X, Megaphone, ChevronRight, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-base";

// Safe date formatter — never throws "Invalid time value".
// PostgreSQL timestamps may not parse correctly in some Android WebViews
// so we always validate the Date before passing it to date-fns format().
function safeFormat(value: string | null | undefined, fmt: string, fallback = "--"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? format(d, fmt) : fallback;
}

function todayLocal() { return new Date().toLocaleDateString("en-CA"); }
const TODAY = todayLocal();

interface CheckIn {
  id: number;
  member_id: number;
  center_id: string;
  center_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
}

interface Center {
  id: string;
  name: string;
}

interface Broadcast {
  id: number;
  center_id: string;
  message: string;
  sent_at: string;
  sent_by: "scheduled" | "manual";
  is_read: boolean;
}

function useActiveCheckin(memberId: number | null) {
  const [checkin, setCheckin] = useState<CheckIn | null | undefined>(undefined);

  function load() {
    if (!memberId) return;
    apiFetch(`/members/${memberId}/checkin/active`)
      .then(r => r.json())
      .then(setCheckin)
      .catch(() => setCheckin(null));
  }

  useEffect(() => { load(); }, [memberId]);
  return { checkin, reload: load };
}

function useMemberCenters(memberId: number | null) {
  const [centers, setCenters] = useState<Center[]>([]);
  useEffect(() => {
    if (!memberId) return;
    apiFetch(`/members/${memberId}/centers`)
      .then(r => r.json())
      .then(setCenters)
      .catch(() => {});
  }, [memberId]);
  return centers;
}

import { BarcodeScanner, BarcodeFormat } from "@capacitor-mlkit/barcode-scanning";

// ── QR Scanner Modal ──────────────────────────────────────────────────────────
// Uses @capacitor-mlkit/barcode-scanning (Google ML Kit native layer)
// instead of html5-qrcode (WebView JS decoder) for reliable scanning.

function QrScannerModal({ onScanned, onClose }: { onScanned: (centerId: string) => void; onClose: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  async function startScan() {
    setErr(null);
    setScanning(true);
    try {
      // Request camera permission natively
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== "granted") {
        setErr("Camera permission was not granted. Please allow camera access in your phone settings.");
        setScanning(false);
        return;
      }

      // Open the native ML Kit scanner overlay (same engine as Samsung camera)
      const result = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });

      if (result.barcodes.length > 0) {
        onScanned(result.barcodes[0].displayValue);
      } else {
        setErr("No QR code detected. Please try again.");
        setScanning(false);
      }
    } catch (e) {
      setErr("Scanner failed. Please try again or enter the code manually.");
      setScanning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-4">
      <div className="bg-card rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Scan Check-In QR</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center gap-4">
          <div className="w-40 h-40 rounded-2xl bg-muted flex items-center justify-center border-2 border-dashed border-border">
            <Camera className="w-12 h-12 text-muted-foreground" />
          </div>
          <button
            onClick={startScan}
            disabled={scanning}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {scanning ? <><span className="animate-spin">⏳</span> Opening camera…</> : <><Camera className="w-4 h-4" /> Tap to Scan QR Code</>}
          </button>
          {err && <p className="text-xs text-destructive text-center">{err}</p>}
          <p className="text-xs text-muted-foreground text-center">
            Point your camera at the QR code posted at the wellness center entrance
          </p>
        </div>

        <div className="px-4 py-3 border-t border-border flex flex-col gap-2 bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">Trouble scanning? Enter code manually:</p>
          <div className="flex gap-2">
            <input
              type="text"
              id="manual-code"
              placeholder="e.g. CI-1"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = manualCode.trim();
                  if (val) onScanned(val);
                }
              }}
            />
            <button
              onClick={() => { const val = manualCode.trim(); if (val) onScanned(val); }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              Check In
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Weight Prompt Modal ───────────────────────────────────────────────────────

function WeightPromptModal({ memberId, onDone }: { memberId: number; onDone: () => void }) {
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveWeight() {
    if (weight && Number(weight) > 0) {
      setSaving(true);
      try {
        await apiFetch(`/members/${memberId}/health-records`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weight_kg: Number(weight) }),
        });
      } catch { /* ignore */ } finally { setSaving(false); }
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-600 text-lg">✓</span>
          </div>
          <h3 className="font-semibold text-foreground">Checked In!</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5 ml-11">Record your weight for today? (optional)</p>
        <input
          type="number"
          inputMode="decimal"
          min="0" step="0.1"
          value={weight}
          onChange={e => setWeight(e.target.value)}
          placeholder="Weight in kg, e.g. 72.5"
          className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/40"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => void saveWeight()}
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : weight ? "Save Weight" : "Skip"}
          </button>
          {weight ? (
            <button onClick={onDone} className="h-11 px-4 rounded-xl border border-border text-sm text-muted-foreground">
              Skip
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Check-In Card ─────────────────────────────────────────────────────────────

function CheckInCard({ memberId, checkin, onRefresh }: {
  memberId: number;
  checkin: CheckIn | null | undefined;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);

  const [checkinErr, setCheckinErr] = useState<string | null>(null);

  async function doCheckin(centerId: string) {
    setBusy(true);
    setCheckinErr(null);
    try {
      const res = await apiFetch(`/members/${memberId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ center_id: centerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setCheckinErr(data.error ?? `Check-in failed (${res.status})`);
        return false;
      }
      return true;
    } catch {
      setCheckinErr("Network error — please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleQrScanned(centerId: string) {
    setScannerOpen(false);
    void doCheckin(centerId).then((ok) => {
      if (ok) {
        onRefresh();
        setShowWeightPrompt(true);
      }
    });
  }

  async function handleCheckout() {
    setBusy(true);
    try {
      await apiFetch(`/members/${memberId}/checkout`, { method: "POST" });
      onRefresh();
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  if (checkin === undefined) {
    return <div className="bg-teal-dark rounded-[12px] p-5 text-white animate-pulse h-20" />;
  }

  if (checkin) {
    const since = safeFormat(checkin.checked_in_at, "h:mm a", "--:--");
    return (
      <section className="bg-teal-dark rounded-[12px] p-5 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <div>
              <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Checked In</p>
              <p className="text-base font-semibold leading-tight mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 opacity-70" />
                {checkin.center_name}
              </p>
              <p className="text-xs opacity-60 mt-0.5">Since {since}</p>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            disabled={busy}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            Check Out
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-card border border-border rounded-[12px] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Camera className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Not checked in</p>
          <p className="text-xs text-muted-foreground">Scan the QR at your wellness center</p>
        </div>
        <button
          onClick={() => setScannerOpen(true)}
          disabled={busy}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-3 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <Camera className="w-4 h-4" />
          Scan QR
        </button>
      </section>

      {checkinErr && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-2.5 text-xs text-destructive font-medium">
          ⚠️ {checkinErr}
        </div>
      )}

      {scannerOpen && (
        <QrScannerModal
          onScanned={handleQrScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {showWeightPrompt && (
        <WeightPromptModal
          memberId={memberId}
          onDone={() => setShowWeightPrompt(false)}
        />
      )}
    </>
  );
}

export function Dashboard() {
  const { memberId: MEMBER_ID } = useAuth();
  const queryClient = useQueryClient();

  const { data: member, isLoading: loadingMember, isError: memberError } = useGetMember(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberQueryKey(MEMBER_ID!) }
  });

  const { data: summary, isLoading: loadingSummary, isError: summaryError } = useGetDailySummary(MEMBER_ID!, { date: TODAY }, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) }
  });

  const { data: status } = useGetMemberStatus(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberStatusQueryKey(MEMBER_ID!) }
  });

  const { checkin, reload: reloadCheckin } = useActiveCheckin(MEMBER_ID);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  useEffect(() => {
    if (!MEMBER_ID) return;
    apiFetch(`/members/${MEMBER_ID}/broadcasts?limit=5`)
      .then(r => r.ok ? r.json() : [])
      .then((d: Broadcast[]) => setBroadcasts(d))
      .catch(() => { /* ignore */ });
  }, [MEMBER_ID]);

  function handleCheckinChange() {
    reloadCheckin();
    queryClient.invalidateQueries({ queryKey: getGetDailySummaryQueryKey(MEMBER_ID!, { date: TODAY }) });
  }

  // Only show loading spinner on the very first fetch of BOTH queries.
  // If either query errored (e.g. 401 due to stale token), skip the spinner
  // so the user sees the dashboard with whatever data we have rather than
  // being stuck on "Loading dashboard..." forever.
  if ((loadingMember && !memberError) || (loadingSummary && !summaryError)) {
    return <div className="p-6 text-center text-muted-foreground mt-20">Loading dashboard...</div>;
  }


  const targetCal = summary?.target_calories || 2000;
  const consumedCal = summary?.total_calories || 0;
  const progress = Math.min(consumedCal / targetCal, 1);
  const ringCircumference = 2 * Math.PI * 45;
  const ringOffset = ringCircumference - (progress * ringCircumference);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 space-y-6">
      <header className="pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Hi, {member?.name?.split(' ')[0] || 'Member'}</h1>
        <p className="text-muted-foreground">{format(new Date(), "EEEE, MMM do")}</p>
      </header>

      {/* Expiry / check-in cap warning */}
      {status?.is_expiring_soon && (
        <Link
          href="/profile"
          className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-[12px] p-3.5"
        >
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Membership renewal needed soon</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {status.checkins_remaining} of {status.checkin_cap} check-ins left
              {status.days_until_expiry != null && (
                <> &middot; expires in {status.days_until_expiry} day{status.days_until_expiry === 1 ? "" : "s"}</>
              )}
              . Renew at your center to keep going.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        </Link>
      )}

      {/* Broadcasts */}
      {broadcasts.filter(b => !b.is_read).length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-amber-600" />
              Messages from your center
            </h2>
          </div>
          {broadcasts.filter(b => !b.is_read).slice(0, 3).map(b => (
            <BroadcastCard key={b.id} broadcast={b} memberId={MEMBER_ID!} onDismiss={() => {
              setBroadcasts(prev => prev.map(p => p.id === b.id ? { ...p, is_read: true } : p));
            }} />
          ))}
        </section>
      )}

      {/* Progress Ring Card */}
      <section className="bg-card rounded-[12px] p-6 border border-border flex items-center justify-between">
        <div className="relative w-28 h-28 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="56" cy="56" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-secondary" />
            <circle cx="56" cy="56" r="45" stroke="currentColor" strokeWidth="8" fill="transparent"
              strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} className="text-primary transition-all duration-1000 ease-out" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-foreground leading-none">{consumedCal.toFixed(0)}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">/ {targetCal} kcal</span>
          </div>
        </div>
        
        <div className="flex-1 ml-6 space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Protein</span>
            <span className="text-sm font-semibold">{summary?.total_protein.toFixed(1) || 0}g</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Carbs</span>
            <span className="text-sm font-semibold">{summary?.total_carbs.toFixed(1) || 0}g</span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fat</span>
            <span className="text-sm font-semibold">{summary?.total_fat.toFixed(1) || 0}g</span>
          </div>
        </div>
      </section>

      {/* Check-in card */}
      {MEMBER_ID && (
        <CheckInCard
          memberId={MEMBER_ID}
          checkin={checkin}
          onRefresh={handleCheckinChange}
        />
      )}

      {/* Logs section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Today's Meals</h2>
          <Link href="/log" className="text-primary hover:text-primary/80 transition-colors">
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        <div className="space-y-3">
          {["Breakfast", "Lunch", "Snack", "Dinner"].map((slot) => {
            const logs = summary?.logs_by_slot?.[slot] || [];
            return (
              <div key={slot} className="bg-card rounded-[12px] p-4 border border-border">
                <h4 className="font-semibold text-sm mb-2">{slot}</h4>
                {logs.length > 0 ? (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex justify-between items-center text-sm">
                        <span className="text-foreground">{log.food_item}</span>
                        <span className="text-muted-foreground">{log.calories_kcal?.toFixed(0)} kcal</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="pt-2">
        <Link href="/log" className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-md font-medium text-sm">
          <Plus className="w-4 h-4" />
          Log a Meal
        </Link>
      </div>
    </motion.div>
  );
}

const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

function linkifyMessage(message: string): ReactNode[] {
  const parts = message.split(URL_PATTERN);
  return parts.map((part, i) => {
    const isUrl = i % 2 === 1;
    if (isUrl) {
      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 underline break-words"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function BroadcastCard({ broadcast, memberId, onDismiss }: {
  broadcast: Broadcast; memberId: number; onDismiss: () => void;
}) {
  async function markRead() {
    try {
      await apiFetch(`/members/${memberId}/broadcasts/${broadcast.id}/read`, { method: "POST" });
      onDismiss();
    } catch { /* ignore */ }
  }
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-3.5 relative">
      <button
        onClick={markRead}
        className="absolute top-2 right-2 p-0.5 rounded text-amber-400 hover:text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <p className="text-sm text-amber-900 pr-6 leading-snug">{linkifyMessage(broadcast.message)}</p>
      <p className="text-[10px] text-amber-600 mt-1.5">
        {safeFormat(broadcast.sent_at, "MMM d", "--")}
      </p>
    </div>
  );
}
