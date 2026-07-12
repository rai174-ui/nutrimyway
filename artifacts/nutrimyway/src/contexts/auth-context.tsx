import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { initPushNotifications } from "@/lib/capacitor";
import { getApiBase } from "@/lib/api-base";

interface AuthState {
  token: string | null;
  memberId: number | null;
  needsTermsAcceptance: boolean;
}

interface AuthContextValue {
  token: string | null;
  memberId: number | null;
  isAuthenticated: boolean;
  needsTermsAcceptance: boolean;
  login: (token: string, memberId: number, needsTermsAcceptance?: boolean) => void;
  logout: () => void;
  markTermsAccepted: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "nmw_auth";

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, memberId: null, needsTermsAcceptance: false };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return { token: null, memberId: null, needsTermsAcceptance: false, ...parsed };
  } catch {
    return { token: null, memberId: null, needsTermsAcceptance: false };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const initial = loadState();
    setAuthTokenGetter(() => initial.token);
    return initial;
  });

  const login = useCallback((token: string, memberId: number, needsTermsAcceptance = false) => {
    const next = { token, memberId, needsTermsAcceptance };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuthTokenGetter(() => token);
    setState(next);
    // Register push token after login
    setTimeout(() => initPushNotifications(memberId, getApiBase()), 1000);
  }, []);

  // Also register push token on app startup if user is already logged in
  // This handles the case where user installs a new APK without logging out
  useEffect(() => {
    if (state.token && state.memberId) {
      setTimeout(() => initPushNotifications(state.memberId!, getApiBase()), 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthTokenGetter(() => null);
    setState({ token: null, memberId: null, needsTermsAcceptance: false });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [logout]);

  const markTermsAccepted = useCallback(() => {
    setState(prev => {
      const next = { ...prev, needsTermsAcceptance: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        memberId: state.memberId,
        isAuthenticated: !!state.token && !!state.memberId,
        needsTermsAcceptance: state.needsTermsAcceptance,
        login,
        logout,
        markTermsAccepted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
