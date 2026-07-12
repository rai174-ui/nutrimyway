import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader2, Mail, Hash } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { apiFetch } from "@/lib/api-base";

type Step = "contact" | "otp";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = "Request failed (" + res.status + ")";
    try { const d = await res.json() as { error?: string }; msg = d.error ?? msg; } catch { /* html body */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const EASE = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];
const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: EASE } },
  exit:    { opacity: 0, x: -32, transition: { duration: 0.2 } },
};

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function Login() {
  const { login } = useAuth();
  const [step, setStep]             = useState<Step>("contact");
  const [email, setEmail]           = useState("");
  const [membershipNo, setMembershipNo] = useState("");
  const [otpValue, setOtpValue]     = useState("");
  const [otpToken, setOtpToken]     = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const canSubmitContact = isValidEmail(email) && membershipNo.trim().length > 0 && !loading;
  const canSubmitOtp = otpValue.length === 6 && !loading;

  const maskedEmail = cleanEmail.length > 4
    ? cleanEmail.slice(0, 2) + "***@" + (cleanEmail.split("@")[1] ?? "")
    : cleanEmail;

  async function requestOtp() {
    setError(null); setLoading(true);
    try {
      const d = await apiPost<{ otp_token: string; otp_preview?: string }>("/auth/request-otp", {
        email: cleanEmail,
        membership_no: membershipNo.trim(),
      });
      setOtpToken(d.otp_token);
      if (d.otp_preview) setOtpPreview(d.otp_preview);
      setStep("otp");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setError(null); setLoading(true);
    try {
      const d = await apiPost<{ token: string; member_id: number; needs_terms_acceptance?: boolean }>("/auth/verify-otp", {
        otp_token: otpToken,
        otp: otpValue,
      });
      login(d.token, d.member_id, d.needs_terms_acceptance ?? false);
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid OTP"); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top decorative band */}
      <div className="relative h-56 bg-teal-dark flex-shrink-0 flex flex-col items-center justify-end pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute top-8 -left-12 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-28 h-28 rounded-full bg-background" />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg mb-1 p-2">
          <img src="logo.png" alt="NutriMyWay" className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-6 pt-10 pb-8">
        <AnimatePresence>
          {step !== "contact" && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setStep("contact"); setOtpValue(""); setError(null); setOtpPreview(null); }}
              className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* STEP 1 */}
          {step === "contact" && (
            <motion.div key="contact" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Member Login</h1>
                <p className="text-muted-foreground text-sm mt-1">Enter your email and membership number</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="email-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email Address
                </label>
                <input
                  id="email-input"
                  type="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canSubmitContact && requestOtp()}
                  className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="membership-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5" /> Membership Number
                </label>
                <input
                  id="membership-input"
                  type="text"
                  placeholder="e.g. NMW-12345"
                  value={membershipNo}
                  onChange={e => setMembershipNo(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canSubmitContact && requestOtp()}
                  className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <p className="text-[11px] text-muted-foreground">
                  Ask your wellness center for your membership number.
                </p>
              </div>

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton onClick={requestOtp} disabled={!canSubmitContact} loading={loading}>
                Request Login Code <ArrowRight className="w-4 h-4 ml-1.5" />
              </PrimaryButton>
            </motion.div>
          )}

          {/* STEP 2 */}
          {step === "otp" && (
            <motion.div key="otp" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Check your email</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{maskedEmail}</span>
                </p>
              </div>

              {otpPreview && (
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">
                    Dev mode &middot; Your OTP
                  </p>
                  <p className="text-3xl font-mono font-bold text-amber-800 tracking-[0.25em]">
                    {otpPreview}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="otp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  One-Time Passcode
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="* * * * * *"
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && canSubmitOtp && verifyOtp()}
                  autoFocus
                  className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-xl text-center font-mono tracking-[0.5em] placeholder:tracking-widest placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton onClick={verifyOtp} disabled={!canSubmitOtp} loading={loading}>
                Verify
              </PrimaryButton>

              <button
                onClick={requestOtp}
                disabled={loading}
                className="text-center text-sm text-primary font-medium hover:underline underline-offset-2 disabled:opacity-50"
              >
                Resend code
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-center pb-2 tracking-wide text-[18px] text-ring">
        Nutrition My Way
      </p>
      <div className="text-center pb-6 text-[10px] text-muted-foreground/60 flex flex-col items-center gap-1">
        <span>Powered by Nutrition My Way</span>
        <a href="/privacy" className="underline hover:text-foreground transition-colors">Privacy Policy</a>
      </div>
    </div>
  );
}

function PrimaryButton({
  children, onClick, disabled, loading,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-13 flex items-center justify-center gap-1 rounded-[12px] bg-primary text-primary-foreground text-[15px] font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="bg-destructive/8 border border-destructive/20 rounded-[10px] px-4 py-3">
      <span className="text-sm text-destructive">{msg}</span>
    </div>
  );
}
