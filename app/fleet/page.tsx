"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, keys, useLanguageStore, t } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useVendorTrips } from "@/hooks/useVendorTrips";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { Truck, Users, Wrench, Search, X } from "lucide-react";

type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

const TABS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "drivers", label: "Drivers" },
  { id: "breakdown", label: "Breakdown" },
];

// A vehicle/driver counts as "on trip" while its trip-vehicle is in any live (non-PENDING,
// non-terminal) state. PENDING has no vehicle yet; COMPLETED/CANCELLED/NO_SHOW are done.
const ON_TRIP_STATUSES = new Set([
  "ASSIGNED",
  "DRIVER_ACCEPTED",
  "EN_ROUTE_PICKUP",
  "AT_PICKUP",
  "PAX_PICKED",
  "IN_TRANSIT",
  "AT_DROP",
  "PAX_DROPPED",
  "BREAKDOWN",
  "ACCIDENT",
  "VEHICLE_SWAP",
  "DELAYED",
  "SOS",
]);

/** Sets of vehicle ids and driver ids currently committed to a live trip. */
function useOnTripSets(): { vehicleIds: Set<string>; driverIds: Set<string> } {
  const { data: trips = [] } = useVendorTrips();
  return useMemo(() => {
    const vehicleIds = new Set<string>();
    const driverIds = new Set<string>();
    for (const trip of trips) {
      for (const tv of trip.vehicles ?? []) {
        if (ON_TRIP_STATUSES.has(tv.status)) {
          if (tv.vehicle) vehicleIds.add(tv.vehicle);
          if (tv.driver) driverIds.add(tv.driver);
        }
      }
    }
    return { vehicleIds, driverIds };
  }, [trips]);
}

function FleetStatusBadge({
  isActive,
  onTrip,
  brokenDown,
}: {
  isActive: boolean;
  onTrip: boolean;
  brokenDown?: boolean;
}) {
  // Broken-down takes priority over everything else — it's the one state that needs a vendor
  // to actually go do something (get it fixed, then mark it repaired) rather than just wait.
  if (brokenDown) return <StatusBadge status="BREAKDOWN" />;
  if (isActive === false) return <StatusBadge status="OFFLINE" />;
  return <StatusBadge status={onTrip ? "ON_TRIP" : "AVAILABLE"} />;
}

/**
 * Every vehicle, following the cursor to the end.
 *
 * The list endpoint is cursor-paginated at 25/page, so a single GET would make the per-type
 * counts below silently mean "of the first 25" for any vendor with a larger fleet. `next` is a
 * full URL, so the cursor has to be pulled back out of it — passing the URL itself as `cursor`
 * 404s. The page cap is a runaway guard, not an expected limit.
 */
async function fetchAllVehicles(): Promise<Vehicle[]> {
  const all: Vehicle[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 40; page++) {
    const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {
      params: { query: cursor ? { cursor } : {} },
    });
    if (err) throw err;
    all.push(...((res?.results ?? []) as Vehicle[]));

    const next = res?.next;
    if (!next) break;
    cursor = new URL(next, window.location.origin).searchParams.get("cursor") ?? undefined;
    if (!cursor) break;
  }
  return all;
}

type TypeCount = {
  name: string;
  total: number;
  available: number;
  onTrip: number;
  offline: number;
};

/** Per-vehicle-type tallies, biggest group first. */
function countByType(vehicles: Vehicle[], onTripIds: Set<string>): TypeCount[] {
  const byType = new Map<string, TypeCount>();

  for (const v of vehicles) {
    const name = v.vehicle_type_name || "Unspecified";
    let row = byType.get(name);
    if (!row) {
      row = { name, total: 0, available: 0, onTrip: 0, offline: 0 };
      byType.set(name, row);
    }
    row.total += 1;
    // Mirrors FleetStatusBadge exactly, so the cards and the list can never disagree:
    // inactive wins over on-trip.
    if (v.is_active === false) row.offline += 1;
    else if (onTripIds.has(v.id)) row.onTrip += 1;
    else row.available += 1;
  }

  return [...byType.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

function VehicleTypeSummary({ counts }: { counts: TypeCount[] }) {
  if (counts.length === 0) return null;
  const fleetTotal = counts.reduce((n, c) => n + c.total, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">By vehicle type</h3>
        <span className="text-xs text-text-muted">
          {fleetTotal} vehicle{fleetTotal === 1 ? "" : "s"} · {counts.length} type
          {counts.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {counts.map((c) => (
          <div key={c.name} className="bg-card-bg border border-card-border rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text-primary truncate" title={c.name}>
                {c.name}
              </span>
              <span className="text-xl font-bold text-brand-blue tabular-nums">{c.total}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-text-muted">
              <span className="text-success">{c.available} available</span>
              {c.onTrip > 0 && <span>· {c.onTrip} on trip</span>}
              {c.offline > 0 && <span>· {c.offline} offline</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VehiclesTab({ onTripIds, search }: { onTripIds: Set<string>; search: string }) {
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: keys.fleet.vehicles.list({ all: true }),
    queryFn: fetchAllVehicles,
  });

  const typeCounts = useMemo(() => countByType(vehicles, onTripIds), [vehicles, onTripIds]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.plate, v.vehicle_type_name, v.vehicle_name_display]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [vehicles, q]);

  if (isLoading) return <div className="text-center py-8 text-text-muted text-sm">Loading vehicles…</div>;
  if (vehicles.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <Truck className="w-10 h-10 text-text-muted mx-auto" />
      <p className="text-text-muted text-sm">No vehicles found</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <VehicleTypeSummary counts={typeCounts} />

      {q && filtered.length === 0 ? (
        <p className="text-center py-8 text-text-muted text-sm">No vehicles match “{search}”.</p>
      ) : (
      <div className="space-y-3">
      {filtered.map((vehicle) => {
        const brokenDown = (vehicle as unknown as { status?: string }).status === "breakdown";
        return (
        <div key={vehicle.id} className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-blue/10 rounded-lg flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-brand-blue" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary font-mono">{vehicle.plate}</span>
                  <FleetStatusBadge
                    isActive={vehicle.is_active !== false}
                    onTrip={onTripIds.has(vehicle.id)}
                    brokenDown={brokenDown}
                  />
                </div>
                {(vehicle.vehicle_type_name || vehicle.vehicle_name_display) && (
                  <p className="text-sm text-text-muted">
                    {[vehicle.vehicle_type_name, vehicle.vehicle_name_display]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0">{vehicle.id.substring(0, 8)}…</span>
          </div>
        </div>
        );
      })}
      </div>
      )}
    </div>
  );
}

function DriversTab({ onTripIds, search }: { onTripIds: Set<string>; search: string }) {
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
  });

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return drivers;
    return drivers.filter((d) =>
      [d.name, d.phone].filter(Boolean).some((field) => String(field).toLowerCase().includes(q))
    );
  }, [drivers, q]);

  if (isLoading) return <div className="text-center py-8 text-text-muted text-sm">Loading drivers…</div>;
  if (drivers.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <Users className="w-10 h-10 text-text-muted mx-auto" />
      <p className="text-text-muted text-sm">No drivers found</p>
    </div>
  );
  if (q && filtered.length === 0) return (
    <p className="text-center py-8 text-text-muted text-sm">No drivers match “{search}”.</p>
  );

  return (
    <div className="space-y-3">
      {filtered.map((driver) => (
        <div key={driver.id} className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-success" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary">{driver.name}</span>
                  <FleetStatusBadge isActive={driver.is_active !== false} onTrip={onTripIds.has(driver.id)} />
                </div>
                <p className="text-sm text-text-muted font-mono">{driver.phone}</p>
              </div>
            </div>
            <span className="text-xs font-mono text-text-muted shrink-0">{driver.id.substring(0, 8)}…</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Everything currently needing attention because of a breakdown, in one place: the vehicle
 * itself (once physically repaired) and the driver it displaced (left showing ON_TRIP forever
 * otherwise — reassign_vehicle() only ever checks/changes the NEW driver's availability, never
 * the old one's, so nothing else ever clears them).
 */
function BreakdownTab({ driverTripIds }: { driverTripIds: Set<string> }) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: keys.fleet.vehicles.list({ all: true }),
    queryFn: fetchAllVehicles,
  });
  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
  });

  const markRepaired = useMutation({
    mutationFn: async (vehicleId: string) => {
      const resp = await csrfFetch(`/api/v1/fleet/vehicles/${vehicleId}/mark-repaired/`, {
        method: "POST",
      });
      const body = (await resp.json().catch(() => null)) as
        | { result?: unknown; error?: { message?: string } }
        | null;
      if (!resp.ok) throw new Error(body?.error?.message ?? `Request failed (${resp.status})`);
      return body?.result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.fleet.vehicles.list({ all: true }) });
      addToast("Vehicle marked back in service", "success");
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to mark vehicle repaired", "error");
    },
  });

  const markAvailable = useMutation({
    mutationFn: async (driverId: string) => {
      const resp = await csrfFetch(`/api/v1/fleet/drivers/${driverId}/mark-available/`, {
        method: "POST",
      });
      const body = (await resp.json().catch(() => null)) as
        | { result?: unknown; error?: { message?: string } }
        | null;
      if (!resp.ok) throw new Error(body?.error?.message ?? `Request failed (${resp.status})`);
      return body?.result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.fleet.drivers.list({}) });
      addToast("Driver marked available", "success");
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to mark driver available", "error");
    },
  });

  // `status` isn't in the generated schema yet — hand-typed, same as VehiclesTab/DriversTab.
  const brokenVehicles = vehicles.filter(
    (v) => (v as unknown as { status?: string }).status === "breakdown"
  );
  // Stuck: still shows ON_TRIP but isn't actually on any live trip anymore — the mismatch left
  // behind when reassign_vehicle() moves their trip to someone else without ever touching them.
  const stuckDrivers = drivers.filter(
    (d) => (d as unknown as { status?: string }).status === "ON_TRIP" && !driverTripIds.has(d.id)
  );

  if (vehiclesLoading || driversLoading) {
    return <div className="text-center py-8 text-text-muted text-sm">Loading…</div>;
  }

  if (brokenVehicles.length === 0 && stuckDrivers.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <Wrench className="w-10 h-10 text-text-muted mx-auto" />
        <p className="text-text-muted text-sm">
          Nothing needs attention — no broken-down vehicles or stuck drivers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {brokenVehicles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            Vehicles in breakdown ({brokenVehicles.length})
          </h3>
          {brokenVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-card-bg border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-danger" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-primary font-mono">{vehicle.plate}</span>
                      <StatusBadge status="BREAKDOWN" />
                    </div>
                    {(vehicle.vehicle_type_name || vehicle.vehicle_name_display) && (
                      <p className="text-sm text-text-muted">
                        {[vehicle.vehicle_type_name, vehicle.vehicle_name_display]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => markRepaired.mutate(vehicle.id)}
                  disabled={markRepaired.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Wrench className="w-3 h-3" />
                  {markRepaired.isPending ? "Marking…" : "Mark repaired"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {stuckDrivers.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Drivers needing to be freed up ({stuckDrivers.length})
            </h3>
            <p className="text-xs text-text-muted">
              Still showing on-trip, but their vehicle was reassigned to someone else — mark them
              available once they&apos;re genuinely free.
            </p>
          </div>
          {stuckDrivers.map((driver) => (
            <div key={driver.id} className="bg-card-bg border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-warning" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text-primary">{driver.name}</span>
                      <StatusBadge status="ON_TRIP" />
                    </div>
                    <p className="text-sm text-text-muted font-mono">{driver.phone}</p>
                  </div>
                </div>
                <button
                  onClick={() => markAvailable.mutate(driver.id)}
                  disabled={markAvailable.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Wrench className="w-3 h-3" />
                  {markAvailable.isPending ? "Marking…" : "Mark available"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const { vehicleIds, driverIds } = useOnTripSets();

  // Only vehicles/drivers are browsable directories worth searching — breakdown is already a
  // short, curated attention-list, not something ops needs to filter further.
  const searchable = activeTab === "vehicles" || activeTab === "drivers";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-muted mt-1">Manage your vehicles and drivers</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {searchable && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === "vehicles" ? "Search by plate, type, or model…" : "Search by driver name or phone…"}
            className="w-full pl-9 pr-9 py-2 bg-card-bg border border-card-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {activeTab === "vehicles" && <VehiclesTab onTripIds={vehicleIds} search={search} />}
      {activeTab === "drivers" && <DriversTab onTripIds={driverIds} search={search} />}
      {activeTab === "breakdown" && <BreakdownTab driverTripIds={driverIds} />}
    </div>
  );
}
