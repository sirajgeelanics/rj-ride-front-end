"use client";

import React from "react";

interface PageSkeletonProps {
  title?: string;
  kpiCount?: number;
  tableRows?: number;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({ title = "", kpiCount = 4, tableRows = 6 }) => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        {title ? (
          <div className="h-8 w-48 bg-ops-bg rounded-lg" />
        ) : (
          <>
            <div className="h-8 w-48 bg-ops-bg rounded-lg" />
            <div className="h-4 w-72 bg-ops-bg rounded mt-2" />
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <div key={i} className="bg-card-bg border border-card-border rounded-xl p-5">
            <div className="h-4 w-24 bg-ops-bg rounded mb-3" />
            <div className="h-8 w-20 bg-ops-bg rounded" />
          </div>
        ))}
      </div>

      {/* Content card */}
      <div className="bg-card-bg border border-card-border rounded-xl p-5">
        <div className="h-6 w-32 bg-ops-bg rounded mb-4" />
        {Array.from({ length: tableRows }).map((_, i) => (
          <div
            key={i}
            className="h-10 bg-ops-bg rounded mb-2"
            style={{ width: `${70 + ((i * 17) % 30)}%` }}
          />
        ))}
      </div>
    </div>
  );
};
