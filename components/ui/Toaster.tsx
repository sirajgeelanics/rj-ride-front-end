"use client";

import React from "react";
import { useToastStore } from "@/stores/toastStore";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export const Toaster: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-success" />,
    error: <AlertCircle className="w-5 h-5 text-danger" />,
    info: <Info className="w-5 h-5 text-brand-blue" />,
  };
  const accentMap = {
    success: "before:bg-success",
    error: "before:bg-danger",
    info: "before:bg-brand-blue",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          className={`relative overflow-hidden flex items-start gap-3 pl-5 pr-3 py-3 rounded-xl border border-border bg-white text-text-primary shadow-lift animate-slide-in-right pointer-events-auto before:absolute before:left-0 before:inset-y-0 before:w-1 ${accentMap[toast.type]}`}
        >
          <span className="mt-px shrink-0">{iconMap[toast.type]}</span>
          <span className="flex-1 text-sm font-medium leading-snug">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss"
            className="p-1 text-text-tertiary hover:text-text-primary hover:bg-ops-card2 rounded-md transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

Toaster.displayName = "Toaster";
