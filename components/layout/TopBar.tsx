"use client";

import React from "react";
import Link from "next/link";
import { LogOut, Radio } from "lucide-react";
import { useAuth, useLanguageStore, t } from "@/lib/shared";
import { PII } from "@/components/ui/PII";
import { LanguageToggle } from "@/components/ui/LanguageToggle";

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const language = useLanguageStore((s) => s.language);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "Op";

  const handleLogout = async () => {
    await logout();
  };

  return (
    // FL8 header: sticky, compact (h-14), hairline bottom border, translucent cream with backdrop blur.
    <header className="h-14 border-b border-border bg-ops-bg/80 backdrop-blur supports-[backdrop-filter]:bg-ops-bg/70 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-text-tertiary font-mono">{t("rideTM", language)}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5 pl-3 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-brand-wine flex items-center justify-center text-white text-[11px] font-semibold">
            {initials}
          </div>
          {user?.email ? (
            <PII value={user.email} type="email" className="text-text-primary" />
          ) : (
            <span className="text-sm text-text-secondary">—</span>
          )}
          {user?.role && (
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">{user.role}</span>
          )}
          <button
            onClick={handleLogout}
            className="p-1.5 hover:bg-ops-card2 rounded-md transition-colors"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>

        <Link
          href="/availability"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-sm font-medium text-text-secondary hover:bg-ops-card2 hover:text-text-primary transition-colors"
          title="Fleet availability — synced to RITMO automatically"
        >
          <Radio className="w-4 h-4 text-brand-wine" />
          Availability
        </Link>

        <LanguageToggle />

        {user?.tenant?.id && (
          <div className="ml-1 px-2.5 py-1 bg-ops-card border border-border rounded-md text-[11px] text-text-secondary font-mono">
            {user.tenant.id}
          </div>
        )}
      </div>
    </header>
  );
};

TopBar.displayName = "TopBar";
