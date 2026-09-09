"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  confirmModal?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = "md", confirmModal = false }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[90vw] max-h-[90vh]",
  };

  // Deliberately never unmounts (no `if (!open) return null`) — a component that pops out of
  // existence the instant `open` flips false has nothing left for a CSS transition to animate;
  // it just snaps shut. Opacity + scale classes driven by `open` make both directions smooth,
  // for the call sites that already pass a stable `open` prop to an always-rendered <Modal>.
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="absolute inset-0 bg-[#072D62]/40 backdrop-blur-sm" onClick={confirmModal ? undefined : onClose} />
      <div
        className={`relative bg-card-bg rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto transition-transform duration-200 ${
          open ? "scale-100" : "scale-95"
        }`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            {!confirmModal && (
              <button onClick={onClose} className="p-1 hover:bg-table-header rounded-lg transition-colors">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};
