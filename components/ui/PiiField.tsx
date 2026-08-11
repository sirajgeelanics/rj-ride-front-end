"use client";

import React, { useState, useRef, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PiiFieldProps {
  value: string;
  maskFn?: (val: string) => string;
}

function defaultMask(val: string): string {
  if (!val) return "—";
  if (val.includes("@")) {
    const [name, domain] = val.split("@");
    return `${name![0]}***@${domain}`;
  }
  if (val.length >= 10) {
    return val.slice(0, 2) + "***" + val.slice(-4);
  }
  return val.slice(0, 1) + "***";
}

export const PiiField: React.FC<PiiFieldProps> = ({ value, maskFn = defaultMask }) => {
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleToggle = () => {
    if (revealed) {
      setRevealed(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      setRevealed(true);
      timerRef.current = setTimeout(() => setRevealed(false), 10000);
    }
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm">{revealed ? value : maskFn(value)}</span>
      <button
        onClick={handleToggle}
        className="p-0.5 hover:bg-table-header rounded transition-colors"
        title={revealed ? "Hide" : "Reveal (10s)"}
      >
        {revealed ? <EyeOff className="w-3.5 h-3.5 text-text-muted" /> : <Eye className="w-3.5 h-3.5 text-text-muted" />}
      </button>
    </span>
  );
};
