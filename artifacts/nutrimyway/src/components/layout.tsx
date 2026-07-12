import { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center font-sans">
      <main className="w-full max-w-[400px] flex-1 pb-20 relative bg-background">
        {children}
      </main>
      <div className="w-full text-center py-2 text-[10px] text-muted-foreground/60 flex flex-col items-center gap-1">
        <span>Powered by Nutrition My Way</span>
      </div>
      <BottomNav />
    </div>
  );
}
