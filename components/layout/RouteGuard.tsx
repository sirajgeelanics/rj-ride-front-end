"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, useAuth } from "@/lib/shared";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useSession();
  const { logout } = useAuth();
  const router = useRouter();

  // The admin portal is AGENCY_ADMIN-only. A vendor/driver authenticates fine against the shared
  // backend, so gate the UI here too (backend admin APIs are already IsAgencyAdmin-gated).
  const isAdmin = user?.role === "AGENCY_ADMIN";

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ops-bg">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-ops-bg px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold text-text-primary">Access denied</h1>
          <p className="text-sm text-text-secondary">
            This is the agency admin portal. Your account
            {user?.email ? <> (<span className="font-medium text-text-primary">{user.email}</span> — {user?.role})</> : null}{" "}
            does not have admin access. Vendor accounts should use the vendor portal.
          </p>
          <button
            onClick={() => {
              void logout().finally(() => router.replace("/login"));
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-wine text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
