"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Toaster } from "@/components/ui/Toaster";
import { RouteGuard } from "./RouteGuard";

const AUTH_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isAuthPage) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  return (
    <RouteGuard>
      <div className="flex h-screen bg-ops-bg overflow-x-hidden">
        <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden bg-ops-bg bg-ops-grid">{children}</main>
        </div>
      </div>
      <Toaster />
    </RouteGuard>
  );
}
