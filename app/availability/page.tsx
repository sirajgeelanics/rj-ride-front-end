"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, keys } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PII } from "@/components/ui/PII";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Building2, Car, Radio, RefreshCw, Search, User, X } from "lucide-react";

type Vendor = components["schemas"]["Vendor"];
type VehicleType = components["schemas"]["VehicleType"];
type ApiVehicle = components["schemas"]["Vehicle"];

interface AvailabilitySnapshot {
  airport_code: string;
  at: string;
  cars: {
    vehicle_number: string;
    vehicle_type: string;
    vehicle_name: string | null;
    vendor: string;
  }[];
  drivers: { name: string; vendor: string }[];
}

/** The Availability page (commit 21). See the endpoint's docstring in the backend. */
export default function AvailabilityPage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  // Airport options come from the vendors' airport_code dimension; the snapshot + remembered
  // airport come from the RITMO availability endpoint (raw, not in the committed OpenAPI schema).
  const vendorsQ = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      // Pull the whole pool — the default 25/page would silently drop airports from the filter.
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {
        params: { query: { page_size: 100 } },
      });
      if (err) throw err;
      return res;
    },
  });

  // Optional "availability at" time. Empty = right now. A local "YYYY-MM-DDTHH:mm" from the picker,
  // converted to an ISO instant for the backend's schedule-aware ?at filter.
  const [atLocal, setAtLocal] = useState<string>("");
  const atISO = atLocal ? new Date(atLocal).toISOString() : "";

  // Vehicle-type filter (narrows the cars list only — drivers have no type of their own).
  const [vehicleTypeId, setVehicleTypeId] = useState<string>("");

  const vehicleTypesQ = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      return { results: await fetchAllPages<VehicleType>("/api/v1/config/vehicle-types/") };
    },
  });
  const allVehicleTypes = (vehicleTypesQ.data?.results ?? []) as VehicleType[];

  // The full catalogue can carry types no vendor has actually put a vehicle against yet (e.g.
  // freshly added types) — those would just be dead options in the filter. Narrow it to types
  // that at least one vendor's fleet actually has a vehicle of.
  const fleetVehiclesQ = useQuery({
    queryKey: keys.fleet.vehicles.list({ all: true }),
    queryFn: async () => {
      return { results: await fetchAllPages<ApiVehicle>("/api/v1/fleet/vehicles/") };
    },
  });
  const vehicleTypeIdsInFleet = useMemo(() => {
    const ids = new Set<string>();
    for (const v of (fleetVehiclesQ.data?.results ?? []) as ApiVehicle[]) {
      ids.add(v.vehicle_type);
    }
    return ids;
  }, [fleetVehiclesQ.data]);
  const vehicleTypes = allVehicleTypes.filter((vt) => vehicleTypeIdsInFleet.has(vt.id));

  const snapshotQ = useQuery({
    queryKey: ["ritmo", "availability", atISO, vehicleTypeId],
    queryFn: async (): Promise<AvailabilitySnapshot> => {
      const params = new URLSearchParams();
      if (atISO) params.set("at", atISO);
      if (vehicleTypeId) params.set("vehicle_type", vehicleTypeId);
      const qs = params.toString();
      const url = `/api/v1/ritmo/availability/${qs ? `?${qs}` : ""}`;
      const resp = await csrfFetch(url, { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load availability (${resp.status})`);
      const body = (await resp.json()) as { result: AvailabilitySnapshot };
      return body.result;
    },
    // When pinned to a specific time the data is static — no need to poll; only the live view refreshes.
    refetchInterval: atISO ? false : 15_000,
  });

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const v of (vendorsQ.data?.results ?? []) as Vendor[]) {
      const code = (v as { airport_code?: string }).airport_code;
      if (code) set.add(code);
    }
    return [...set].sort();
  }, [vendorsQ.data]);

  const snapshot = snapshotQ.data;
  const rememberedCity = snapshot?.airport_code ?? "";

  const changeCity = async (city: string) => {
    try {
      const resp = await csrfFetch("/api/v1/ritmo/availability/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ airport_code: city || undefined }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(body?.error?.message ?? `Failed to set city (${resp.status})`);
      }
      // The remembered city changed on the backend — refetch every time-variant of the snapshot.
      void qc.invalidateQueries({ queryKey: ["ritmo", "availability"] });
      addToast(`Availability filter set to ${city || "all cities"}.`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to set city", "error");
    }
  };

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const allCars = snapshot?.cars ?? [];
  const allDrivers = snapshot?.drivers ?? [];
  const cars = q
    ? allCars.filter((c) =>
        [c.vehicle_number, c.vehicle_type, c.vehicle_name, c.vendor]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q))
      )
    : allCars;
  const drivers = q
    ? allDrivers.filter((d) =>
        [d.name, d.vendor].filter(Boolean).some((f) => String(f).toLowerCase().includes(q))
      )
    : allDrivers;
  const loading = snapshotQ.isLoading;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Radio className="w-5 h-5 text-brand-wine" />
              Fleet Availability
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Cars and drivers free right now, across every vendor — updates the moment one is taken or freed.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void snapshotQ.refetch()}
          disabled={snapshotQ.isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${snapshotQ.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* City + date-time filter. City is remembered by the backend (drives the automatic RITMO
          pushes); the date-time is a local, schedule-aware "who's free at this moment" view. */}
      <Card padding="md" className="bg-ops-bg">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <label className="block text-xs text-text-secondary mb-1">Airport code</label>
            <SearchableSelect
              value={rememberedCity}
              onChange={(val) => void changeCity(val)}
              options={cities.map((c) => ({ value: c, label: c }))}
              placeholder="All airports"
              clearable
            />
          </div>
          <div className="w-56">
            <label className="block text-xs text-text-secondary mb-1">Vehicle type</label>
            <SearchableSelect
              value={vehicleTypeId}
              onChange={setVehicleTypeId}
              options={vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name }))}
              placeholder="All vehicle types"
              clearable
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Available at</label>
            <div className="flex items-center gap-2">
              <div className="w-56">
                <DateTimePicker
                  mode="datetime"
                  value={atLocal}
                  placeholder="Right now"
                  onChange={setAtLocal}
                />
              </div>
              {atLocal && (
                <Button variant="secondary" size="sm" onClick={() => setAtLocal("")}>
                  Now
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="py-10 text-center text-sm text-text-secondary">Loading availability…</div>
      ) : snapshotQ.isError ? (
        <Card padding="lg" className="bg-white text-center text-text-secondary py-10">
          <p>Could not load availability. Refresh to try again.</p>
        </Card>
      ) : (
        <>
          {(allCars.length > 0 || allDrivers.length > 0) && (
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by plate, model, driver, or vendor…"
                className="w-full pl-9 pr-9 py-2 bg-white border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-ops-card2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="md" className="bg-white">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <Car className="w-4 h-4 text-brand-wine" />
              Available cars ({cars.length}{q ? ` of ${allCars.length}` : ""})
            </h4>
            {cars.length === 0 ? (
              <p className="text-xs text-text-tertiary mt-2">
                {q ? (
                  `No available cars match “${search}”.`
                ) : (
                  <>
                    No available cars{rememberedCity ? ` in ${rememberedCity}` : ""}
                    {vehicleTypeId
                      ? ` of type ${vehicleTypes.find((vt) => vt.id === vehicleTypeId)?.name ?? ""}`
                      : ""}
                    {atLocal ? ` at ${new Date(atLocal).toLocaleString()}` : ""}.
                  </>
                )}
              </p>
            ) : (
              <div className="mt-3 space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {cars.map((c) => (
                  <div
                    key={c.vehicle_number}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-white hover:bg-ops-bg/60 transition-colors"
                  >
                    <span className="font-mono text-sm font-medium text-text-primary">
                      {c.vehicle_number}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {c.vehicle_type}
                      {c.vehicle_name ? ` · ${c.vehicle_name}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium shrink-0">
                      <Building2 className="w-3 h-3" /> {c.vendor}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card padding="md" className="bg-white">
            <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand-wine" />
              Available drivers ({drivers.length}{q ? ` of ${allDrivers.length}` : ""})
            </h4>
            {drivers.length === 0 ? (
              <p className="text-xs text-text-tertiary mt-2">
                {q ? (
                  `No drivers match “${search}”.`
                ) : (
                  <>
                    No drivers available{rememberedCity ? ` in ${rememberedCity}` : ""}
                    {atLocal ? ` at ${new Date(atLocal).toLocaleString()}` : ""}.
                  </>
                )}
              </p>
            ) : (
              <div className="mt-3 space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
                {drivers.map((d) => (
                  <div
                    key={`${d.name}-${d.vendor}`}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border bg-white hover:bg-ops-bg/60 transition-colors"
                  >
                    <span className="text-sm font-medium text-text-primary">
                      <PII value={d.name} type="name" />
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium shrink-0">
                      <Building2 className="w-3 h-3" /> {d.vendor}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          </div>
        </>
      )}
    </div>
  );
}
