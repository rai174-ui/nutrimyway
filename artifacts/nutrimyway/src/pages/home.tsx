import { Link, useLocation } from "wouter";
import { ArrowRight, Leaf, Shield, UserCheck } from "lucide-react";

export function Home() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="px-6 py-6 flex justify-between items-center max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1">
            <img src="logo.png" alt="NutriMyWay Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">NutriMyWay</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="/admin"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin Login
          </a>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Member Login
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center w-full max-w-3xl mx-auto py-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
          Your Personal Journey to <span className="text-primary">Better Health</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
          NutriMyWay helps you track your meals, analyze your nutrition, and stay connected with your wellness center. Take control of your habits today.
        </p>

        <button
          onClick={() => navigate("/login")}
          className="h-14 px-8 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"
        >
          Get Started <ArrowRight className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Leaf className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg">Smart Tracking</h3>
            <p className="text-sm text-muted-foreground">Log your meals effortlessly and get instant insights into your daily nutrition and macronutrients.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg">Center Connection</h3>
            <p className="text-sm text-muted-foreground">Stay synced with your wellness center for personalized plans, updates, and progress monitoring.</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg">Data Privacy</h3>
            <p className="text-sm text-muted-foreground">Your health data is secure and yours to control. We prioritize your privacy at every step.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center border-t border-border mt-auto">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground/80">Powered by Nutrition My Way</span>
          <Link href="/privacy" className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
