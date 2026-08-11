"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, message, action }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      {Icon && <Icon className="w-12 h-12 text-text-muted mb-4" />}
      {title && <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>}
      <p className="text-sm text-text-muted text-center max-w-md">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
