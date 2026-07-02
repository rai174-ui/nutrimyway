import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import SetMenuPage from "@/pages/set-menu";
import ConsumptionPage from "@/pages/consumption";
import SettingsPage from "@/pages/settings";
import SuperPage from "@/pages/super";
import MembersPage from "@/pages/members";
import LogsPage from "@/pages/logs";
import InventoryPage from "@/pages/inventory";
import { isAuthenticated } from "@/lib/api";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isAuthenticated()) navigate("/login");
  }, [navigate]);
  if (!isAuthenticated()) return null;
  return <>{children}</>;
}

function CatchAll() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(isAuthenticated() ? "/dashboard" : "/login");
  }, [navigate]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/super" component={SuperPage} />
      <Route path="/dashboard">
        <AuthGuard><DashboardPage /></AuthGuard>
      </Route>
      <Route path="/set-menu">
        <AuthGuard><SetMenuPage /></AuthGuard>
      </Route>
      <Route path="/consumption">
        <AuthGuard><ConsumptionPage /></AuthGuard>
      </Route>
      <Route path="/settings">
        <AuthGuard><SettingsPage /></AuthGuard>
      </Route>
      <Route path="/members">
        <AuthGuard><MembersPage /></AuthGuard>
      </Route>
      <Route path="/logs">
        <AuthGuard><LogsPage /></AuthGuard>
      </Route>
      <Route path="/inventory">
        <AuthGuard><InventoryPage /></AuthGuard>
      </Route>
      <Route component={CatchAll} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <div className="min-h-screen flex flex-col">
          <div className="flex-1">
            <Router />
          </div>
          <div className="text-center py-2 text-[10px] text-muted-foreground/60">
            Powered by Zero Limit Automation
          </div>
        </div>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
