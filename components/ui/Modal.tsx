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
  sm: "w-96",
  md: "w-[28rem]",
  lg: "w-[36rem]",
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

  if (!open) return null;

  return (
    <div
      // Frosted backdrop, matching Drawer. `bg-[#072D62] bg-opacity-50` read as a flat blackout and
      // is Tailwind v3 syntax besides; the slash-opacity + backdrop-blur keeps the page legible
      // behind the dialog. z-[60] is explicit so it doesn't rely on a non-default `z-60` class.
      className="fixed inset-0 bg-[#072D62]/40 backdrop-blur-sm flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className={`${sizeMap[size]} bg-white rounded-xl border border-border shadow-xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-ops-sidebar">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.displayName = "Modal";
