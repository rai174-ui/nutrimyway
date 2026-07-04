import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { initPushNotifications } from "@/lib/capacitor";

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
  const [state, setState] = useState<AuthState>(loadState);

  // Wire token getter into the API client once on mount
  useEffect(() => {
    setAuthTokenGetter(() => state.token);
  }, [state.token]);

  const login = useCallback((token: string, memberId: number, needsTermsAcceptance = false) => {
    const next = { token, memberId, needsTermsAcceptance };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
    // Register push token after login
    const base = import.meta.env.VITE_API_BASE || "/api";
    setTimeout(() => initPushNotifications(memberId, base), 1000);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ token: null, memberId: null, needsTermsAcceptance: false });
  }, []);

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
