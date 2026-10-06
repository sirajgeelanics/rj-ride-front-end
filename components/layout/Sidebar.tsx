"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguageStore, t } from "@/lib/shared";
import {
  LayoutDashboard,
  Settings2,
  Tags,
  Route,
  Radio,
  MapPin,
  Receipt,
  Code2,
  ClipboardList,
  GitBranch,
  Inbox,
} from "lucide-react";

export const NAV_ITEMS = [
  { labelKey: "dashboard" as const, icon: LayoutDashboard, href: "/" },
  { labelKey: "pricingAndQuotes" as const, icon: Tags, href: "/pricing" },
  { labelKey: "tripRequests" as const, icon: Route, href: "/trips" },
  { labelKey: "automatedTrips" as const, icon: Inbox, href: "/ritmo" },
  // { labelKey: "dispatch" as const, icon: Radio, href: "/dispatch" },
  { labelKey: "tracking" as const, icon: MapPin, href: "/tracking" },
  { labelKey: "billing" as const, icon: Receipt, href: "/billing" },
  // { labelKey: "apiConsole" as const, icon: Code2, href: "/api-console" },
  { labelKey: "configuration" as const, icon: Settings2, href: "/configuration" },
];

// Visual grouping only — every route still comes from NAV_ITEMS (also read by TopBar).
const NAV_GROUPS: { label: string; hrefs: string[] }[] = [
  { label: "Operations", hrefs: ["/", "/trips", "/ritmo", "/tracking"] },
  { label: "Commercial", hrefs: ["/pricing", "/billing"] },
  { label: "Admin", hrefs: ["/configuration"] },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ open = false, onClose }) => {
  const pathname = usePathname();
  const language = useLanguageStore((s) => s.language);

  React.useEffect(() => {
    if (!onClose) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const grouped = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: NAV_ITEMS.filter((i) => g.hrefs.includes(i.href)),
  })).filter((g) => g.items.length > 0);
  const known = new Set(NAV_GROUPS.flatMap((g) => g.hrefs));
  const rest = NAV_ITEMS.filter((i) => !known.has(i.href));
  if (rest.length) grouped.push({ label: "More", items: rest });

  return (
    <>
      {/* Backdrop — mobile/tablet only, shown while the drawer is open. */}
      <div
        className={`fixed inset-0 bg-[#04204A]/50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Deep navy rail with a faint radial glow. Below `lg` it's an off-canvas slide-in panel;
      at `lg`+ it's the static rail. */}
      <aside
        className={`w-60 relative overflow-hidden text-white bg-[linear-gradient(180deg,#0A3470_0%,#072D62_45%,#04204A_100%)] shadow-[1px_0_0_rgba(255,255,255,0.05)] h-screen flex flex-col fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-[var(--ease-out-expo)] lg:static lg:translate-x-0 lg:z-auto ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(179,150,97,0.22)_0%,transparent_65%)]"
        />
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex-shrink-0">
              <span className="font-serif text-xl leading-none text-accent-gold">R</span>
            </span>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-normal text-white tracking-tight leading-none">{t('rideTM', language)}</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-white/50 mt-1.5 truncate">{t('transportManagement', language)}</p>
            </div>
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-accent-gold/50 via-white/10 to-transparent" />
        </div>

        <nav aria-label="Primary" className="relative flex-1 overflow-y-auto py-1 px-3 flex flex-col gap-4 custom-scrollbar">
          {grouped.map((group) => (
            <div key={group.label} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60 ${
                      isActive
                        ? "bg-white/[0.12] text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-white/70 hover:bg-white/[0.07] hover:text-white hover:translate-x-0.5"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent-gold" />
                    )}
                    <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${isActive ? "text-accent-gold" : "text-white/50 group-hover:text-white"}`} />
                    <span className="text-sm">{t(item.labelKey, language)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="relative px-5 py-4 border-t border-white/10">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 font-mono">Rezolv · RIDE</p>
        </div>
      </aside>
    </>
  );
};

Sidebar.displayName = "Sidebar";
