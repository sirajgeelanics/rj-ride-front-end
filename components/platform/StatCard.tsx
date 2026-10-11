import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border shadow-soft p-4 flex items-start gap-3 hover-lift">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-soft text-brand-blue flex-shrink-0">
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
