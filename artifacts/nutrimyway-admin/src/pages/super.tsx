import { useState, useEffect, useCallback, useRef } from "react";
import { useSearch } from "wouter";
import {
  ShieldCheck, CheckCircle2, XCircle, Loader2, LogOut, RefreshCw,
  Key, Calendar, Mail, Eye, EyeOff, Pencil, Upload, Users, Plus, Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  isSuperAuthenticated, saveSuperAuth, clearSuperAuth, superFetch, type CenterWithStatus, type TrialSettings,
} from "@/lib/api";
import {
  UploadMembersDialog, UploadBatchesDialog, UploadFlavoursDialog, UploadItemsDialog,
} from "@/components/bulk-upload-dialogs";

// ─── Reset password form (accessed via email link with ?token=xxx) ───────────

function ResetPasswordForm({ token }: { token: string }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd !== confirm) { setError("Passwords do not match"); return; }
    if (pwd.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError(null);
    try {
      await superFetch("/admin/super/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: pwd }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-dark flex items-center justify-center shadow-lg mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          <p className="text-muted-foreground text-sm mt-1">Set a new Super Admin password</p>
        </div>
        {done ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
            <p className="font-semibold text-emerald-800">Password updated!</p>
            <p className="text-sm text-emerald-700 mt-1">
              <a href="/admin/super" className="underline">Go to Super Admin login</a>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full h-11 px-3 pr-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-3 text-muted-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!pwd || !confirm || loading}
              className="h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Set New Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Forgot password panel (shown inline on login & dashboard) ────────────────

function ForgotPasswordPanel({ onBack }: { onBack?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setLoading(true); setError(null);
    try {
      const base = import.meta.env.VITE_API_BASE || "/api";
      await fetch(`${base}/admin/super/forgot-password`, { method: "POST" });
      setSent(true);
    } catch {
      setError("Failed to send. Check server SMTP configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4">
      {sent ? (
        <div className="text-center py-2">
          <Mail className="w-8 h-8 text-teal-600 mx-auto mb-2" />
          <p className="font-semibold text-foreground">Reset link sent!</p>
          <p className="text-sm text-muted-foreground mt-1">Check <strong>rai.174@gmail.com</strong></p>
          <p className="text-xs text-muted-foreground mt-2">If SMTP is not configured, copy the link from the server log.</p>
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-semibold text-foreground">Reset Super Admin Password</p>
            <p className="text-xs text-muted-foreground mt-1">
              A reset link will be emailed to <strong>rai.174@gmail.com</strong>.
              If SMTP isn&apos;t configured, copy the link from the server log.
            </p>
          </div>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              <span className="text-xs text-destructive">{error}</span>
            </div>
          )}
          <button
            onClick={() => void send()}
            disabled={loading}
            className="h-10 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4" />Send Reset Link</>}
          </button>
        </>
      )}
      {onBack && (
        <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors">
          ← Back to login
        </button>
      )}
    </div>
  );
}

// ─── Super Admin Login ────────────────────────────────────────────────────────

function SuperLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await superFetch<{ token: string }>("/admin/super/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      saveSuperAuth(res.token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-dark flex items-center justify-center shadow-lg mb-3">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all centers</p>
        </div>

        {showForgot ? (
          <ForgotPasswordPanel onBack={() => setShowForgot(false)} />
        ) : (
          <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter super admin password"
                autoFocus
                className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                <span className="text-sm text-destructive">{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={!password || loading}
              className="h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-sm active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
            >
              Forgot password?
            </button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          <a href="/admin/login" className="hover:underline">← Back to center login</a>
        </p>
      </div>
    </div>
  );
}

// ─── Reset Center Password Dialog ─────────────────────────────────────────────

function ResetPwdDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: () => void }) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError(null);
    try {
      await superFetch(`/admin/super/centers/${center.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: pwd }),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Reset Center Password</h3>
        <p className="text-sm text-muted-foreground mb-4">{center.name} <span className="font-mono text-xs">({center.id})</span></p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={pwd}
              onChange={e => setPwd(e.target.value)}
              placeholder="New password (min. 8 chars)"
              autoFocus
              className="w-full h-10 px-3 pr-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-2.5 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pwd || loading}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Center Data Dialog ────────────────────────────────────────────────

const RESET_CATEGORIES = [
  { key: "check_ins",   label: "Check-ins & Visit Selections", desc: "All check-in records, flavour/ingredient selections" },
  { key: "consumption", label: "Consumption Logs",              desc: "All meal consumption log entries" },
  { key: "inventory",   label: "Inventory Batches",             desc: "Ingredient batches, batch logs & adjustments" },
  { key: "health",      label: "Health Records",                desc: "Weight and health entries" },
  { key: "issuances",   label: "Issuances & Renewals",          desc: "Plan issuances, renewals, membership cycle reset" },
  { key: "members",     label: "Members (unlink & delete)",     desc: "⚠ Unlinks + deletes members unique to this center" },
  { key: "consent",     label: "Terms & Consent",               desc: "Resets terms acceptance for center admin and all its members" },
] as const;

function ResetCenterDataDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: (summary: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, number> | null>(null);

  function toggleCat(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleReset() {
    if (confirmText !== center.id) { setError(`Type the center ID exactly: ${center.id}`); return; }
    if (selected.size === 0) { setError("Select at least one category."); return; }
    setLoading(true); setError(null);
    try {
      const res = await superFetch<{ deleted: Record<string, number> }>(
        `/admin/super/centers/${center.id}/reset`,
        { method: "POST", body: JSON.stringify({ confirm: "RESET", categories: [...selected] }) }
      );
      setResult(res.deleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  const canReset = selected.size > 0 && confirmText === center.id && !loading;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Reset Center Data</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{center.name} <span className="font-mono text-xs">({center.id})</span></p>
          </div>
          <button onClick={result ? () => { onSuccess(`Reset complete`); onClose(); } : onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          /* ── Success summary ── */
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Reset complete</span>
            </div>
            <div className="bg-muted/50 rounded-xl border border-border overflow-hidden">
              {Object.entries(result).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0">
                  <span className="text-sm text-foreground capitalize">{cat.replace("_", " ")}</span>
                  <span className="text-sm font-semibold tabular-nums text-destructive">{count} rows deleted</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { onSuccess(`Reset complete for ${center.name}`); onClose(); }}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Selection & confirmation ── */
          <div className="p-5 space-y-4">
            {/* Warning banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-800 font-medium">⚠ This action is irreversible. Select only what you want to permanently delete.</p>
            </div>

            {/* Category checkboxes */}
            <div className="space-y-2">
              {RESET_CATEGORIES.map(({ key, label, desc }) => {
                const isDanger = key === "members";
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selected.has(key)
                        ? isDanger ? "bg-red-50 border-red-300" : "bg-primary/5 border-primary/30"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleCat(key)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${isDanger ? "text-red-700" : "text-foreground"}`}>{label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Confirmation input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Type center ID to confirm
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={center.id}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-destructive/40"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                <span className="text-xs text-destructive">{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => void handleReset()}
                disabled={!canReset}
                className="flex-1 h-10 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Reset Selected</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Edit Center Name Dialog ────────────────────────────────────────────────

function EditCenterDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: (updated: CenterWithStatus) => void }) {
  const [name, setName] = useState(center.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setLoading(true); setError(null);
    try {
      const updated = await superFetch<CenterWithStatus>(`/admin/super/centers/${center.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Edit Center</h3>
        <p className="text-sm text-muted-foreground mb-4">{center.id}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Center name"
            autoFocus
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || loading} className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Center Dialog ────────────────────────────────────────────────────────

function AddCenterDialog({
  onClose, onSuccess,
}: { onClose: () => void; onSuccess: (created: CenterWithStatus) => void }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedId = id.trim().toLowerCase();
    if (!trimmedId || !/^[a-z0-9-]+$/.test(trimmedId)) {
      setError("Center ID must be lowercase letters, numbers and hyphens only (e.g. mumbai-2)");
      return;
    }
    if (!name.trim()) { setError("Name is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true); setError(null);
    try {
      const created = await superFetch<CenterWithStatus>("/admin/super/centers", {
        method: "POST",
        body: JSON.stringify({ id: trimmedId, name: name.trim(), password }),
      });
      onSuccess(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create center");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Add New Center</h3>
        <p className="text-xs text-muted-foreground mb-4">Creates a center with its own login for the center admin.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="Center ID (e.g. mumbai-2)"
              autoFocus
              className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Used to log in. Lowercase letters, numbers, hyphens only. Cannot be changed later.</p>
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Center name (e.g. Mumbai - Andheri)"
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password (min. 8 chars)"
              className="w-full h-10 px-3 pr-10 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-2.5 text-muted-foreground">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!id.trim() || !name.trim() || password.length < 8 || loading}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Center"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Set Validity Date Dialog ─────────────────────────────────────────────────

function ValidityDialog({
  center, onClose, onSuccess,
}: { center: CenterWithStatus; onClose: () => void; onSuccess: (updated: CenterWithStatus) => void }) {
  const [date, setDate] = useState(center.valid_until ? center.valid_until.slice(0, 10) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const updated = await superFetch<CenterWithStatus>(`/admin/super/centers/${center.id}/validity`, {
        method: "PATCH",
        body: JSON.stringify({ valid_until: date || null }),
      });
      onSuccess(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-foreground mb-1">Set Access Validity</h3>
        <p className="text-sm text-muted-foreground mb-1">{center.name}</p>
        <p className="text-xs text-muted-foreground mb-4">Leave blank for unlimited access. Login is blocked after the date you set.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            {date && (
              <button
                type="button"
                onClick={() => setDate("")}
                className="h-9 px-3 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Validity badge helper ────────────────────────────────────────────────────

function ValidityBadge({ center }: { center: CenterWithStatus }) {
  if (!center.valid_until) return <span className="text-xs text-muted-foreground">No expiry</span>;
  const expired = new Date(center.valid_until) < new Date();
  return (
    <span className={`text-xs font-medium ${expired ? "text-destructive" : "text-amber-600"}`}>
      {expired ? "Expired " : "Until "}
      {new Date(center.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </span>
  );
}

// ─── Trial 3-Day Settings Card ─────────────────────────────────────────────────

function TrialSettingsCard() {
  const [settings, setSettings] = useState<TrialSettings | null>(null);
  const [checkinCap, setCheckinCap] = useState("");
  const [renewalDays, setRenewalDays] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await superFetch<TrialSettings>("/admin/super/trial-settings");
        setSettings(data);
        setCheckinCap(String(data.trial_3day_checkin_cap));
        setRenewalDays(String(data.trial_3day_renewal_days));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trial settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cap = Number(checkinCap);
  const days = Number(renewalDays);
  const valid =
    Number.isInteger(cap) && cap >= 1 && cap <= 500 &&
    Number.isInteger(days) && days >= 1 && days <= 365;
  const dirty = settings != null && (cap !== settings.trial_3day_checkin_cap || days !== settings.trial_3day_renewal_days);

  async function handleSave() {
    if (!valid) return;
    setSaving(true); setError(null); setSaved(false);
    try {
      const updated = await superFetch<TrialSettings>("/admin/super/trial-settings", {
        method: "PATCH",
        body: JSON.stringify({ trial_3day_checkin_cap: cap, trial_3day_renewal_days: days }),
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trial settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <h2 className="text-base font-bold text-foreground mb-1">Trial 3-Day Settings</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Applies to every Trial 3-Day member across all centers, overriding each center&apos;s own check-in cap and renewal days.
      </p>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check-in Cap</label>
              <input
                type="number"
                min={1}
                max={500}
                value={checkinCap}
                onChange={e => setCheckinCap(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Renewal Days</label>
              <input
                type="number"
                min={1}
                max={365}
                value={renewalDays}
                onChange={e => setRenewalDays(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSave()}
              disabled={!valid || !dirty || saving}
              className="h-10 px-4 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />Saved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Super Admin Dashboard ────────────────────────────────────────────────────

function SuperDashboard({ onLogout }: { onLogout: () => void }) {
  const [centers, setCenters] = useState<CenterWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetPwdCenter, setResetPwdCenter] = useState<CenterWithStatus | null>(null);
  const [resetDataCenter, setResetDataCenter] = useState<CenterWithStatus | null>(null);
  const [validityCenter, setValidityCenter] = useState<CenterWithStatus | null>(null);
  const [editCenter, setEditCenter] = useState<CenterWithStatus | null>(null);
  const [uploadMembersCenter, setUploadMembersCenter] = useState<CenterWithStatus | null>(null);
  const [uploadFlavoursCenter, setUploadFlavoursCenter] = useState<CenterWithStatus | null>(null);
  const [showUploadBatches, setShowUploadBatches] = useState(false);
  const [showUploadItems, setShowUploadItems] = useState(false);
  const [showAddCenter, setShowAddCenter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await superFetch<CenterWithStatus[]>("/admin/super/centers");
      setCenters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load centers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(center: CenterWithStatus) {
    setToggling(center.id);
    try {
      const action = center.is_active ? "deactivate" : "activate";
      const updated = await superFetch<CenterWithStatus>(`/admin/super/centers/${center.id}/${action}`, { method: "PATCH" });
      setCenters(prev => prev.map(c => c.id === updated.id ? { ...c, is_active: updated.is_active } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update center");
    } finally {
      setToggling(null);
    }
  }

  const active = centers.filter(c => c.is_active).length;
  const inactive = centers.filter(c => !c.is_active).length;

  return (
    <div className="min-h-screen bg-background">
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm px-5 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {resetPwdCenter && (
        <ResetPwdDialog
          center={resetPwdCenter}
          onClose={() => setResetPwdCenter(null)}
          onSuccess={() => { setResetPwdCenter(null); showToast("Password reset successfully"); }}
        />
      )}

      {resetDataCenter && (
        <ResetCenterDataDialog
          center={resetDataCenter}
          onClose={() => setResetDataCenter(null)}
          onSuccess={msg => { setResetDataCenter(null); showToast(msg); }}
        />
      )}

      {validityCenter && (
        <ValidityDialog
          center={validityCenter}
          onClose={() => setValidityCenter(null)}
          onSuccess={updated => {
            setCenters(prev => prev.map(c => c.id === updated.id ? { ...c, valid_until: updated.valid_until } : c));
            setValidityCenter(null);
            showToast("Validity date updated");
          }}
        />
      )}

      {editCenter && (
        <EditCenterDialog
          center={editCenter}
          onClose={() => setEditCenter(null)}
          onSuccess={updated => {
            setCenters(prev => prev.map(c => c.id === updated.id ? { ...c, name: updated.name } : c));
            setEditCenter(null);
            showToast("Center name updated");
          }}
        />
      )}

      {uploadMembersCenter && (
        <UploadMembersDialog
          center={uploadMembersCenter}
          onClose={() => setUploadMembersCenter(null)}
          onSuccess={count => {
            setUploadMembersCenter(null);
            showToast(`${count} members uploaded`);
          }}
        />
      )}

      {showUploadBatches && (
        <UploadBatchesDialog
          onClose={() => setShowUploadBatches(false)}
          onSuccess={count => {
            setShowUploadBatches(false);
            showToast(`${count} batch${count !== 1 ? "es" : ""} uploaded`);
          }}
        />
      )}

      {uploadFlavoursCenter && (
        <UploadFlavoursDialog
          center={uploadFlavoursCenter}
          onClose={() => setUploadFlavoursCenter(null)}
          onSuccess={count => {
            setUploadFlavoursCenter(null);
            showToast(`${count} flavour${count !== 1 ? "s" : ""} uploaded`);
          }}
        />
      )}

      {showUploadItems && (
        <UploadItemsDialog
          onClose={() => setShowUploadItems(false)}
          onSuccess={count => {
            setShowUploadItems(false);
            showToast(`${count} item${count !== 1 ? "s" : ""} uploaded`);
          }}
        />
      )}

      {showAddCenter && (
        <AddCenterDialog
          onClose={() => setShowAddCenter(false)}
          onSuccess={created => {
            setCenters(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            setShowAddCenter(false);
            showToast(`Center "${created.name}" created`);
          }}
        />
      )}

      <header className="bg-teal-dark text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm tracking-tight">NutriMyWay — Super Admin</span>
          <div className="flex-1" />
          <button
            onClick={() => { clearSuperAuth(); onLogout(); }}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Center Management</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Manage access, passwords and validity for all centers</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddCenter(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Center
            </button>
            <button
              onClick={() => setShowUploadBatches(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload Batches
            </button>
            <button
              onClick={() => setShowUploadItems(true)}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload Items
            </button>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Centers", value: centers.length, color: "text-foreground" },
            { label: "Active", value: active, color: "text-emerald-600" },
            { label: "Inactive", value: inactive, color: "text-destructive" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card rounded-2xl border border-border p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Center</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valid Until</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center, i) => (
                  <tr
                    key={center.id}
                    className={`${i < centers.length - 1 ? "border-b border-border" : ""} hover:bg-muted/20 transition-colors`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{center.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{center.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        center.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {center.is_active
                          ? <><CheckCircle2 className="w-3 h-3" />Active</>
                          : <><XCircle className="w-3 h-3" />Inactive</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ValidityBadge center={center} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditCenter(center)}
                          title="Edit name"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setUploadMembersCenter(center)}
                          title="Bulk upload members"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setUploadFlavoursCenter(center)}
                          title="Bulk upload flavours"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setResetPwdCenter(center)}
                          title="Reset password"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setResetDataCenter(center)}
                          title="Reset center data"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setValidityCenter(center)}
                          title="Set validity date"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void toggle(center)}
                          disabled={toggling === center.id}
                          className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 ${
                            center.is_active
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {toggling === center.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : center.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TrialSettingsCard />

        <div className="bg-card rounded-2xl border border-border p-5">
          <h2 className="text-base font-bold text-foreground mb-1">Your Password</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Send a reset link to <strong>rai.174@gmail.com</strong>. If SMTP isn&apos;t configured, copy the link from the server log.
          </p>
          <ForgotPasswordPanel />
        </div>
      </main>
    </div>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function SuperPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const token = params.get("token");
  const [authed, setAuthed] = useState(isSuperAuthenticated());

  if (token) return <ResetPasswordForm token={token} />;
  return authed
    ? <SuperDashboard onLogout={() => setAuthed(false)} />
    : <SuperLogin onLogin={() => setAuthed(true)} />;
}
