import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface AuthState {
  token: string | null;
  memberId: number | null;
}

interface AuthContextValue {
  token: string | null;
  memberId: number | null;
  isAuthenticated: boolean;
  login: (token: string, memberId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "nmw_auth";

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, memberId: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, memberId: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  // Wire token getter into the API client once on mount
  useEffect(() => {
    setAuthTokenGetter(() => state.token);
  }, [state.token]);

  const login = useCallback((token: string, memberId: number) => {
    const next = { token, memberId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setState(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ token: null, memberId: null });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token: state.token,
        memberId: state.memberId,
        isAuthenticated: !!state.token && !!state.memberId,
        login,
        logout,
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
