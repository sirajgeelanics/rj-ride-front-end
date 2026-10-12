import React, { createContext, useCallback, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function csrfToken(): string {
  return (document.cookie.match(/csrftoken=([^;]+)/) ?? [])[1] ?? "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me/", { credentials: "include" });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new Error(`/auth/me ${res.status}`);
      return ((await res.json()) as { result: AuthUser }).result ?? null;
    },
    staleTime: 60_000,
    retry: false,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await fetch("/api/v1/auth/csrf/", { credentials: "include" });
      const res = await fetch("/api/v1/auth/login/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken() },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Sign in failed. Please try again.");
      }
      const body = (await res.json()) as { result?: AuthUser };
      queryClient.setQueryData(["me"], body.result ?? null);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await fetch("/api/v1/auth/csrf/", { credentials: "include" }).catch(() => undefined);
    const res = await fetch("/api/v1/auth/logout/", {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRFToken": csrfToken() },
    });
    // 401 means the session was already gone, which is the state we want. Anything else means
    // the server still considers us signed in, so say so instead of pretending to sign out.
    if (!res.ok && res.status !== 401) {
      throw new Error(`Sign out failed (${res.status}). Please try again.`);
    }
    queryClient.setQueryData(["me"], null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    // A full navigation drops every in-memory trace of the session; relying on a re-render
    // after clearing the cache left the old user on screen.
    window.location.assign("/login");
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
