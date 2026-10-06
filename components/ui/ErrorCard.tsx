"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface ErrorCardProps {
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  resource?: string;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  title,
  message,
  error,
  onRetry,
  resource = "data",
}) => {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="bg-card-bg border border-danger/20 rounded-2xl p-8 shadow-[var(--shadow-soft)] animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-danger/10 ring-4 ring-danger/5 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-danger" />
        </div>
        <h3 className="font-serif text-xl font-medium text-text-primary mb-1">
          {title || `Failed to load ${resource}`}
        </h3>
        <p className="text-sm text-text-muted max-w-md mb-4">
          {message || `Something went wrong while loading ${resource}. Please try again.`}
        </p>

        {onRetry && (
          <Button onClick={onRetry}>
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        )}

        {error && (
          <div className="w-full mt-4">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mx-auto transition-colors"
            >
              {showDebug ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {showDebug ? "Hide details" : "Show error details"}
            </button>
            {showDebug && (
              <div className="mt-2 p-3 bg-page-bg border border-border rounded-lg text-xs font-mono text-danger text-left overflow-x-auto">
                {error.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
