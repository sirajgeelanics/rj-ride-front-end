"use client";

import React from "react";
import dynamic from "next/dynamic";

interface StopPoint {
  address: string;
  lat: number;
  lng: number;
  type: string;
}

interface TripMapViewWrapperProps {
  stops: StopPoint[];
  height?: string;
}

const DynamicMap = dynamic(() => import("@/components/trips/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-56 bg-ops-bg rounded-lg flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-text-muted">Loading map...</p>
      </div>
    </div>
  ),
});

export const TripMapViewWrapper: React.FC<TripMapViewWrapperProps> = ({ stops, height }) => {
  if (stops.length === 0) {
    return (
      <div className={`h-56 bg-ops-bg rounded-lg flex items-center justify-center`}>
        <p className="text-xs text-text-muted">No route data available</p>
      </div>
    );
  }

  return <DynamicMap stops={stops} height={height} />;
};

TripMapViewWrapper.displayName = "TripMapViewWrapper";

export default TripMapViewWrapper;
