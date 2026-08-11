"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/shared";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useSession();
  const router = useRouter();

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

  return <>{children}</>;
}
