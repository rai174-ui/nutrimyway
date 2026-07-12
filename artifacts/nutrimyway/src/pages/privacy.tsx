import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-2xl bg-card rounded-2xl p-6 md:p-10 shadow-sm border border-border">
        <Link href="/login" className="inline-flex items-center text-sm text-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>Welcome to NutriMyWay. Your privacy is important to us. This policy explains how we collect, use, and protect your information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">2. Information We Collect</h2>
            <p>We collect information you provide directly, such as your name, email, membership details, and any health/nutrition logs you create within the app.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">3. Storage of Data</h2>
            <p>Your personal data and meal logs are stored securely on our servers using industry-standard encryption. Data is kept as long as your account is active to provide you with continuous service and historical tracking.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">4. Data Deletion Option</h2>
            <p>You have the right to request the deletion of your personal data. If you wish to delete your account and all associated data, you can do so by contacting your wellness center administrator or reaching out to our support team. Upon your request, your personal data will be permanently deleted from our active databases within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">5. How We Use Information</h2>
            <p>We use the data to provide and improve the NutriMyWay experience, personalizing your wellness journey and facilitating communication with your wellness center.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">6. Contact Us</h2>
            <p>If you have any questions or concerns about this policy or your data, please contact your center administrator or email support.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
