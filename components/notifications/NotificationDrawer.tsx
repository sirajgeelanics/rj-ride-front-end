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
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[400px] bg-card-bg shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card-bg z-10">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-text-primary" />
            <h3 className="text-lg font-semibold text-text-primary">Notifications</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-table-header rounded-lg transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <Bell className="w-10 h-10 text-text-muted mb-3" />
          <p className="text-sm text-text-muted">No notifications yet</p>
          <p className="text-xs text-text-muted mt-1">
            Notifications appear here when trips are assigned or completed
          </p>
        </div>
      </div>
    </div>
  );
};
