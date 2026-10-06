"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const accents = {
    success: "text-success bg-success/10",
    error: "text-danger bg-danger/10",
    info: "text-brand-blue bg-brand-blue/10",
  };
  const bars = {
    success: "before:bg-success",
    error: "before:bg-danger",
    info: "before:bg-brand-blue",
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          return (
            <div
              key={toast.id}
              className={`relative overflow-hidden bg-card-bg border border-card-border text-text-primary pl-5 pr-3 py-3 rounded-xl shadow-[var(--shadow-lift)] flex items-center gap-3 min-w-[300px] max-w-[450px] animate-slide-in-right before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${bars[toast.type]}`}
              role="status"
            >
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accents[toast.type]}`}>
                <Icon className="w-4 h-4" />
              </span>
              <p className="text-sm flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} aria-label="Dismiss" className="p-1 text-text-muted hover:text-text-primary hover:bg-table-header rounded-md transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
