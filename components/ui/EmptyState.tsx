"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 animate-fade-in">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-table-header flex items-center justify-center mb-5 border border-card-border shadow-[var(--shadow-soft),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <Icon className="w-7 h-7 text-accent-gold" />
        </div>
      )}
      {title && <h3 className="font-serif text-xl font-medium text-text-primary mb-1.5">{title}</h3>}
      <p className="text-sm text-text-muted text-center max-w-md leading-relaxed">{message}</p>
      {action && (
        <Button className="mt-5" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
};
