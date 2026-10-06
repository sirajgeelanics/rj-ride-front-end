import React from "react";
import { LucideIcon } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, children }) => {
  return (
    <div className="w-full">
      <div role="tablist" className="flex gap-1 border-b border-border overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-3 -mb-px text-sm font-medium whitespace-nowrap flex items-center gap-2 rounded-t-lg border-b-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${
                activeTab === tab.id
                  ? "text-text-primary border-accent-gold"
                  : "text-text-secondary border-transparent hover:text-text-primary hover:border-border"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-5 animate-fade-in">
        {children}
      </div>
    </div>
  );
};

Tabs.displayName = "Tabs";
