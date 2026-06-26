import { useGetMember, getGetMemberQueryKey, useGetMemberIssuances, getGetMemberIssuancesQueryKey } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Package, Calendar, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

export function Profile() {
  const { memberId: MEMBER_ID, logout } = useAuth();

  const { data: member } = useGetMember(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberQueryKey(MEMBER_ID!) }
  });

  const { data: issuances } = useGetMemberIssuances(MEMBER_ID!, {
    query: { enabled: !!MEMBER_ID, queryKey: getGetMemberIssuancesQueryKey(MEMBER_ID!) }
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
            Member #{member?.id} <span className="text-border">•</span> {member?.height_cm} cm
          </p>
        </div>
      </header>

      <section className="bg-card rounded-[12px] p-5 border border-border">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 text-muted-foreground">Active Plan</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Target Calories</span>
              <span className="font-bold">2000 kcal</span>
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
                  {format(new Date(issuance.issued_at), "MMM d, yyyy")}
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
