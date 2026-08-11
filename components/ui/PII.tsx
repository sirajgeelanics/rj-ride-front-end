"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PiiType = "name" | "phone" | "email" | "id" | "pnr" | "licence" | "registration";

interface PIIProps {
  value: string;
  type?: PiiType;
  className?: string;
}

const maskValue = (value: string, type: PiiType): string => {
  const len = value.length;
  if (len <= 2) return "*".repeat(len);

  switch (type) {
    case "phone":
      return `***-***-${value.slice(-4)}`;
    case "email": {
      const parts = value.split("@");
      const local = parts[0];
      const domain = parts[1];
      if (!local || !domain) return "*".repeat(len);
      return `${local[0]}***@${domain}`;
    }
    case "pnr":
      return `***${value.slice(-3)}`;
    case "licence":
      return `***${value.slice(-4)}`;
    case "registration":
      return `***${value.slice(-4)}`;
    case "id":
      return `***${value.slice(-5)}`;
    case "name":
    default:
      return `${value[0]}${"*".repeat(Math.max(1, len - 2))}${value[len - 1] ?? ""}`;
  }
};

export const PII: React.FC<PIIProps> = ({ value, type = "name", className = "" }) => {
  const [revealed, setRevealed] = useState(false);
  const displayValue = revealed ? value : maskValue(value, type);

  return (
    <span className={`inline-flex items-center gap-1 select-none ${className}`}>
      <span className="font-mono text-sm text-inherit">{displayValue}</span>
      <button
        onClick={() => setRevealed(!revealed)}
        className="p-1 hover:bg-white hover:bg-opacity-10 rounded transition-colors"
        aria-label={revealed ? "Hide" : "Reveal"}
      >
        {revealed ? (
          <EyeOff className="w-4 h-4 text-inherit opacity-70" />
        ) : (
          <Eye className="w-4 h-4 text-inherit opacity-70" />
        )}
      </button>
    </span>
  );
};

PII.displayName = "PII";
