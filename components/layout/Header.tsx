"use client";

import React, { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { useAuth } from "@/lib/shared";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";

interface HeaderProps {
  title: string;
  onToggleMobile: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onToggleMobile }) => {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!user) return null;

  const initials = (user.email ?? "V")
    .split("@")[0]
    .split(/[._-]/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="h-14 bg-page-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-page-bg/70 border-b border-border shadow-[0_1px_0_rgba(255,255,255,0.7)] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 hover:bg-table-header rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="display-serif text-2xl text-text-primary tracking-tight truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <button
          onClick={() => setShowNotifications(true)}
          className="relative w-9 h-9 flex items-center justify-center hover:bg-table-header rounded-xl transition-colors"
          aria-label="Open notifications"
        >
          <Bell className="w-[18px] h-[18px] text-text-secondary" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="menu"
            aria-expanded={showUserMenu}
            className="flex items-center gap-2 pl-1.5 pr-2 lg:pr-3 py-1 hover:bg-table-header rounded-xl border border-transparent hover:border-border transition-colors"
          >
            <div className="w-8 h-8 bg-[linear-gradient(180deg,#0E3F82,#072D62)] rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-accent-gold/40 shadow-[var(--shadow-soft)]">
              {initials || "V"}
            </div>
            <span className="text-sm font-medium text-text-primary hidden sm:inline">
              {user.email}
            </span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-card-bg border border-card-border rounded-xl shadow-[var(--shadow-lift)] z-20 py-1 animate-dropdown-in overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-border bg-page-bg/60">
                  <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate mt-0.5">{user.email}</p>
                  <p className="text-xs text-text-muted capitalize">{user.role.replace(/_/g, " ").toLowerCase()}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={async () => { setShowUserMenu(false); await logout(); }}
                  className="w-full px-4 py-2.5 text-sm text-danger hover:bg-danger/5 text-left transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <NotificationDrawer
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </header>
  );
};
