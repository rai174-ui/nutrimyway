import { useLocation } from "wouter";
import { LayoutDashboard, UtensilsCrossed, BarChart3, Settings, LogOut, Users, ClipboardList, Boxes } from "lucide-react";
import { clearAuth, getAdminCenter } from "@/lib/api";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/members", label: "Members", icon: Users },
  { path: "/logs", label: "Logs", icon: ClipboardList },
  { path: "/open-batches", label: "Open Batches", icon: UtensilsCrossed },
  { path: "/consumption", label: "Consumption", icon: BarChart3 },
  { path: "/inventory", label: "Inventory", icon: Boxes },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const [location, navigate] = useLocation();
  const center = getAdminCenter();

  function handleLogout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <header className="bg-teal-dark text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <div className="flex items-center gap-2 mr-4">
          <img src="/admin/logo.png" alt="NutriMyWay" className="w-7 h-7 rounded-md object-contain" />
          <span className="font-bold text-sm tracking-tight leading-tight">
            NutriMyWay<br />
            <span className="font-normal text-teal-light text-xs">{center?.name ?? "Admin"}</span>
          </span>
        </div>

        <nav className="flex items-center gap-1 flex-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                location === path
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors ml-auto"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </header>
  );
}

