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
import { Home } from "@/pages/home";
import { Privacy } from "@/pages/privacy";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { ConsentModal } from "@/components/consent-modal";
import { initApiBase } from "@/lib/api-base";
import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";

initApiBase();

interface EBState { hasError: boolean; message: string }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): EBState {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: "center", marginTop: 60 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Something went wrong</p>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>{this.state.message}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, message: "" });
              window.location.reload();
            }}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              background: "#0F6E56",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: unknown }).status;
        if (typeof status === "number" && status >= 400 && status < 500) {
          return false;
        }
        return failureCount < 1;
      },
      staleTime: 30000,
    },
  },
});

function ProtectedRouter() {
  const { isAuthenticated, needsTermsAcceptance, markTermsAccepted } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (needsTermsAcceptance) {
    return <ConsentModal onAccepted={markTermsAccepted} endpoint="/auth/accept-terms" />;
  }

  return (
    <Layout>
      <Switch>
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

function MainRouter() {
  const { isAuthenticated } = useAuth();
  return (
    <Switch>
      <Route path="/" component={() => (isAuthenticated ? <Redirect to="/dashboard" /> : <Home />)} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/login" component={() => (isAuthenticated ? <Redirect to="/dashboard" /> : <Login />)} />
      <Route path="/:rest*">
        <ProtectedRouter />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <MainRouter />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
