import { Link, useLocation } from "wouter";
import { ArrowRight, Users, Package, ClipboardCheck, Megaphone, Smartphone, Target, Mail, SearchCheck, CheckCircle2, HeartPulse } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function Home() {
  const [, navigate] = useLocation();

  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: latestArticles } = useQuery({
    queryKey: ["latest-wellness-articles"],
    queryFn: async () => {
      const res = await fetch("/api/wellness-articles?limit=3");
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json() as Promise<Array<{
        id: number;
        title: string;
        link: string;
        source: string;
        image_url: string;
      }>>;
    }
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      toast.error("Please fill in all fields.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      
      if (res.ok) {
        toast.success("Thank you! Your inquiry has been sent.");
        setContactForm({ name: "", email: "", message: "" });
        setIsDialogOpen(false);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to send inquiry. Please try again.");
      }
    } catch (err) {
      toast.error("Network error. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <SEO />
      
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-background/80 backdrop-blur z-50 border-b border-border/40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1">
            <img src="logo.png" alt="NutriMyWay Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">NutriMyWay</span>
        </div>
        <div className="flex items-center gap-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="hidden md:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Get In Touch</DialogTitle>
                <DialogDescription>
                  Have questions about our solutions? We'd love to hear from you.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleContactSubmit} className="flex flex-col gap-4 mt-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="john@example.com" 
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="message" className="text-sm font-medium text-foreground">How can we help?</label>
                  <Textarea 
                    id="message" 
                    placeholder="Tell us about your center or inquiry..." 
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="resize-none"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full h-11 mt-2"
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Link
            href="/wellness-trends"
            className="hidden lg:block text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Health, Nutrition & Wellness
          </Link>

          <a
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Member Login
          </a>
          <a
            href="/admin"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Center Login
          </a>
        </div>
      </header>

      {/* Primary Section / Hero (Focusing on Center Management) */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center w-full max-w-4xl mx-auto py-12 md:py-16">
        <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-3">Application Provider for Centers</h2>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
          Empowering Your <span className="text-primary bg-primary/10 px-2 rounded-lg inline-block mt-1">Wellness Center</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          Gain unparalleled visibility into your members' nutritional journeys. Instantly track meal logs, seamlessly broadcast announcements, and effortlessly manage subscriptions all from one powerful, centralized dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => { window.location.href = "/admin"; }}
            className="h-12 px-8 rounded-xl text-base font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Access Center Console <ArrowRight className="w-4 h-4" />
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 rounded-xl text-base font-semibold shadow-sm hover:bg-muted active:scale-[0.98] transition-all flex items-center gap-2 text-foreground"
              >
                <Mail className="w-4 h-4 text-muted-foreground" /> Send Inquiry
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </main>

      {/* Center Console Features Section */}
      <section className="w-full bg-muted/30 py-12 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<SearchCheck className="w-5 h-5" />}
              title="Member Meal Visibility"
              description="Review daily meal logs of your members in real-time, tracking their calorie and macronutrient intake."
            />
            <FeatureCard 
              icon={<Megaphone className="w-5 h-5" />}
              title="Instant Broadcasts"
              description="Easily send center-wide announcements, menu updates, and motivational messages straight to members."
            />
            <FeatureCard 
              icon={<Users className="w-5 h-5" />}
              title="Subscription Management"
              description="Seamlessly onboard new members, track active subscriptions, and manage individual user profiles."
            />
            <FeatureCard 
              icon={<ClipboardCheck className="w-5 h-5" />}
              title="Inventory & Batches"
              description="Monitor ingredient inventory and organize food preparation batches efficiently for optimal quality."
            />
          </div>
        </div>
      </section>

      {/* Member App / Companion Section (Bottom) */}
      <section className="w-full bg-primary/5 py-12 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-2">For Your Members</h2>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Their Personal Health Companion</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">We provide a dedicated mobile application for your members to interact directly with your wellness center's services.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <FeatureCard 
              icon={<Target className="w-5 h-5" />}
              title="Daily Meal Logging"
              description="Members can easily log their breakfast, lunch, and dinner to track exact macros and calories."
            />
            <FeatureCard 
              icon={<Smartphone className="w-5 h-5" />}
              title="Center Sync & Announcements"
              description="Members stay connected by receiving your broadcasted menus, alerts, and personalized nutrition plans."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Goal Tracking"
              description="Members can set personal health targets and visualize their progress directly on their dashboard."
            />
          </div>
          
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => navigate("/login")}
              variant="outline"
              size="lg"
              className="h-12 px-8 rounded-xl text-base font-semibold shadow-sm hover:bg-muted active:scale-[0.98] transition-all bg-background border-primary/20 hover:border-primary/40"
            >
              Preview Member Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Latest Wellness Trends Preview */}
      <section className="w-full bg-background py-16 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
            <div>
              <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-2 flex items-center gap-2">
                <HeartPulse className="w-4 h-4" /> Wellness Trends
              </h2>
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Stay Informed & Healthy</h3>
            </div>
            <Link href="/wellness-trends">
              <Button variant="outline" className="rounded-xl flex items-center gap-2">
                View all articles <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {!latestArticles || latestArticles.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex flex-col gap-3">
                  <div className="w-full aspect-video bg-muted rounded-xl" />
                  <div className="h-6 w-3/4 bg-muted rounded mt-2" />
                  <div className="h-4 w-1/4 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestArticles.map(article => (
                <a 
                  key={article.id} 
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-xl overflow-hidden border bg-card text-card-foreground shadow-sm hover:shadow-md transition-all hover:border-primary/50"
                >
                  {article.image_url ? (
                    <div className="w-full aspect-video overflow-hidden bg-muted relative">
                      <img 
                        src={article.image_url} 
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video bg-primary/5 group-hover:bg-primary/10 transition-colors flex items-center justify-center text-primary/40">
                      <HeartPulse className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-grow">
                    <span className="text-xs font-medium text-primary bg-primary/10 w-fit px-2 py-1 rounded-md mb-3">
                      {article.source}
                    </span>
                    <h4 className="font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h4>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-background mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="logo.png" alt="NutriMyWay" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-foreground tracking-tight text-sm">NutriMyWay</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-muted-foreground">Powered by Nutrition My Way</span>
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <a href="mailto:support@nutrimyway.com" className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              support@nutrimyway.com
            </a>
          </div>
        </div>
      </footer>

      {/* Floating HealthLogix Button */}
      <Button
        onClick={() => window.open("https://HealthLogix.nutrimyway.in", "_blank")}
        className="fixed bottom-6 right-6 z-50 shadow-xl rounded-full px-6 h-12 bg-[#000080] hover:bg-[#000060] text-white flex items-center gap-2 hover:scale-105 transition-all duration-300"
      >
        <HeartPulse className="w-5 h-5" />
        <span className="font-semibold tracking-wide">Personalised Health Tracking</span>
      </Button>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all hover:border-primary/20 group h-full">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-base mb-1 text-card-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
