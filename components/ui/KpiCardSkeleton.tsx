"use client";

import React from "react";

interface KpiCardSkeletonProps {
  count?: number;
}

export const KpiCardSkeleton: React.FC<KpiCardSkeletonProps> = ({ count = 4 }) => {
  const items = Array.from({ length: count });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
      {items.map((_, i) => (
        <div key={i} className="bg-card-bg border border-card-border rounded-2xl p-5 card-soft">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-3 w-20 skeleton" style={{ animationDelay: `${i * 90}ms` }} />
              <div className="h-8 w-24 skeleton mt-3" style={{ animationDelay: `${i * 90}ms` }} />
            </div>
            <div className="w-10 h-10 skeleton rounded-xl" style={{ animationDelay: `${i * 90}ms` }} />
          </div>
        </div>
      ))}
    </div>
  );
};
