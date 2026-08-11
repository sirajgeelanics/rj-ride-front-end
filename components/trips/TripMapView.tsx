"use client";

import React, { useEffect, useRef } from "react";
import { Stop, VehicleStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import dynamic from "next/dynamic";

interface TripMapViewProps {
  stops: Stop[];
  vehicles?: Array<{
    id: string;
    vehicleId?: string;
    status: VehicleStatus;
    pax: any[];
    lat?: number;
    lng?: number;
    eta?: number;
  }>;
  showVehicles?: boolean;
}

// Dynamic import to avoid SSR issues with Leaflet
const DynamicMap = dynamic(() => import("@/components/trips/MapComponent"), {
  ssr: false,
  loading: () => <div className="h-64 bg-ops-bg rounded flex items-center justify-center text-text-secondary">Loading map...</div>,
});

export const TripMapView: React.FC<TripMapViewProps> = ({ stops, vehicles = [], showVehicles = false }) => {
  if (stops.length === 0) {
    return (
      <Card padding="lg" header={<h3 className="font-semibold">🗺️ Route Map</h3>}>
        <div className="h-64 bg-ops-bg rounded flex items-center justify-center text-text-secondary">No stops to display</div>
      </Card>
    );
  }

  return (
    <Card padding="lg" header={<h3 className="font-semibold">🗺️ Route Map</h3>}>
      <DynamicMap stops={stops} vehicles={vehicles} showVehicles={showVehicles} />
    </Card>
  );
};

TripMapView.displayName = "TripMapView";
