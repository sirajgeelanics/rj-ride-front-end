import React from "react";
import type { LucideIcon } from "lucide-react";
import { TONE, type Tone } from "@/lib/colors";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  /** Colours the icon tile, so a number reads as good, busy or bad before it is read. */
  tone?: Tone;
}

export function StatCard({ label, value, icon: Icon, hint, tone = "navy" }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-soft p-4 flex items-start gap-3 hover-lift">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset flex-shrink-0 ${TONE[tone].soft}`}
      >
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary">{label}</p>
        <p className="font-serif text-3xl leading-tight text-text-primary tabular">{value}</p>
        {hint && <p className="text-xs text-text-secondary mt-0.5 truncate">{hint}</p>}
      </div>
    </div>
  );
}
