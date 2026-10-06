"use client";

import React from "react";
import { X, Bell } from "lucide-react";

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#051F45]/35 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[400px] bg-card-bg border-l border-card-border shadow-[var(--shadow-modal)] overflow-y-auto animate-slide-in-right" role="dialog" aria-label="Notifications">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card-bg/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-accent-gold" />
            <h3 className="font-serif text-xl font-medium text-text-primary">Notifications</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 -mr-1.5 hover:bg-table-header rounded-lg transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <span className="w-14 h-14 rounded-2xl bg-table-header border border-card-border flex items-center justify-center mb-4"><Bell className="w-6 h-6 text-accent-gold" /></span>
          <p className="text-sm text-text-muted">No notifications yet</p>
          <p className="text-xs text-text-muted mt-1">
            Notifications appear here when trips are assigned or completed
          </p>
        </div>
      </div>
    </div>
  );
};
