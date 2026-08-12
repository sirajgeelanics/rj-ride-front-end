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
  md: "w-96",
  lg: "w-[28rem]",
  xl: "w-[32rem]",
  "2xl": "w-[48rem]",
};

export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children, width = "lg" }) => {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-[#072D62]/40 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 right-0 bottom-0 ${widthMap[width]} bg-white border-l border-border shadow-xl transition-transform duration-300 z-50 text-text-primary flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-ops-sidebar flex-shrink-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </>
  );
};

Drawer.displayName = "Drawer";
