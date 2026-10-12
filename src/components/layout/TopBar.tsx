import React, { useState } from "react";
import { usePathname } from "@/lib/router";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { activeItem } from "@/components/layout/nav";

interface TopBarProps {
  onMenuClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const title = activeItem(pathname)?.label ?? "Platform console";
  const initials = (user?.name || (user?.email ?? "SU").split("@")[0] || "SU")
    .split(/[\s._-]+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="h-16 border-b border-border/70 glass flex items-center justify-between px-3 sm:px-5 sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-text-secondary hover:bg-ops-card2 hover:text-text-primary transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl lg:text-[1.9rem] font-medium tracking-tight text-text-primary truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 lg:gap-4">
        <span className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-navy-soft text-brand-blue text-xs font-semibold ring-1 ring-inset ring-brand-blue/15">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-gold" />
          Superuser · read-only
        </span>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="group flex items-center gap-2 px-2 lg:px-3 py-1.5 cursor-pointer hover:bg-ops-card2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="w-8 h-8 bg-brand-wine rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-white shadow-soft">
              {initials || "SU"}
            </div>
            <span className="text-sm font-medium text-text-primary hidden sm:inline">{user?.email}</span>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-xl shadow-lift z-20 py-1 animate-menu-in"
              >
                <div className="px-4 py-2.5 border-b border-border">
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary">Signed in as</p>
                  <p className="text-sm font-medium text-text-primary truncate">{user?.email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={async () => {
                    setLogoutError(null);
                    try {
                      await logout();
                      setMenuOpen(false);
                    } catch (err) {
                      setLogoutError(err instanceof Error ? err.message : "Sign out failed.");
                    }
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/5 text-left transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
                {logoutError && (
                  <p role="alert" className="px-4 pb-2 text-xs text-danger">{logoutError}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
