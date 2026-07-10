import { useGetMember, getGetMemberQueryKey, useGetMemberIssuances, getGetMemberIssuancesQueryKey, useGetMemberStatus, getGetMemberStatusQueryKey } from "@workspace/api-client-react";
import { format, isValid } from "date-fns";
import { motion } from "framer-motion";
import { Package, Calendar, LogOut, Info, AlertTriangle, Ticket } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";

function safeFormat(value: string | null | undefined, fmt: string, fallback = "--"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? format(d, fmt) : fallback;
}

export function Profile() {
  const { memberId: MEMBER_ID, logout } = useAuth();

  const { data: member } = useGetMember(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberQueryKey(MEMBER_ID!) }
  });

  const { data: issuances } = useGetMemberIssuances(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberIssuancesQueryKey(MEMBER_ID!) }
  });

  const { data: status } = useGetMemberStatus(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberStatusQueryKey(MEMBER_ID!) }
  });


  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const getStatusColor = (status?: string | null) => {
    if (status === "Issued") return "bg-primary/10 text-primary border-primary/20";
    if (status === "Pending") return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="p-4 space-y-6">
      <header className="pt-8 pb-4 flex flex-col items-center text-center space-y-3 relative">
        <Link
          href="/about"
          className="absolute top-4 left-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="About"
        >
          <Info className="w-3.5 h-3.5" />
          About
        </Link>
        <button
          onClick={logout}
          className="absolute top-4 right-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
        <div className="w-24 h-24 rounded-full bg-teal-pale border border-teal-light flex items-center justify-center text-teal-dark text-3xl font-bold">
          {getInitials(member?.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{member?.name}</h1>
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-1 mt-1">
            Member #{member?.membership_no ?? member?.id}
            {member?.gender && (
              <>
                <span className="text-border">•</span>
                <span className="capitalize">{member.gender}</span>
              </>
            )}
            <span className="text-border">•</span>
            {member?.height_cm ? `${member.height_cm} cm` : 'Height not set'}
          </p>
        </div>
      </header>

      <section className="bg-card rounded-[12px] p-5 border border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">Active Plan</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Target Calories</span>
              <span className="font-bold">{(member?.daily_kcal ?? 2000)} kcal</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary w-3/4 rounded-full" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Protein Goal</span>
              <span className="font-bold">120g</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[#0F6E56] w-1/2 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Membership status: check-ins remaining + validity */}
      {status && (
        <section className={`rounded-[12px] p-5 border ${status.is_expiring_soon ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-1.5 ${status.is_expiring_soon ? "text-amber-700" : "text-muted-foreground"}`}>
              <Ticket className="w-3.5 h-3.5" />
              Membership Status
            </h2>
            {status.is_expiring_soon && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" />
                Renew soon
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Check-ins Used</span>
                <span className="font-bold">{status.checkins_used} / {status.checkin_cap}</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${status.checkins_remaining <= 7 ? "bg-amber-500" : "bg-primary"}`}
                  style={{ width: `${Math.min((status.checkins_used / status.checkin_cap) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{status.checkins_remaining} check-in{status.checkins_remaining === 1 ? "" : "s"} remaining this cycle</p>
            </div>
            {status.valid_until && (
              <div className="flex justify-between items-center text-sm pt-1 border-t border-border/60">
                <span className="font-medium">Valid Until</span>
                <span className={`font-bold ${status.is_expiring_soon ? "text-amber-700" : ""}`}>
                  {safeFormat(status.valid_until, "MMM d, yyyy")}
                  {status.days_until_expiry != null && status.days_until_expiry >= 0 && (
                    <span className="font-normal text-muted-foreground"> ({status.days_until_expiry}d left)</span>
                  )}
                </span>
              </div>
            )}
          </div>
        </section>
      )}


      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground px-1">Issuance History</h2>
        <div className="space-y-2">
          {issuances?.map(issuance => (
            <div key={issuance.id} className="bg-card border border-border p-4 rounded-[12px] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{issuance.pack_label || "Standard Pack"}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {safeFormat(issuance.issued_at, "MMM d, yyyy")}
                </div>
              </div>
              <div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(issuance.status)}`}>
                  {issuance.status || "Unknown"}
                </span>
              </div>
            </div>
          ))}
          {(!issuances || issuances.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No pack issuances found.</p>
          )}
        </div>
      </section>
    </motion.div>
  );
}
