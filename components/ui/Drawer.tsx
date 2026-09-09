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
      {open && <div className="absolute inset-0 bg-[#072D62]/30" onClick={onClose} />}
      <div
        className={`absolute right-0 top-0 h-full w-full ${width} bg-card-bg shadow-2xl overflow-y-auto transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card-bg z-10">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <button onClick={onClose} className="p-1 hover:bg-table-header rounded-lg transition-colors">
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
