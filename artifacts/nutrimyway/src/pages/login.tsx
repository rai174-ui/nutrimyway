import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

type Step = "phone" | "otp" | "register";
interface Center { id: string; name: string }

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
}

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: -32, transition: { duration: 0.2 } },
};

export function Login() {
  const { login } = useAuth();
  const [step, setStep]           = useState<Step>("phone");
  const [mobile, setMobile]       = useState("");
  const [otpValue, setOtpValue]   = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [regToken, setRegToken]   = useState("");
  const [name, setName]           = useState("");
  const [centers, setCenters]     = useState<Center[]>([]);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function requestOtp() {
    setError(null); setLoading(true);
    try {
      const d = await apiPost<{ otp_preview?: string }>("/auth/request-otp", { mobile });
      setOtpPreview(d.otp_preview ?? null);
      setStep("otp");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setError(null); setLoading(true);
    try {
      const d = await apiPost<{ token: string; member_id: number | null; is_new_user: boolean }>(
        "/auth/verify-otp", { mobile, otp: otpValue }
      );
      if (d.is_new_user) {
        setRegToken(d.token);
        const r = await fetch("/api/centers"); setCenters(await r.json());
        setStep("register");
      } else { login(d.token, d.member_id!); }
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid OTP"); }
    finally { setLoading(false); }
  }

  async function register() {
    setError(null); setLoading(true);
    try {
      const d = await apiPost<{ token: string; member_id: number }>(
        "/auth/register", { token: regToken, name: name.trim(), center_ids: [...selected] }
      );
      login(d.token, d.member_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  function toggleCenter(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const canSubmitPhone    = mobile.trim().length >= 7 && !loading;
  const canSubmitOtp      = otpValue.length === 6 && !loading;
  const canSubmitRegister = name.trim().length > 0 && selected.size > 0 && !loading;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top decorative band */}
      <div className="relative h-56 bg-teal-dark flex-shrink-0 flex flex-col items-center justify-end pb-8 overflow-hidden">
        {/* Soft circles */}
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute top-8 -left-12 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-28 h-28 rounded-full bg-background" />
        {/* Logo mark */}
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg mb-1">
          <span className="text-teal-dark text-2xl font-black tracking-tight">N</span>
        </div>
      </div>

      {/* Content card */}
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-6 pt-10 pb-8">
        {/* Step back button */}
        <AnimatePresence>
          {step !== "phone" && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { if (step === "otp") { setStep("phone"); setOtpValue(""); setError(null); } else { setStep("otp"); setError(null); } }}
              className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Phone ── */}
          {step === "phone" && (
            <motion.div key="phone" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-sm mt-1">Enter your mobile number to continue</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="mobile" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mobile Number
                </label>
                <div className="relative">
                  <input
                    id="mobile"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 98765 43210"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && canSubmitPhone && requestOtp()}
                    className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton onClick={requestOtp} disabled={!canSubmitPhone} loading={loading}>
                Send OTP <ArrowRight className="w-4 h-4 ml-1.5" />
              </PrimaryButton>

              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                By continuing you agree to our{" "}
                <span className="text-primary underline underline-offset-2 cursor-pointer">Terms of Service</span>
              </p>
            </motion.div>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === "otp" && (
            <motion.div key="otp" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Verify your number</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{mobile}</span>
                </p>
              </div>

              {/* Dev OTP preview */}
              {otpPreview && (
                <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">
                    Dev mode · Your OTP
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
                  placeholder="• • • • • •"
                  value={otpValue}
                  onChange={e => setOtpValue(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && canSubmitOtp && verifyOtp()}
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

          {/* ── STEP 3: Register ── */}
          {step === "register" && (
            <motion.div key="register" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Create your profile</h1>
                <p className="text-muted-foreground text-sm mt-1">Almost there — just a few details</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Center(s)
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">Select at least one</p>
                </div>
                <div className="space-y-2">
                  {centers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">Loading…</p>
                  )}
                  {centers.map(c => {
                    const on = selected.has(c.id);
                    return (
                      <button key={c.id} onClick={() => toggleCenter(c.id)}
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-[12px] border text-sm font-medium transition-all ${
                          on
                            ? "bg-primary/8 border-primary text-primary"
                            : "bg-card border-border text-foreground hover:border-primary/40"
                        }`}>
                        <span>{c.name}</span>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          on ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}>
                          {on && <Check className="w-3 h-3 text-primary-foreground" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton onClick={register} disabled={!canSubmitRegister} loading={loading}>
                Get Started <ArrowRight className="w-4 h-4 ml-1.5" />
              </PrimaryButton>
            </motion.div>
          )}
        </AnimatePresence>
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
    <div className="flex items-center gap-2 bg-destructive/8 border border-destructive/20 rounded-[10px] px-4 py-3">
      <span className="text-sm text-destructive">{msg}</span>
    </div>
  );
}
