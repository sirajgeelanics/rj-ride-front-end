"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, width = "max-w-lg" }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Deliberately never unmounts (no `if (!open) return null`) — a component that pops out of
  // existence the instant `open` flips false has nothing left for a CSS transition to animate;
  // it just snaps shut. Staying mounted and sliding the panel off-screen via translate-x is what
  // makes both open AND close smooth. Matches rideadmin's own Drawer, which already does this.
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      {open && <div className="absolute inset-0 bg-[#051F45]/35 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />}
      <div
        className={`absolute right-0 top-0 h-full w-full ${width} bg-card-bg border-l border-card-border shadow-[var(--shadow-modal)] overflow-y-auto scroll-thin transition-transform duration-300 ease-[var(--ease-out-expo)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card-bg/95 backdrop-blur z-10">
            <h3 className="font-serif text-xl font-medium text-text-primary tracking-tight">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 -mr-1.5 hover:bg-table-header rounded-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
