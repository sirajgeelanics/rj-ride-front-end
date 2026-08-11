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
      <div className="flex gap-1 border-b border-border pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-t-lg ${
                activeTab === tab.id
                  ? "bg-ops-sidebar text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-ops-card2"
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};

Tabs.displayName = "Tabs";
