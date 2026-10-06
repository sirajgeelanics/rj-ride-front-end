"use client";

import React from "react";
import { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accentColor?: string;
  delta?: { value: number; positive: boolean };
}

export const KpiCard: React.FC<KpiCardProps> = ({ label, value, icon: Icon, accentColor = "text-brand-blue", delta }) => {
  return (
    <div className="bg-card-bg border border-card-border rounded-2xl p-5 card-soft hover-lift shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary tabular-nums tracking-tight leading-none">{value}</p>
        </div>
        {Icon && (
          <span className="w-10 h-10 rounded-xl bg-table-header border border-card-border flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 ${accentColor}`} />
          </span>
        )}
      </div>
      {delta && (
        <p className={`text-xs mt-3 font-medium tabular-nums ${delta.positive ? "text-success" : "text-danger"}`}>
          {delta.positive ? "↑" : "↓"} {delta.value}%
        </p>
      )}
    </div>
  );
};
