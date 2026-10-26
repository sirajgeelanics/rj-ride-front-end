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
import { Navigation, AlertCircle, MapPin, MapIcon, Gauge, User, Car, X, LocateFixed, Key, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { markerHex } from "@/components/tracking/markerColors";
import { dynamic } from "@/lib/router";

type LivePosition = {
  trip_vehicle_id: string;
  trip_id?: string;
  reference?: string;
  vehicle_id?: string | null;
  plate?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  status?: string;
  // Only set for a "full fleet" entry (apps.tracking.api.views.FleetLocationsView) — the
  // coarser fleet.Location vocabulary (active/on_trip/breakdown/not_available), distinct
  // from `status`'s TripVehicle vocabulary, which a fleet entry never has.
  fleet_status?: string;
  isFleetEntry?: boolean;
  marker_color?: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  device_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  heading?: number | null;
  ignition?: boolean | null;
  motion?: boolean | null;
  timestamp?: string;
  position?: {
    lat: number;
    lng: number;
    speed_kmh?: number;
    heading?: number;
    ignition?: boolean | null;
    motion?: boolean | null;
    at?: string;
  } | null;
};

// apps.tracking.api.views.FleetLocationsView's raw response shape — every tracked vehicle's
// last position regardless of trip state, the "full fleet" toggle's data source.
type FleetVehicle = {
  vehicle_id: string;
  plate?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  fleet_status: string;
  marker_color: string;
  lat: number;
  lng: number;
  ignition?: boolean | null;
  motion?: boolean | null;
  last_updated: string;
};

function fleetVehicleToPosition(fv: FleetVehicle): LivePosition {
  return {
    trip_vehicle_id: fv.vehicle_id, // reused purely as LiveMapComponent's marker key
    vehicle_id: fv.vehicle_id,
    plate: fv.plate,
    vendor_id: fv.vendor_id,
    vendor_name: fv.vendor_name,
    fleet_status: fv.fleet_status,
    isFleetEntry: true,
    marker_color: fv.marker_color,
    lat: fv.lat,
    lng: fv.lng,
    ignition: fv.ignition,
    motion: fv.motion,
    timestamp: fv.last_updated,
  };
}

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
    <div className="h-[75vh] min-h-[560px] skeleton flex items-center justify-center text-text-secondary text-sm">
      Loading map…
    </div>
  ),
});

export default function TrackingPage() {
  const addToast = useToastStore((s) => s.addToast);

  // Browser-reachable Traccar URL (distinct from the backend's internal TRACCAR_BASE_URL,
  // which uses a docker-internal hostname the browser can never reach) — unset hides the link
  // entirely. Traccar runs as its own separate app now (not embedded here — cross-origin
  // iframe embedding broke its session cookie, see the "redirect link only" decision), so this
  // is just a plain link out to it. Read via `process.env`, same as NEXT_PUBLIC_WS_ORIGIN
  // elsewhere in this codebase (src/lib/envShim.ts mirrors Vite's import.meta.env into
  // process.env for every NEXT_PUBLIC_* key before anything else loads).
  const traccarUrl = process.env["NEXT_PUBLIC_TRACCAR_URL"] || "";

  const [selectedTripVehicleId, setSelectedTripVehicleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"active" | "fleet">("active");

  useEffect(() => {
    setSelectedTripVehicleId(null);
  }, [viewMode]);

  const livePositionsRef = useRef<Map<string, LivePosition>>(new Map());
  const [positionsTick, setPositionsTick] = useState(0);

  const { data: initialPositions, isLoading: isLoadingActive } = useQuery<LivePosition[]>({
    queryKey: keys.tracking.live(),
    queryFn: async () => {
      const resp = await fetch("/api/v1/tracking/live/", { credentials: "include" });
      if (!resp.ok) throw new Error(`tracking/live failed: ${resp.status}`);
      const envelope = await resp.json() as { result?: { vehicles?: LivePosition[] } };
      return (envelope.result?.vehicles ?? []) as LivePosition[];
    },
    refetchInterval: 60_000,
    enabled: viewMode === "active",
  });

  // The "full fleet" toggle (apps.tracking.api.views.FleetLocationsView) — every tracked
  // vehicle regardless of trip state. No WS push covers idle vehicles (broadcast_positions
  // only broadcasts on-trip ones), so this polls more often to make up for it.
  const { data: fleetVehicles, isLoading: isLoadingFleet } = useQuery<FleetVehicle[]>({
    queryKey: keys.tracking.fleet(),
    queryFn: async () => {
      const resp = await fetch("/api/v1/tracking/fleet/", { credentials: "include" });
      if (!resp.ok) throw new Error(`tracking/fleet failed: ${resp.status}`);
      const envelope = await resp.json() as { result?: { vehicles?: FleetVehicle[] } };
      return (envelope.result?.vehicles ?? []) as FleetVehicle[];
    },
    refetchInterval: 20_000,
    enabled: viewMode === "fleet",
  });

  const isLoading = viewMode === "active" ? isLoadingActive : isLoadingFleet;

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
    if (viewMode === "fleet") {
      const map = new Map<string, LivePosition>();
      for (const fv of fleetVehicles ?? []) {
        map.set(fv.vehicle_id, fleetVehicleToPosition(fv));
      }
      livePositionsRef.current = map;
      setPositionsTick((t) => t + 1);
      return;
    }

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
        ignition: pos.position?.ignition ?? pos.ignition ?? null,
        motion: pos.position?.motion ?? pos.motion ?? null,
        timestamp: pos.position?.at ?? pos.timestamp,
      });
    }
    livePositionsRef.current = map;
    setPositionsTick((t) => t + 1);
  }, [initialPositions, fleetVehicles, viewMode]);

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
        ignition:
          typeof payload.ignition === "boolean" ? payload.ignition : existing.ignition ?? null,
        motion: typeof payload.motion === "boolean" ? payload.motion : existing.motion ?? null,
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
  const fleetOnTripCount = positions.filter((p) => p.fleet_status === "on_trip").length;
  const breakdownCount = positions.filter((p) => p.fleet_status === "breakdown").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-medium tracking-tight text-text-primary flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-accent-gold" /> Live Tracking
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {viewMode === "active"
              ? "Real-time positions for every vehicle currently on a trip."
              : "Every tracked vehicle's last-known position, on a trip or idle."}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!!traccarUrl && (
            <a
              href={traccarUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Opens Traccar's own app in a new tab — separate login, not linked to RIDE trips."
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-border bg-white text-text-secondary hover:bg-page-bg transition-colors"
            >
              Traccar <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div className="inline-flex rounded-xl border border-border bg-white p-1">
            <button
              onClick={() => setViewMode("active")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "active" ? "bg-brand-blue text-white" : "text-text-secondary"
              }`}
            >
              Active trips
            </button>
            <button
              onClick={() => setViewMode("fleet")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "fleet" ? "bg-brand-blue text-white" : "text-text-secondary"
              }`}
            >
              Full fleet
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger">
        {viewMode === "active" ? (
          <>
            <div className="bg-white border border-border shadow-soft rounded-2xl p-4 hover-lift">
              <p className="eyebrow flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" /> Active
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{activeCount}</p>
            </div>
            <div className="bg-white border border-border shadow-soft rounded-2xl p-4 hover-lift">
              <p className="eyebrow flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Total on map
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{positions.length}</p>
            </div>
            <div className={`${sosCount > 0 ? "bg-danger-soft border-danger/30" : "bg-white border-border"} border shadow-soft rounded-2xl p-4`}>
              <p className="eyebrow flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> SOS
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{sosCount}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-border shadow-soft rounded-2xl p-4 hover-lift">
              <p className="eyebrow flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5" /> On trip
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{fleetOnTripCount}</p>
            </div>
            <div className="bg-white border border-border shadow-soft rounded-2xl p-4 hover-lift">
              <p className="eyebrow flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Total tracked
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{positions.length}</p>
            </div>
            <div className={`${breakdownCount > 0 ? "bg-danger-soft border-danger/30" : "bg-white border-border"} border shadow-soft rounded-2xl p-4`}>
              <p className="eyebrow flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Breakdown
              </p>
              <p className="text-3xl font-semibold tabular-nums text-text-primary mt-2">{breakdownCount}</p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card padding="lg" header={<h3 className="font-serif text-xl font-medium">Fleet Map</h3>}>
            {isLoading ? (
              <div className="h-[75vh] min-h-[560px] skeleton flex items-center justify-center text-text-secondary text-sm">
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
          <div className="space-y-3 overflow-y-auto pr-1 max-h-[75vh]">
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
                      {pos.isFleetEntry ? (
                        <Badge variant={pos.fleet_status === "breakdown" ? "red" : pos.fleet_status === "on_trip" ? "blue" : "default"}>
                          {(pos.fleet_status ?? "unknown").replace("_", " ")}
                        </Badge>
                      ) : (
                        <>
                          {pos.reference && (
                            <span className="font-mono text-sm font-semibold text-text-primary">{pos.reference}</span>
                          )}
                          {pos.status && <StatusBadge status={pos.status as VehicleStatus} />}
                          {pos.status === "SOS" && <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />}
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {pos.plate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-mono">
                          <Car className="w-3 h-3 text-accent-gold" /> {pos.plate}
                        </span>
                      )}
                      {pos.isFleetEntry && pos.vendor_name && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                          {pos.vendor_name}
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
                      {/* Not every device/ping reports ignition (a driver-app GPS fix never
                          does, only hardware trackers with OBD/ignition wiring) — omit the
                          badge entirely rather than show a misleading "off" default. */}
                      {pos.ignition != null && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            pos.ignition
                              ? "bg-green-100 text-green-700"
                              : "bg-ops-card2 text-text-secondary"
                          }`}
                        >
                          <Key className="w-3 h-3" /> {pos.ignition ? "Ignition on" : "Ignition off"}
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
    </div>
  );
}
