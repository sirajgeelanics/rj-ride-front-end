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
import { Navigation, AlertCircle, MapPin, MapIcon, Gauge, User, Car, X, LocateFixed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { markerHex } from "@/components/tracking/markerColors";
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

// apps.trips.api.views.TripViewSet.track's actual response shape — nothing here matches
// TrackDetail's field names or shapes at all (eta_minutes_to_next_stop vs etaMinutes; milestones
// is an OBJECT of four snapshot-or-null fields, not an array of {label, status, arrivedAt}). The
// old code cast this straight across with `as TrackDetail`, so trackDetail.etaMinutes and
// .milestones were always undefined — the "Trip Track" card rendered with just its header and
// Close button, nothing else, however healthy the trip's actual tracking data was.
type MilestoneSnapshot = { lat: string; lng: string; at: string } | null;
type RawTrackResult = {
  status?: string;
  milestones?: {
    at_pickup?: MilestoneSnapshot;
    pax_picked?: MilestoneSnapshot;
    at_drop?: MilestoneSnapshot;
    pax_dropped?: MilestoneSnapshot;
  };
  eta_minutes_to_next_stop?: number | null;
};

const MILESTONE_DEFS: { key: keyof NonNullable<RawTrackResult["milestones"]>; label: string; activeStatus: string }[] = [
  { key: "at_pickup", label: "At pickup", activeStatus: "AT_PICKUP" },
  { key: "pax_picked", label: "Passenger picked up", activeStatus: "PAX_PICKED" },
  { key: "at_drop", label: "At drop", activeStatus: "AT_DROP" },
  { key: "pax_dropped", label: "Passenger dropped off", activeStatus: "PAX_DROPPED" },
];

function toTrackDetail(raw: RawTrackResult | null | undefined): TrackDetail | null {
  if (!raw) return null;
  const milestones: TrackMilestone[] = MILESTONE_DEFS.map(({ key, label, activeStatus }) => {
    const snap = raw.milestones?.[key];
    return {
      label,
      status: snap ? "DONE" : raw.status === activeStatus ? "ACTIVE" : "PENDING",
      arrivedAt: snap?.at ?? null,
    };
  });
  return { etaMinutes: raw.eta_minutes_to_next_stop ?? null, milestones };
}

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

  // Coordinates have crashed here once already from a real, upstream string-vs-number mismatch
  // (core.positions.Position keeps lat/lng as str at rest) — coerce defensively at this
  // boundary rather than trust every future backend response to have already converted them.
  const toNum = (value: unknown): number | undefined => {
    if (value == null) return undefined;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  // LiveMapComponent (and the position readout below) read flat lat/lng — the REST payload
  // nests them under `position` instead (apps.tracking.api.views.LiveTrackingView's shape), so
  // without this flattening no marker was EVER plotted, regardless of how many vehicles were in
  // the list: LiveMapComponent's own `pos.lat == null` guard silently skipped every one of them.
  useEffect(() => {
    if (!initialPositions) return;
    const map = new Map<string, LivePosition>();
    for (const pos of initialPositions) {
      if (!pos.trip_vehicle_id) continue;
      map.set(pos.trip_vehicle_id, {
        ...pos,
        lat: toNum(pos.position?.lat ?? pos.lat),
        lng: toNum(pos.position?.lng ?? pos.lng),
        speed: toNum(pos.position?.speed_kmh ?? pos.speed),
        heading: toNum(pos.position?.heading ?? pos.heading),
        timestamp: pos.position?.at ?? pos.timestamp,
      });
    }
    livePositionsRef.current = map;
    setPositionsTick((t) => t + 1);
  }, [initialPositions]);

  // The real broadcast (apps.tracking.tasks: {"type": "dispatch.event", "event_type":
  // "tracking.position", "payload": {trip_vehicle_id, lat, lng, speed_kmh, heading, at, ...}})
  // keys on trip_vehicle_id, never device_id — and normalizeFrame only lifts trip_vehicle_id
  // (as tripVehicleId) plus a few other ids to the event's top level, not lat/lng/speed/heading/
  // timestamp at all, so the old `const {deviceId, lat, lng, ...} = event` destructure read
  // undefined for literally every field it used. This event carries no distinct `TrackingEvent`
  // shape at runtime; read the raw payload instead of trusting that type.
  const handleTrackingEvent = useCallback(
    (payload: Record<string, unknown>) => {
      const tripVehicleId = payload.trip_vehicle_id;
      if (typeof tripVehicleId !== "string") return;
      const map = livePositionsRef.current;
      const existing = map.get(tripVehicleId);
      if (!existing) return; // not one of the currently-trackable vehicles — nothing to update
      map.set(tripVehicleId, {
        ...existing,
        lat: toNum(payload.lat) ?? existing.lat,
        lng: toNum(payload.lng) ?? existing.lng,
        speed: toNum(payload.speed_kmh) ?? existing.speed,
        heading: toNum(payload.heading) ?? existing.heading,
        timestamp: (payload.at as string | undefined) ?? existing.timestamp,
      });
      setPositionsTick((t) => t + 1);
    },
    []
  );

  useRideEvents({
    handler: (event) => {
      if (event.type === "tracking.position") {
        handleTrackingEvent((event as TrackingEvent).payload);
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
      const envelope = await resp.json() as { result?: RawTrackResult };
      return toTrackDetail(envelope.result);
    },
    enabled: !!selectedTripVehicleId,
  });

  const positions = Array.from(livePositionsRef.current.values());
  const activeCount = positions.filter((p) => p.status && !["COMPLETED", "CANCELLED"].includes(p.status)).length;
  const sosCount = positions.filter((p) => p.status === "SOS").length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-text-tertiary" /> Live Tracking
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">Real-time positions for every vehicle currently on a trip.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> Active
          </p>
          <p className="text-2xl font-bold text-white mt-1">{activeCount}</p>
        </div>
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Total on map
          </p>
          <p className="text-2xl font-bold text-white mt-1">{positions.length}</p>
        </div>
        <div className={`${sosCount > 0 ? "bg-danger" : "bg-ops-sidebar"} rounded-xl p-4`}>
          <p className="text-xs text-white/60 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> SOS
          </p>
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
                <Button size="sm" variant="ghost" onClick={() => setSelectedTripVehicleId(null)}>
                  <X className="w-3.5 h-3.5" /> Close
                </Button>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {pos.marker_color && (
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: markerHex(pos.marker_color) }}
                        />
                      )}
                      {pos.reference && (
                        <span className="font-mono text-sm font-semibold text-text-primary">{pos.reference}</span>
                      )}
                      {pos.status && <StatusBadge status={pos.status as VehicleStatus} />}
                      {pos.status === "SOS" && <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {pos.plate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-mono">
                          <Car className="w-3 h-3 text-accent-gold" /> {pos.plate}
                        </span>
                      )}
                      {pos.driver_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                          <User className="w-3 h-3" /> {pos.driver_name}
                        </span>
                      )}
                      {pos.speed != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                          <Gauge className="w-3 h-3" /> {pos.speed} km/h
                        </span>
                      )}
                    </div>
                    {pos.lat != null && pos.lng != null ? (
                      <p className="text-[11px] text-text-tertiary flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {pos.lat.toFixed(4)}, {pos.lng.toFixed(4)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-text-tertiary italic">No position reported yet</p>
                    )}
                  </div>
                  <div
                    title="Focus on map"
                    className={`shrink-0 p-1.5 rounded-lg ${
                      selectedTripVehicleId === pos.trip_vehicle_id
                        ? "bg-brand-blue text-white"
                        : "text-text-tertiary"
                    }`}
                  >
                    <LocateFixed className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
