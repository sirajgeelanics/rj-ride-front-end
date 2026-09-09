"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { useAuth, useLanguageStore, t } from "@/lib/shared";
import { NAV_ITEMS } from "@/components/layout/Sidebar";

const ROLE_LABEL: Record<string, string> = {
  AGENCY_ADMIN: "Agency Admin",
  VENDOR_MANAGER: "Vendor Manager",
  DRIVER: "Driver",
};

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const language = useLanguageStore((s) => s.language);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const pathname = usePathname();

  // The active sidebar module — shown in place of the old "RIDE" wordmark.
  const activeItem =
    NAV_ITEMS.find((i) => i.href === pathname) ??
    NAV_ITEMS.find((i) => i.href !== "/" && pathname.startsWith(i.href));
  const moduleName = activeItem ? t(activeItem.labelKey, language) : "";

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : ((user?.email ?? "Op").split("@")[0] ?? "Op").slice(0, 2).toUpperCase();

  const roleLabel = user?.role ? (ROLE_LABEL[user.role] ?? user.role) : undefined;

  return (
    // FL8 header: sticky, compact (h-14), hairline bottom border, translucent cream with backdrop blur.
    <header className="h-14 border-b border-border bg-ops-bg/80 backdrop-blur supports-[backdrop-filter]:bg-ops-bg/70 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold text-text-primary">{moduleName}</h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        <Link
          href="/availability"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-sm font-medium text-text-secondary hover:bg-ops-card2 hover:text-text-primary transition-colors"
          title="Fleet availability — synced to RITMO automatically"
        >
          <Radio className="w-4 h-4 text-brand-wine" />
          Availability
        </Link>

        {/* Profile — dropdown menu matching the vendor portal's Header pattern. */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="group flex items-center gap-2 px-2 lg:px-3 py-1.5 cursor-pointer hover:bg-ops-card2 rounded-md transition-colors"
          >
            <div
              className="w-8 h-8 bg-brand-wine rounded-full flex items-center justify-center text-white text-xs font-semibold
                         ring-2 ring-white shadow-sm transition-all duration-150
                         group-hover:ring-brand-wine/30 group-hover:ring-offset-2 group-hover:ring-offset-ops-bg group-hover:shadow-md group-hover:scale-105"
            >
              {initials || "Op"}
            </div>
            <span className="text-sm font-medium text-text-primary hidden sm:inline">
              {user?.email}
            </span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-ops-card border border-border rounded-lg shadow-lg z-20 py-1">
                <div className="px-4 py-2 border-b border-border space-y-1">
                  <p className="text-xs text-text-tertiary">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate">{user?.email}</p>
                  {roleLabel && <p className="text-xs text-text-tertiary">{roleLabel}</p>}
                </div>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                  }}
                  className="w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 text-left transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

TopBar.displayName = "TopBar";
