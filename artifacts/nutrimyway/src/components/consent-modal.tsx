import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api-base";

export function ConsentModal({ onAccepted, endpoint }: { onAccepted: () => void; endpoint: string }) {
  const { token } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!checked) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-lg">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-teal-dark" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Before you continue</h1>
          <p className="text-sm text-muted-foreground">
            Please review and accept our Terms of Service and Privacy Policy to continue using NutriMyWay.
          </p>
        </div>

        <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
          By using NutriMyWay, you agree to let your wellness center record your check-ins, meal logs, and
          health metrics for the purpose of tracking your nutrition plan. Your data is shared only with your
          wellness center and is not sold to third parties. You may request deletion of your data at any time
          by contacting your center.
        </div>

        <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary"
          />
          <span>I have read and agree to the Terms of Service and Privacy Policy.</span>
        </label>

        {error && (
          <p className="text-xs text-destructive bg-destructive/8 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={() => void handleAccept()}
          disabled={!checked || saving}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-[12px] bg-primary text-primary-foreground text-[15px] font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept & Continue"}
        </button>
      </div>
    </div>
  );
}
