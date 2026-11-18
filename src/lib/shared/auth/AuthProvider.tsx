import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "../api/basePath";
import { csrfFetch, isApiError } from "../api/client";
import { keys } from "../api/query";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "AGENCY_ADMIN" | "VENDOR_MANAGER" | "DRIVER";
  vendor_id: string | null;
  phone: string;
  is_active: boolean;
  created_at: string;
  tenant: { id: string; name: string; currency: string };
}

type UserRole = AuthUser["role"];

interface SessionState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends SessionState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requireRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loginError, setLoginError] = useState<Error | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: keys.me(),
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/v1/auth/me/"), { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null;
        throw new Error(`/v1/auth/me ${res.status}`);
      }
      const body = (await res.json()) as { result: AuthUser };
      return body.result ?? null;
    },
    retry: (failureCount, error) => {
      if (isApiError(error) && error.status === 401) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      setLoginError(null);
      const csrfRes = await fetch(apiUrl("/api/v1/auth/csrf/"), { credentials: "include" });
      const csrfCookie = csrfRes.headers.get("X-CSRFToken") ?? (document.cookie.match(/csrftoken=([^;]+)/) ?? [])[1] ?? "";
      const res = await fetch(apiUrl("/api/v1/auth/login/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfCookie },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = new Error(`Login failed: ${res.status}`);
        setLoginError(err);
        throw err;
      }
      const body = (await res.json()) as { result?: AuthUser };
      if (body.result) {
        queryClient.setQueryData(keys.me(), body.result);
      }
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    // csrfFetch makes sure a CSRF cookie exists first and sends it; the response must be checked —
    // a refused sign-out used to be ignored, leaving the UI "signed out" over a live session.
    const res = await csrfFetch("/api/v1/auth/logout/", { method: "POST" });
    // 401: the session was already gone, which is the state we want.
    if (!res.ok && res.status !== 401) {
      throw new Error(
        res.status === 403
          ? "Sign out was refused (403). Open the portal from localhost, or add this address to the backend's trusted origins."
          : `Sign out failed (${res.status}). Please try again.`,
      );
    }
    queryClient.setQueryData(keys.me(), null);
    queryClient.clear();
  }, [queryClient]);

  const requireRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  useEffect(() => {
    void loginError;
  }, [loginError]);

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    requireRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used inside <AuthProvider>");
  return { user: ctx.user, isLoading: ctx.isLoading, isAuthenticated: ctx.isAuthenticated };
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function requireRole(...roles: UserRole[]): (user: AuthUser | null) => boolean {
  return (user) => {
    if (!user) return false;
    return roles.includes(user.role);
  };
}
