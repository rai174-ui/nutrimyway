import { Link, useLocation } from "wouter";
import { ArrowRight, Activity, Users, Package, ClipboardCheck, Smartphone, Target, Mail, MapPin, SearchCheck, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useState } from "react";
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

          <a
            href="/admin"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Center Login
          </a>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Member Login
          </button>
        </div>
      </header>

      {/* Primary Section / Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center w-full max-w-4xl mx-auto py-12 md:py-16">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
          Your Personal <span className="text-primary bg-primary/10 px-2 rounded-lg inline-block mt-1">Health Companion</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
          The NutriMyWay Member App puts your nutritional journey in the palm of your hand. Log meals, track macros, and stay connected with your wellness center.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="h-12 px-8 rounded-xl text-base font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Member Login <ArrowRight className="w-4 h-4" />
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

      {/* Member App Features Section */}
      <section className="w-full bg-muted/30 py-12 border-t border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard 
              icon={<Activity className="w-5 h-5" />}
              title="Daily Meal Logging"
              description="Log your breakfast, lunch, and dinner effortlessly. Track your exact macros."
            />
            <FeatureCard 
              icon={<Target className="w-5 h-5" />}
              title="Goal Tracking"
              description="Set personal health targets and visualize your progress daily."
            />
            <FeatureCard 
              icon={<Smartphone className="w-5 h-5" />}
              title="Center Sync"
              description="Stay directly connected to your wellness center and personalized plans."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Subscriptions"
              description="Manage active subscriptions, update profile details, and control data."
            />
          </div>
        </div>
      </section>

      {/* Center Console / Application Provider Section (Bottom) */}
      <section className="w-full bg-primary/5 py-12 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold tracking-widest text-primary uppercase mb-2">Application Provider</h2>
            <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Empowering Wellness Centers</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">Comprehensive tools designed to streamline operations and enhance member experiences for health and wellness centers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <FeatureCard 
              icon={<Users className="w-5 h-5" />}
              title="Member Management"
              description="Easily onboard new members, track subscriptions, and manage profiles."
            />
            <FeatureCard 
              icon={<SearchCheck className="w-5 h-5" />}
              title="Meal Log Monitoring"
              description="Review daily meal logs of your members in real-time."
            />
            <FeatureCard 
              icon={<Package className="w-5 h-5" />}
              title="Inventory"
              description="Manage ingredient inventory and track daily consumption seamlessly."
            />
            <FeatureCard 
              icon={<ClipboardCheck className="w-5 h-5" />}
              title="Batch Management"
              description="Organize and monitor food preparation batches efficiently."
            />
            <FeatureCard 
              icon={<MapPin className="w-5 h-5" />}
              title="Attendance"
              description="Track member attendance and daily check-ins to monitor engagement."
            />
          </div>
          
          <div className="flex justify-center mt-4">
            <Button
              onClick={() => navigate("/admin")}
              variant="default"
              size="lg"
              className="h-12 px-8 rounded-xl text-base font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              Access Center Console
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-background border-t border-border">
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
