import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Context, type ReactNode } from "react";
import { api } from "../api";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, displayName?: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  confirmSessionExpired: () => void;
}

// Store the context on globalThis so Vite HMR re-evaluations reuse the same
// instance. Without this, hot reload creates a new context while mounted
// Providers still provide the old one, breaking useContext in children.
const authContextKey = "__hskAuthContext";
const globalWithAuth = globalThis as typeof globalThis & {
  [authContextKey]?: Context<AuthContextValue | undefined>;
};
const AuthContext =
  globalWithAuth[authContextKey] ??=
  createContext<AuthContextValue | undefined>(undefined);
const SESSION_MARKER = "hsk_session_active";
const UNAUTHORIZED_EVENT = "hsk:unauthorized";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hadSession = window.localStorage.getItem(SESSION_MARKER) === "1";
    api.getMe()
      .then((res) => {
        if (cancelled) return;
        setUser(res.data);
        if (res.data) {
          window.localStorage.setItem(SESSION_MARKER, "1");
        } else {
          window.localStorage.removeItem(SESSION_MARKER);
          if (hadSession) setSessionExpired(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        window.localStorage.removeItem(SESSION_MARKER);
        if (hadSession) setSessionExpired(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      window.localStorage.removeItem(SESSION_MARKER);
      setUser(null);
      setSessionExpired(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

 const login = useCallback(async (username: string, password: string) => {
   const res = await api.login(username, password);
   window.localStorage.setItem(SESSION_MARKER, "1");
   setSessionExpired(false);
   setUser(res.data);
   return res.data;
 }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const res = await api.register(email, password, displayName);
    window.localStorage.setItem(SESSION_MARKER, "1");
    setSessionExpired(false);
    setUser(res.data);
    return res.data;
  }, []);

 const logout = useCallback(async () => {
    window.localStorage.removeItem(SESSION_MARKER);
    setSessionExpired(false);
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const confirmSessionExpired = useCallback(() => {
    window.localStorage.removeItem(SESSION_MARKER);
    setSessionExpired(false);
  }, []);

 const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout, confirmSessionExpired }),
    [user, loading, sessionExpired, login, register, logout, confirmSessionExpired]
 );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Type guard for admin access */
export function isAdmin(user: AuthUser | null): boolean {
  return user?.isAdmin ?? false;
}
