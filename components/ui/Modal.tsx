"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "w-[calc(100vw-2rem)] sm:w-96",
  md: "w-[calc(100vw-2rem)] sm:w-[28rem]",
  lg: "w-[calc(100vw-2rem)] sm:w-[36rem]",
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, size = "md" }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Deliberately never unmounts (no `if (!open) return null`) — for the call sites that already
  // pass a stable `open` prop to an always-rendered <Modal> (ConfirmDialog, the common case),
  // unmounting the instant `open` goes false would leave nothing for a CSS transition to
  // animate; it would just vanish. Opacity + scale classes driven by `open` make both the open
  // AND close transitions actually play. (Call sites that additionally wrap <Modal> itself in
  // `{state && <Modal open .../>}` still snap shut on close — that outer conditional unmounts
  // the whole thing regardless of what happens in here; only fixable at each of those call
  // sites individually.)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={title}
      // Frosted backdrop, matching Drawer. `bg-[#072D62] bg-opacity-50` read as a flat blackout and
      // is Tailwind v3 syntax besides; the slash-opacity + backdrop-blur keeps the page legible
      // behind the dialog. z-[60] is explicit so it doesn't rely on a non-default `z-60` class.
      className={`fixed inset-0 bg-[#04204A]/45 backdrop-blur-sm flex items-center justify-center z-[60] transition-opacity duration-200 ${
        open ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={onClose}
    >
      <div
        className={`${sizeMap[size]} bg-white rounded-2xl border border-border shadow-modal flex flex-col max-h-[90vh] overflow-hidden transition-[transform,opacity] duration-300 ease-[var(--ease-spring)] ${
          open ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-2"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-ops-line bg-white">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-ops-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.displayName = "Modal";
