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

const NAV_ITEMS = [
  { labelKey: "dashboard" as const, icon: LayoutDashboard, href: "/" },
  { labelKey: "pricingAndQuotes" as const, icon: Tags, href: "/pricing" },
  { labelKey: "tripRequests" as const, icon: Route, href: "/trips" },
  { labelKey: "ritmo" as const, icon: Inbox, href: "/ritmo" },
  { labelKey: "dispatch" as const, icon: Radio, href: "/dispatch" },
  { labelKey: "tracking" as const, icon: MapPin, href: "/tracking" },
  { labelKey: "billing" as const, icon: Receipt, href: "/billing" },
  // { labelKey: "apiConsole" as const, icon: Code2, href: "/api-console" },
  { labelKey: "configuration" as const, icon: Settings2, href: "/configuration" },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const language = useLanguageStore((s) => s.language);

  return (
    // FL8 (c.fl8.in) editorial shell: light card rail with a hairline right border — not a dark
    // navy sidebar. Muted nav labels that darken on hover; wine primary marks the active route.
    <aside className="w-60 bg-ops-card border-r border-border h-screen flex flex-col">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-wine flex-shrink-0" />
          <h1 className="display-serif text-2xl text-text-primary tracking-tight leading-none">{t('rideTM', language)}</h1>
        </div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary mt-2">{t('transportManagement', language)}</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-brand-wine/[0.08] text-brand-wine font-medium"
                  : "text-text-secondary hover:bg-ops-card2 hover:text-text-primary"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-wine" />
              )}
              <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? "text-brand-wine" : "text-text-tertiary group-hover:text-text-primary"}`} />
              <span className="text-sm">{t(item.labelKey, language)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-3 border-t border-border">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary font-mono">Rezolv · RIDE</p>
      </div>
    </aside>
  );
};

Sidebar.displayName = "Sidebar";
