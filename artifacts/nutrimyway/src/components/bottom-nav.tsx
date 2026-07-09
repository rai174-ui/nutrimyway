import { Link, useLocation } from "wouter";
import { Home, Plus, HeartPulse, User } from "lucide-react";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/log", label: "Log", icon: Plus },
    { href: "/center", label: "My Health", icon: HeartPulse },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-card border-t border-border pb-safe z-50" style={{boxShadow: '0 -4px 16px rgba(0,0,0,0.08)'}}>
      <div className="max-w-[400px] mx-auto h-16 flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div className={`flex flex-col items-center justify-center py-2 cursor-pointer rounded-xl transition-all ${
                isActive 
                  ? 'text-primary bg-primary/8' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
                <item.icon className="w-6 h-6 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
