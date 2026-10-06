"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, Inbox, Truck, CircleDollarSign, Bell, LogOut, X } from "lucide-react";
import { useAuth, useLanguageStore, t, csrfFetch } from "@/lib/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/" as const, labelKey: "dashboard" as const, icon: LayoutDashboard, shortcut: "1" as const },
  { href: "/offers" as const, labelKey: "offers" as const, icon: Inbox, shortcut: "2" as const },
  { href: "/trips" as const, labelKey: "trips" as const, icon: ListOrdered, shortcut: "3" as const },
  { href: "/fleet" as const, labelKey: "fleet" as const, icon: Truck, shortcut: "4" as const },
  { href: "/earnings" as const, labelKey: "earnings" as const, icon: CircleDollarSign, shortcut: "5" as const },
  { href: "/alerts" as const, labelKey: "alerts" as const, icon: Bell, shortcut: "6" as const },
] as const;

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const pathname = usePathname();

  // Offer count for the nav badge, so a new/alerted offer is visible from any page — not only
  // while the Offers screen happens to be open. Shares the ["vendor","offers"] cache key with
  // that screen and with the WS invalidation in app/layout.tsx, so it updates instantly too.
  const { data: pendingOffers = 0 } = useQuery({
    queryKey: ["vendor", "offers"],
    queryFn: async (): Promise<{ status?: string }[]> => {
      const resp = await csrfFetch("/api/v1/vendor/offers/", { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load offers (${resp.status})`);
      const body = (await resp.json()) as { results?: { status?: string }[] };
      return body.results ?? [];
    },
    refetchInterval: 15_000,
    select: (rows) => rows.filter((r) => r.status === "OFFERED" || r.status === "ALERTED").length,
  });
  const router = useRouter();
  const language = useLanguageStore((s) => s.language);
  const { logout } = useAuth();

  const handleLogout = () => {
    void logout();
    router.push("/login");
    onMobileClose?.();
  };

  const handleNavClick = () => {
    onMobileClose?.();
  };

  if (pathname === "/login") return null;

  const sidebarContent = (
    // Deep navy rail with a faint radial glow; active route = translucent white pill + gold bar.
    <aside className="relative w-60 min-h-screen flex flex-col text-white overflow-hidden bg-[radial-gradient(120%_60%_at_0%_0%,rgba(179,150,97,0.16),transparent_55%),linear-gradient(180deg,#0A3470_0%,#072D62_45%,#051F45_100%)] border-r border-white/5">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-white/10 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-gold" />
          </span>
          <div>
            <p className="font-serif text-white text-2xl leading-none tracking-tight">{t('rideTM', language)}</p>
            <p className="text-accent-gold text-[10px] uppercase tracking-[0.2em] mt-1.5">{t('vendorPortal', language)}</p>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          aria-label="Close menu"
          className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              aria-current={isActive ? "page" : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-gold transition-[color,background-color,transform] duration-200 ${
                isActive
                  ? "text-white font-medium bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "text-white/70 hover:text-white hover:bg-white/[0.07] hover:translate-x-0.5"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-gold animate-fade-in" />
              )}
              <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-accent-gold" : "text-white/60 group-hover:text-white"}`} />
              <span className="flex-1">{t(item.labelKey, language)}</span>
              {item.href === "/offers" && pendingOffers > 0 && (
                <span
                  className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent-gold text-[#072D62] text-[10px] font-bold flex items-center justify-center animate-pulse"
                  title={`${pendingOffers} offer${pendingOffers === 1 ? "" : "s"} awaiting your response`}
                >
                  {pendingOffers}
                </span>
              )}
              <span className="text-[10px] text-white/35 font-mono hidden lg:inline">{item.shortcut}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.08] outline-none focus-visible:ring-2 focus-visible:ring-accent-gold transition-colors w-full"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          {t('logout', language)}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 z-30 h-screen">
        {sidebarContent}
      </div>

      {/* Mobile: overlay sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-[#051F45]/45 backdrop-blur-[3px] animate-fade-in" onClick={onMobileClose} />
          {/* Sidebar panel */}
          <div className="absolute left-0 top-0 h-full shadow-2xl animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
