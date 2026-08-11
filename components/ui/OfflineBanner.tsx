"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);

  const handleOnline = useCallback(() => setIsOffline(false), []);
  const handleOffline = useCallback(() => setIsOffline(true), []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Auto-retry every 30s
    const interval = setInterval(() => {
      if (!navigator.onLine) {
        setIsOffline(true);
      } else {
        setIsOffline(false);
      }
    }, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [handleOnline, handleOffline]);

  if (!isOffline) return null;

  return (
    <div className="sticky top-16 z-30 w-full bg-amber-50 border-b border-amber-200 px-4 lg:px-6 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-amber-800">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>Offline — showing cached data</span>
      </div>
      <button
        onClick={() => {
          if (navigator.onLine) {
            setIsOffline(false);
            window.location.reload();
          }
        }}
        className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors"
      >
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );
};
