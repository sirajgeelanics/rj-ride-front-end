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
    <header className="h-14 bg-page-bg/80 backdrop-blur supports-[backdrop-filter]:bg-page-bg/70 border-b border-border flex items-center justify-between px-4 lg:px-5 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 hover:bg-table-header rounded-md transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-text-secondary" />
        </button>
        <h1 className="display-serif text-2xl text-text-primary tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        <button
          onClick={() => setShowNotifications(true)}
          className="relative p-2 hover:bg-table-header rounded-md transition-colors"
        >
          <Bell className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 lg:px-3 py-1.5 hover:bg-table-header rounded-md transition-colors"
          >
            <div className="w-7 h-7 bg-brand-blue rounded-full flex items-center justify-center text-white text-xs font-semibold">
              {initials || "V"}
            </div>
            <span className="text-sm font-medium text-text-primary hidden sm:inline">
              {user.email}
            </span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-card-bg border border-border rounded-lg shadow-lg z-20 py-1">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-xs text-text-muted">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate">{user.email}</p>
                  <p className="text-xs text-text-muted capitalize">{user.role.replace(/_/g, " ").toLowerCase()}</p>
                </div>
                <button
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
