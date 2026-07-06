import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import { Dashboard } from "@/pages/dashboard";
import { Log } from "@/pages/log";
import { Center } from "@/pages/center";
import { Profile } from "@/pages/profile";
import { Login } from "@/pages/login";
import { About } from "@/pages/about";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ConsentModal } from "@/components/consent-modal";
import { initApiBase } from "@/lib/api-base";

initApiBase();

const queryClient = new QueryClient();

function ProtectedRouter() {
  const { isAuthenticated, needsTermsAcceptance, markTermsAccepted } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  if (needsTermsAcceptance) {
    return <ConsentModal onAccepted={markTermsAccepted} endpoint="/auth/accept-terms" />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/log" component={Log} />
        <Route path="/center" component={Center} />
        <Route path="/profile" component={Profile} />
        <Route path="/about" component={About} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRouter />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
