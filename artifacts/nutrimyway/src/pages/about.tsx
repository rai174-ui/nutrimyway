import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronLeft, Leaf, HeartPulse, UtensilsCrossed, BarChart2, ShieldCheck, Zap, Mail, Globe } from "lucide-react";

const fade = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const features = [
  {
    icon: UtensilsCrossed,
    title: "Meal Logging",
    desc: "Log meals by slot — breakfast, lunch, snack, dinner — with your personalised nutrition plan pre-filled.",
  },
  {
    icon: BarChart2,
    title: "Macro Tracking",
    desc: "Track calories, protein, carbs and fat daily with visual progress rings and macro chips.",
  },
  {
    icon: HeartPulse,
    title: "Health Monitoring",
    desc: "Record weight, BMI, body fat and other metrics. Visualise trends with easy-to-read charts.",
  },
  {
    icon: ShieldCheck,
    title: "Nutrition Plans",
    desc: "Follow plans issued by your wellness centre — view progress, history and current plan details.",
  },
  {
    icon: Zap,
    title: "Centre Integration",
    desc: "Stay connected with your wellness centre — view visit history, health records and centre news.",
  },
];

export function About() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative bg-teal-dark text-white px-5 pt-14 pb-10 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/5" />
        <div className="absolute bottom-0 -left-12 w-44 h-44 rounded-full bg-white/5" />
        <button
          onClick={() => navigate("/profile")}
          className="relative z-10 flex items-center gap-1 text-white/70 hover:text-white text-sm mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <motion.div
          {...fade}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex flex-col items-center text-center gap-3"
        >
          <div className="w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-lg p-3">
            <img src="logo.png" alt="NutriMyWay" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">NutriMyWay</h1>
            <p className="text-white/70 text-sm mt-1">Your personal nutrition companion</p>
          </div>
        </motion.div>
      </div>

      <div className="px-5 py-6 space-y-8 max-w-[400px] mx-auto pb-24">
        {/* Mission */}
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Our Mission</h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            NutriMyWay empowers wellness centre members to take control of their health journey —
            making nutrition tracking simple, personalised, and connected to the care team that supports them.
          </p>
        </motion.section>

        {/* Features */}
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.1 }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Features</h2>
          </div>
          <div className="space-y-3">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3 bg-card border border-border rounded-2xl p-4">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Developer */}
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.15 }}>
          <div className="bg-card border border-border rounded-2xl p-5 text-center space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Developed by</p>
            <p className="text-lg font-bold text-foreground">Zero Limit Automation</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Application development · Business IT consulting · Process automation
            </p>
            <div className="border-t border-border pt-3 space-y-2">
              <a
                href="mailto:info@zerolimitautomation.com"
                className="flex items-center justify-center gap-2 text-xs text-primary hover:underline"
              >
                <Mail className="w-3.5 h-3.5" /> info@zerolimitautomation.com
              </a>
              <a
                href="https://zerolimitautomation.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-primary hover:underline"
              >
                <Globe className="w-3.5 h-3.5" /> zerolimitautomation.com
              </a>
            </div>
          </div>
        </motion.section>

        {/* Version */}
        <motion.section {...fade} transition={{ duration: 0.4, delay: 0.2 }}>
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
            <p className="text-[10px] text-muted-foreground/60">© {new Date().getFullYear()} Zero Limit Automation. All rights reserved.</p>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
