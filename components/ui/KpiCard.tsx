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
    <div className="bg-card-bg border border-card-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-muted font-medium">{label}</p>
        {Icon && <Icon className={`w-5 h-5 ${accentColor}`} />}
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {delta && (
        <p className={`text-xs mt-1 ${delta.positive ? "text-success" : "text-danger"}`}>
          {delta.positive ? "↑" : "↓"} {delta.value}%
        </p>
      )}
    </div>
  );
};
