"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { keys } from "@/lib/shared";
import { useRideEvents } from "@/lib/shared/realtime/ws";
import type { TrackingEvent } from "@/lib/shared/realtime/ws";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { VehicleStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Navigation, AlertCircle, MapPin, MapIcon, ChevronRight } from "lucide-react";
import dynamic from "next/dynamic";

type LivePosition = {
  trip_vehicle_id: string;
  trip_id?: string;
  reference?: string;
  vehicle_id?: string | null;
  plate?: string | null;
  vendor_id?: string | null;
  status?: string;
  marker_color?: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  device_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: string;
  position?: {
    lat: number;
    lng: number;
    speed_kmh?: number;
    heading?: number;
    at?: string;
  } | null;
};

type TrackMilestone = {
  label: string;
  status: "DONE" | "ACTIVE" | "PENDING";
  arrivedAt?: string | null;
};

type TrackDetail = {
  etaMinutes?: number | null;
  milestones?: TrackMilestone[];
};

const LiveMapComponent = dynamic(() => import("@/components/tracking/LiveMapComponent"), {
  ssr: false,
  loading: () => (
    <div className="h-80 bg-ops-bg rounded flex items-center justify-center text-text-secondary text-sm">
      Loading map…
    </div>
  ),
});

export default function TrackingPage() {
  const addToast = useToastStore((s) => s.addToast);

  const [selectedTripVehicleId, setSelectedTripVehicleId] = useState<string | null>(null);

  const livePositionsRef = useRef<Map<string, LivePosition>>(new Map());
  const [positionsTick, setPositionsTick] = useState(0);

  const { data: initialPositions, isLoading } = useQuery<LivePosition[]>({
    queryKey: keys.tracking.live(),
    queryFn: async () => {
      const resp = await fetch("/api/v1/tracking/live/", { credentials: "include" });
      if (!resp.ok) throw new Error(`tracking/live failed: ${resp.status}`);
      const envelope = await resp.json() as { result?: { vehicles?: LivePosition[] } };
      return (envelope.result?.vehicles ?? []) as LivePosition[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!initialPositions) return;
    const map = new Map<string, LivePosition>();
    for (const pos of initialPositions) {
      if (pos.trip_vehicle_id) map.set(pos.trip_vehicle_id, pos);
    }
    livePositionsRef.current = map;
    setPositionsTick((t) => t + 1);
  }, [initialPositions]);

  const handleTrackingEvent = useCallback(
    (event: TrackingEvent) => {
      const { deviceId, lat, lng, speed, heading, timestamp } = event;
      const map = livePositionsRef.current;
      const existing = Array.from(map.values()).find((p) => p.device_id === deviceId);
      if (existing?.trip_vehicle_id) {
        map.set(existing.trip_vehicle_id, { ...existing, lat, lng, speed, heading, timestamp });
        setPositionsTick((t) => t + 1);
      }
    },
    []
  );

  useRideEvents({
    handler: (event) => {
      if (event.type === "tracking.position") {
        handleTrackingEvent(event as TrackingEvent);
      }
    },
  });

  const { data: trackDetail } = useQuery<TrackDetail | null>({
    queryKey: keys.tracking.track(selectedTripVehicleId ?? ""),
    queryFn: async () => {
      if (!selectedTripVehicleId) return null;
      // The track detail lives on the trips viewset, not /tracking/. It needs both the trip
      // id and the trip-vehicle id, which the live position carries.
      const pos = livePositionsRef.current.get(selectedTripVehicleId);
      if (!pos?.trip_id) return null;
      const resp = await fetch(
        `/api/v1/trips/${pos.trip_id}/vehicles/${selectedTripVehicleId}/track/`,
        { credentials: "include" },
      );
      if (!resp.ok) {
        addToast("Track fetch failed", "error");
        return null;
      }
      const envelope = await resp.json() as { result?: TrackDetail };
      return (envelope.result ?? null) as TrackDetail | null;
    },
    enabled: !!selectedTripVehicleId,
  });

  const positions = Array.from(livePositionsRef.current.values());
  const activeCount = positions.filter((p) => p.status && !["COMPLETED", "CANCELLED"].includes(p.status)).length;
  const sosCount = positions.filter((p) => p.status === "SOS").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60">Active</p>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60">Total on map</p>
          <p className="text-2xl font-bold text-white mt-1">{positions.length}</p>
        </div>
        <div className={`${sosCount > 0 ? "bg-danger" : "bg-ops-sidebar"} rounded-xl p-4`}>
          <p className="text-xs text-white/60">SOS</p>
          <p className="text-2xl font-bold text-white mt-1">{sosCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <Card padding="lg" header={<h3 className="font-semibold">Fleet Map</h3>}>
            {isLoading ? (
              <div className="h-80 bg-ops-bg rounded flex items-center justify-center text-text-secondary text-sm">
                Loading positions…
              </div>
            ) : (
              <LiveMapComponent
                positions={positions}
                selectedTripVehicleId={selectedTripVehicleId}
                onSelectVehicle={setSelectedTripVehicleId}
                positionsTick={positionsTick}
              />
            )}
          </Card>

          {trackDetail && selectedTripVehicleId && (
            <Card padding="lg" header={
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Trip Track</h3>
                <button
                  onClick={() => setSelectedTripVehicleId(null)}
                  className="text-xs text-text-secondary hover:text-text-primary"
                >
                  ✕ Close
                </button>
              </div>
            }>
              <div className="space-y-3">
                {trackDetail.etaMinutes != null && (
                  <p className="text-sm text-brand-blue font-medium flex items-center gap-1">
                    <Navigation className="w-4 h-4" /> ETA: {trackDetail.etaMinutes} min
                  </p>
                )}
                {trackDetail.milestones && trackDetail.milestones.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">Milestones</p>
                    {(trackDetail.milestones as TrackMilestone[]).map((m, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full ${m.status === "DONE" ? "bg-green-400" : m.status === "ACTIVE" ? "bg-brand-blue" : "bg-border"}`} />
                        <span className={m.status !== "PENDING" ? "text-text-primary" : "text-text-secondary"}>{m.label}</span>
                        {m.arrivedAt && <span className="text-text-tertiary ml-auto">{new Date(m.arrivedAt).toLocaleTimeString()}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Vehicles on map</h3>
          {positions.length === 0 ? (
            <p className="text-xs text-text-secondary">No live positions.</p>
          ) : (
            positions.map((pos) => (
              <button
                key={pos.trip_vehicle_id}
                onClick={() => setSelectedTripVehicleId(
                  selectedTripVehicleId === pos.trip_vehicle_id ? null : (pos.trip_vehicle_id ?? null)
                )}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedTripVehicleId === pos.trip_vehicle_id
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-border hover:border-brand-blue/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {pos.marker_color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: `#${pos.marker_color}` }}
                        />
                      )}
                      {pos.status && <StatusBadge status={pos.status as VehicleStatus} />}
                      {pos.status === "SOS" && <AlertCircle className="w-3 h-3 text-danger" />}
                    </div>
                    {pos.lat != null && pos.lng != null && (
                      <p className="text-xs text-text-secondary flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                      </p>
                    )}
                    {pos.speed != null && (
                      <p className="text-xs text-text-secondary">{pos.speed} km/h</p>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 ${selectedTripVehicleId === pos.trip_vehicle_id ? "text-brand-blue" : "text-text-tertiary"}`} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
