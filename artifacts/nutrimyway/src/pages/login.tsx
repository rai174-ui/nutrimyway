import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, Loader2, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

type Step = "contact" | "otp" | "register";
type ContactKind = "mobile" | "email";
interface Center { id: string; name: string }

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const d = await res.json() as { error?: string }; msg = d.error ?? msg; } catch { /* html body */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
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

function isValidMobile(v: string) { return /^\d{7,15}$/.test(v.replace(/\s+/g, "")); }
function isValidEmail(v: string)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

export function Login() {
  const { login } = useAuth();
  const [step, setStep]             = useState<Step>("contact");
  const [kind, setKind]             = useState<ContactKind>("mobile");
  const [contact, setContact]       = useState("");
  const [otpValue, setOtpValue]     = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [regToken, setRegToken]     = useState("");
  const [name, setName]             = useState("");
  const [centers, setCenters]       = useState<Center[]>([]);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const cleanContact = kind === "mobile" ? contact.replace(/\s+/g, "") : contact.trim().toLowerCase();
  const contactValid = kind === "mobile" ? isValidMobile(contact) : isValidEmail(contact);

  function switchKind(k: ContactKind) {
    setKind(k); setContact(""); setError(null);
  }

  async function requestOtp() {
    setError(null); setLoading(true);
    try {
      const body = kind === "mobile" ? { mobile: cleanContact } : { email: cleanContact };
      const d = await apiPost<{ otp_preview?: string }>("/auth/request-otp", body);
      setOtpPreview(d.otp_preview ?? null);
      setStep("otp");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  async function verifyOtp() {
    setError(null); setLoading(true);
    try {
      const body = kind === "mobile"
        ? { mobile: cleanContact, otp: otpValue }
        : { email: cleanContact,  otp: otpValue };
      const d = await apiPost<{ token: string; member_id: number | null; is_new_user: boolean }>(
        "/auth/verify-otp", body
      );
      if (d.is_new_user) {
        setRegToken(d.token);
        const cs = await apiFetch<Center[]>("/centers"); setCenters(cs);
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

  const canSubmitContact  = contactValid && !loading;
  const canSubmitOtp      = otpValue.length === 6 && !loading;
  const canSubmitRegister = name.trim().length > 0 && selected.size > 0 && !loading;

  const maskedContact = kind === "mobile"
    ? `+${cleanContact.slice(0, 2)} ••••• ${cleanContact.slice(-4)}`
    : `${contact.slice(0, 2)}•••@${contact.split("@")[1] ?? ""}`;

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Top decorative band */}
      <div className="relative h-56 bg-teal-dark flex-shrink-0 flex flex-col items-center justify-end pb-8 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute top-8 -left-12 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-28 h-28 rounded-full bg-background" />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg mb-1 p-2">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="NutriMyWay" className="w-full h-full object-contain" />
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-6 pt-10 pb-8">
        <AnimatePresence>
          {step !== "contact" && (
            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => {
                if (step === "otp")      { setStep("contact"); setOtpValue(""); setError(null); }
                else if (step === "register") { setStep("otp"); setError(null); }
              }}
              className="flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Contact ── */}
          {step === "contact" && (
            <motion.div key="contact" {...slide} className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground text-sm mt-1">Sign in or create your account</p>
              </div>

              {/* Mobile / Email toggle */}
              <div className="flex bg-muted rounded-[10px] p-1 gap-1">
                <TabButton
                  active={kind === "mobile"}
                  onClick={() => switchKind("mobile")}
                  icon={<Phone className="w-3.5 h-3.5" />}
                  label="Mobile"
                />
                <TabButton
                  active={kind === "email"}
                  onClick={() => switchKind("email")}
                  icon={<Mail className="w-3.5 h-3.5" />}
                  label="Email"
                />
              </div>

              <AnimatePresence mode="wait">
                {kind === "mobile" ? (
                  <motion.div key="mobile-field" {...slide} className="space-y-2">
                    <label htmlFor="contact-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Mobile Number
                    </label>
                    <input
                      id="contact-input"
                      type="tel"
                      inputMode="tel"
                      placeholder="+91 98765 43210"
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && canSubmitContact && requestOtp()}
                      className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </motion.div>
                ) : (
                  <motion.div key="email-field" {...slide} className="space-y-2">
                    <label htmlFor="contact-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Email Address
                    </label>
                    <input
                      id="contact-input"
                      type="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      value={contact}
                      onChange={e => setContact(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && canSubmitContact && requestOtp()}
                      className="w-full h-13 px-4 py-3.5 rounded-[12px] border border-input bg-card text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {error && <ErrorBanner msg={error} />}

              <PrimaryButton onClick={requestOtp} disabled={!canSubmitContact} loading={loading}>
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
                <h1 className="text-2xl font-bold">Verify your {kind === "mobile" ? "number" : "email"}</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{maskedContact}</span>
                </p>
              </div>

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

      <p className="text-center text-xs text-muted-foreground/50 pb-6 tracking-wide">
        Nutrition My Way
      </p>
    </div>
  );
}

function TabButton({
  active, onClick, icon, label,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[7px] text-sm font-medium transition-all ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}{label}
    </button>
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
