import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { apiPost, markTermsAccepted } from "@/lib/api";

export function ConsentModal({ onAccepted }: { onAccepted: () => void }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!checked) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost("/admin/accept-terms", {});
      markTermsAccepted();
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-full bg-teal-pale flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-teal-dark" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Before you continue</h1>
          <p className="text-sm text-muted-foreground">
            Please review and accept our Terms of Service and Privacy Policy to continue using the Center Admin Panel.
          </p>
        </div>

        <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 leading-relaxed">
          As a center administrator, you agree to handle member data (health records, meal logs, and payment
          details) responsibly and in accordance with applicable privacy regulations. Access is granted solely
          for operating your wellness center on NutriMyWay.
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
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        <button
          onClick={() => void handleAccept()}
          disabled={!checked || saving}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accept & Continue"}
        </button>
      </div>
    </div>
  );
}
