"use client";

import React from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: "md" | "lg" | "xl" | "2xl";
}

const widthMap = {
  md: "w-full sm:w-96",
  lg: "w-full sm:w-[28rem]",
  xl: "w-full sm:w-[32rem]",
  "2xl": "w-full sm:w-[48rem]",
};

export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, width = "lg" }) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-[#04204A]/45 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 bottom-0 ${widthMap[width]} bg-white border-l border-border shadow-modal transition-transform duration-300 ease-[var(--ease-out-expo)] z-50 text-text-primary flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-ops-line bg-white flex-shrink-0">
          <h2 className="font-serif text-2xl font-medium tracking-tight text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-ops-card2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </div>
    </>
  );
};

Drawer.displayName = "Drawer";
