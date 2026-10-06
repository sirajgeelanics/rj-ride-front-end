"use client";

import React from "react";

interface LoadingSkeletonProps {
  rows?: number;
  height?: string;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ rows = 5, height = "h-10", className = "" }) => {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} skeleton`} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
};
