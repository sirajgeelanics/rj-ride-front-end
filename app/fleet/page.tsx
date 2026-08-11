"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, useLanguageStore, t } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useVendorTrips } from "@/hooks/useVendorTrips";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { Truck, Users } from "lucide-react";

type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

const TABS = [
  { id: "vehicles", label: "Vehicles" },
  { id: "drivers", label: "Drivers" },
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

function FleetStatusBadge({ isActive, onTrip }: { isActive: boolean; onTrip: boolean }) {
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

function VehiclesTab({ onTripIds }: { onTripIds: Set<string> }) {
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: keys.fleet.vehicles.list({ all: true }),
    queryFn: fetchAllVehicles,
  });

  const typeCounts = useMemo(() => countByType(vehicles, onTripIds), [vehicles, onTripIds]);

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

      <div className="space-y-3">
      {vehicles.map((vehicle) => (
        <div key={vehicle.id} className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-blue/10 rounded-lg flex items-center justify-center shrink-0">
                <Truck className="w-5 h-5 text-brand-blue" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-text-primary font-mono">{vehicle.plate}</span>
                  <FleetStatusBadge isActive={vehicle.is_active !== false} onTrip={onTripIds.has(vehicle.id)} />
                </div>
                {vehicle.vehicle_type_name && (
                  <p className="text-sm text-text-muted">{vehicle.vehicle_type_name}</p>
                )}
              </div>
            </div>
            <span className="text-xs font-mono text-text-muted">{vehicle.id.substring(0, 8)}…</span>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function DriversTab({ onTripIds }: { onTripIds: Set<string> }) {
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
  });

  if (isLoading) return <div className="text-center py-8 text-text-muted text-sm">Loading drivers…</div>;
  if (drivers.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <Users className="w-10 h-10 text-text-muted mx-auto" />
      <p className="text-text-muted text-sm">No drivers found</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {drivers.map((driver) => (
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
            <span className="text-xs font-mono text-text-muted">{driver.id.substring(0, 8)}…</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FleetPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("vehicles");
  const { vehicleIds, driverIds } = useOnTripSets();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{t("fleet", language)}</h2>
        <p className="text-sm text-text-muted mt-1">Manage your vehicles and drivers</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "vehicles" && <VehiclesTab onTripIds={vehicleIds} />}
      {activeTab === "drivers" && <DriversTab onTripIds={driverIds} />}
    </div>
  );
}
