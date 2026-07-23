import { Link, useLocation } from "wouter";
import { ArrowRight, Activity, Users, Package, ClipboardCheck, Smartphone, Target, Mail, MapPin, SearchCheck, CheckCircle2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function Home() {
  const [, navigate] = useLocation();

  const [contactForm, setContactForm] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <header className="px-6 py-6 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-background/80 backdrop-blur z-50 border-b border-border/40">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm p-1">
            <img src="logo.png" alt="NutriMyWay Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground">NutriMyWay</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="#features"
            className="hidden md:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#contact"
            className="hidden md:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Contact
          </a>
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

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center w-full max-w-4xl mx-auto py-20 md:py-32">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
          Application Provider for <span className="text-primary bg-primary/10 px-2 rounded-lg inline-block mt-2">Center Management & HealthLogix</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
          NutriMyWay provides robust solutions for comprehensive Center Management and HealthLogix, tailored for individual health enthusiasts. Take control of your wellness journey today.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="h-14 px-8 rounded-2xl text-lg font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="h-14 px-8 rounded-2xl text-lg font-semibold shadow-sm hover:bg-muted active:scale-[0.98] transition-all"
          >
            Learn More
          </Button>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="w-full bg-muted/30 py-20 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-6">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Empowering Wellness Centers</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">Comprehensive tools designed to streamline operations and enhance member experiences for health and wellness centers.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Member Management"
              description="Easily onboard new members, track subscriptions, and manage profiles from a centralized admin dashboard."
            />
            <FeatureCard 
              icon={<SearchCheck className="w-6 h-6" />}
              title="Meal Log Monitoring"
              description="Review daily meal logs of your members in real-time, tracking their calorie and macronutrient intake accurately."
            />
            <FeatureCard 
              icon={<Package className="w-6 h-6" />}
              title="Inventory & Consumption"
              description="Manage ingredient inventory, track daily consumption, and seamlessly organize material packs for food preparation."
            />
            <FeatureCard 
              icon={<ClipboardCheck className="w-6 h-6" />}
              title="Batch Management"
              description="Organize and monitor food preparation batches efficiently, ensuring quality and exact macronutrient tracking."
            />
            <FeatureCard 
              icon={<MapPin className="w-6 h-6" />}
              title="Check-ins & Attendance"
              description="Track member attendance and daily check-ins to monitor center engagement and consistency."
            />
          </div>

          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Your Personal Health Companion</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">The NutriMyWay Member App puts your nutritional journey in the palm of your hand.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Activity className="w-6 h-6" />}
              title="Daily Meal Logging"
              description="Log your breakfast, lunch, and dinner effortlessly. Track your exact macros including protein, calories, and fiber."
            />
            <FeatureCard 
              icon={<Target className="w-6 h-6" />}
              title="Goal Tracking"
              description="Set personal health targets and visualize your progress daily through an intuitive personal dashboard."
            />
            <FeatureCard 
              icon={<Smartphone className="w-6 h-6" />}
              title="Center Sync"
              description="Stay directly connected to your wellness center. View center announcements, menus, and personalized plans."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Subscription Management"
              description="Manage your active subscriptions, update your profile details, and maintain control of your health data."
            />
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="w-full py-24 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Get In Touch</h2>
            <p className="text-muted-foreground text-lg mb-2">Have questions about our solutions? We'd love to hear from you.</p>
            <div className="flex items-center justify-center gap-2 text-primary font-medium bg-primary/5 w-fit mx-auto px-4 py-2 rounded-full">
              <Mail className="w-4 h-4" />
              <a href="mailto:support@nutrimyway.com" className="hover:underline">support@nutrimyway.com</a>
            </div>
          </div>

          <div className="bg-card border border-border shadow-sm rounded-3xl p-6 md:p-10 max-w-2xl mx-auto">
            <form onSubmit={handleContactSubmit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                  <Input 
                    id="name" 
                    placeholder="John Doe" 
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="h-12 bg-background"
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
                    className="h-12 bg-background"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-sm font-medium text-foreground">How can we help?</label>
                <Textarea 
                  id="message" 
                  placeholder="Tell us about your center or inquiry..." 
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="resize-none bg-background py-3"
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                disabled={isSubmitting}
                className="w-full h-12 mt-2 rounded-xl text-base font-semibold"
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-muted/50 border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="logo.png" alt="NutriMyWay" className="w-6 h-6 object-contain" />
            <span className="font-semibold text-foreground tracking-tight">NutriMyWay</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm text-muted-foreground">Powered by Nutrition My Way</span>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col gap-4 p-6 rounded-3xl bg-card border border-border/60 shadow-sm hover:shadow-md transition-all hover:border-primary/20 group">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-lg mb-2 text-card-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
