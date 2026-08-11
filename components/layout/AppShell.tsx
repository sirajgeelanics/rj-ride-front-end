"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Toaster } from "@/components/ui/Toaster";
import { RouteGuard } from "./RouteGuard";

const AUTH_PATHS = ["/login"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

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
      <div className="flex h-screen bg-ops-bg">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto bg-ops-bg bg-ops-grid">{children}</main>
        </div>
      </div>
      <Toaster />
    </RouteGuard>
  );
}
