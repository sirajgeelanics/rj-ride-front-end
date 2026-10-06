"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Radio } from "lucide-react";
import { useAuth, useLanguageStore, t } from "@/lib/shared";
import { NAV_ITEMS } from "@/components/layout/Sidebar";
import { FleetImportMenu } from "@/components/layout/FleetImportMenu";

const ROLE_LABEL: Record<string, string> = {
  AGENCY_ADMIN: "Agency Admin",
  VENDOR_MANAGER: "Vendor Manager",
  DRIVER: "Driver",
};

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
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
    // Glass header: sticky, hairline bottom border, translucent cream with backdrop blur.
    <header className="h-16 border-b border-border/70 glass flex items-center justify-between px-3 sm:px-5 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-text-secondary hover:bg-ops-card2 hover:text-text-primary transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl lg:text-[1.9rem] font-medium tracking-tight text-text-primary truncate">{moduleName}</h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        {user?.role !== "DRIVER" && <FleetImportMenu />}
        <Link
          href="/availability"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg h-9 border border-border bg-white text-sm font-medium text-text-secondary shadow-soft hover:bg-ops-card2 hover:text-text-primary hover:border-[#C9CDD4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          title="Fleet availability — synced to RITMO automatically"
        >
          <Radio className="w-4 h-4 text-accent-gold" />
          <span className="hidden sm:inline">Availability</span>
        </Link>

        {/* Profile — dropdown menu matching the vendor portal's Header pattern. */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className="group flex items-center gap-2 pl-1.5 pr-2 lg:pr-3 py-1 cursor-pointer bg-white border border-border rounded-xl shadow-soft hover:border-[#C9CDD4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            <div
              className="w-8 h-8 bg-gradient-to-br from-[#0E3F82] to-brand-wine rounded-lg flex items-center justify-center text-white text-xs font-semibold
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] transition-transform duration-150 group-hover:scale-105"
            >
              {initials || "Op"}
            </div>
            <span className="text-sm font-medium text-text-primary hidden sm:inline max-w-[11rem] truncate">
              {user?.email}
            </span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-lift z-20 py-1 animate-menu-in">
                <div className="px-4 py-3 border-b border-ops-line space-y-1">
                  <p className="eyebrow !text-[10px]">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate">{user?.email}</p>
                  {roleLabel && <p className="text-xs text-accent-gold font-medium">{roleLabel}</p>}
                </div>
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logout();
                  }}
                  role="menuitem"
                  className="w-full px-4 py-2.5 text-sm text-danger hover:bg-danger-soft text-left transition-colors"
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
