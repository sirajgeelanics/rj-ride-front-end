"use client";

import React from "react";

interface KpiCardSkeletonProps {
  count?: number;
}

export const KpiCardSkeleton: React.FC<KpiCardSkeletonProps> = ({ count = 4 }) => {
  const items = Array.from({ length: count });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((_, i) => (
        <div key={i} className="bg-card-bg border border-card-border rounded-xl p-5 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-24 bg-ops-bg rounded" />
            <div className="w-5 h-5 bg-ops-bg rounded" />
          </div>
          <div className="h-8 w-20 bg-ops-bg rounded" />
        </div>
      ))}
    </div>
  );
};
