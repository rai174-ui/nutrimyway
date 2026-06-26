import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ShieldCheck, Building2, Check, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

async function fetchCenters(): Promise<Center[]> {
  const res = await fetch("/api/centers");
  return res.json() as Promise<Center[]>;
}

export function Login() {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [mobile, setMobile] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [regToken, setRegToken] = useState("");
  const [name, setName] = useState("");
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenters, setSelectedCenters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestOtp() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ otp_preview?: string }>("/auth/request-otp", { mobile });
      setOtpPreview(data.otp_preview ?? null);
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; member_id: number | null; is_new_user: boolean }>(
        "/auth/verify-otp", { mobile, otp: otpValue }
      );
      if (data.is_new_user) {
        setRegToken(data.token);
        const list = await fetchCenters();
        setCenters(list);
        setStep("register");
      } else {
        login(data.token, data.member_id!);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!name.trim() || selectedCenters.size === 0) return;
    setError(null);
    setLoading(true);
    try {
      const data = await apiPost<{ token: string; member_id: number }>(
        "/auth/register",
        { token: regToken, name: name.trim(), center_ids: [...selectedCenters] }
      );
      login(data.token, data.member_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleCenter(id: string) {
    setSelectedCenters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const stepVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      {/* Logo / branding */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-primary-foreground text-2xl font-black">N</span>
        </div>
        <h1 className="text-2xl font-bold">NutriMyWay</h1>
        <p className="text-muted-foreground text-sm mt-1">Your personal wellness companion</p>
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {step === "phone" && (
            <motion.div key="phone" variants={stepVariants} initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25 }} className="space-y-5">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Enter your mobile number</h2>
                <p className="text-sm text-muted-foreground mt-1">We'll send you a one-time passcode</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                  className="h-12 text-base"
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button onClick={handleRequestOtp} disabled={!mobile.trim() || loading}
                className="w-full h-12 text-base font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4 ml-1" /></>}
              </Button>
            </motion.div>
          )}

          {step === "otp" && (
            <motion.div key="otp" variants={stepVariants} initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25 }} className="space-y-5">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Enter the OTP</h2>
                <p className="text-sm text-muted-foreground mt-1">Sent to {mobile}</p>
              </div>

              {otpPreview && (
                <div className="bg-amber-50 border border-amber-200 rounded-[10px] p-3 text-center">
                  <p className="text-xs text-amber-700 font-medium uppercase tracking-wider mb-1">Dev Mode — OTP</p>
                  <p className="text-2xl font-mono font-bold text-amber-800 tracking-widest">{otpPreview}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="otp">6-digit code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="h-12 text-base tracking-widest text-center font-mono"
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button onClick={handleVerifyOtp} disabled={otpValue.length < 6 || loading}
                className="w-full h-12 text-base font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
              </Button>
              <button onClick={() => { setStep("phone"); setOtpValue(""); setError(null); }}
                className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline">
                Change number
              </button>
            </motion.div>
          )}

          {step === "register" && (
            <motion.div key="register" variants={stepVariants} initial="initial" animate="animate" exit="exit"
              transition={{ duration: 0.25 }} className="space-y-5">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-bold">Complete your profile</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us your name and home center</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Select center(s) <span className="text-muted-foreground font-normal">(at least one)</span>
                </Label>
                <div className="space-y-2">
                  {centers.map((c) => {
                    const selected = selectedCenters.has(c.id);
                    return (
                      <button key={c.id} onClick={() => toggleCenter(c.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-[10px] border text-sm font-medium transition-all ${
                          selected
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-card border-border text-foreground"
                        }`}>
                        <span>{c.name}</span>
                        {selected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                  {centers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">Loading centers…</p>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button
                onClick={handleRegister}
                disabled={!name.trim() || selectedCenters.size === 0 || loading}
                className="w-full h-12 text-base font-semibold">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Started"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
