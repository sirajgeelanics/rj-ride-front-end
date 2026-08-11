"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PII } from "@/components/ui/PII";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { MapPin, Car, User, Filter, X, Search } from "lucide-react";

type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];
type Location = components["schemas"]["Location"];
type Vendor = components["schemas"]["Vendor"];

/**
 * City + date fleet filter on the Trip Requests page.
 *
 * The city dimension lives on the vendor (vendor.city, populated by the backend
 * `populate_vendor_cities` command). A car or driver is "in the city" when its vendor
 * operates there — the result deliberately spans every vendor, because the agency plans
 * trips across the whole pool, not vendor by vendor.
 *
 * Date narrows cars to those whose last GPS fix was updated that day (a fresh position
 * means the car is realistically available there). Drivers have no GPS, so they are
 * filtered by city only.
 */
export const FleetFilterPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [applied, setApplied] = useState(false);

  const vendorsQ = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      // The backend paginates at 25 (max 100) per page; a partial vendor list would silently
      // hide cities from the filter, so pull the whole pool in one request.
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {
        params: { query: { page_size: 100 } },
      });
      if (err) throw err;
      return res;
    },
  });

  // The backend paginates at 25 (max 100) per page; the agency pool can exceed that,
  // so pull the whole fleet in one request — a partial list would silently hide cars
  // and drivers the dispatcher should see.
  const POOL_PAGE_SIZE = 100;

  const vehiclesQ = useQuery({
    queryKey: keys.fleet.vehicles.list({ page_size: POOL_PAGE_SIZE }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {
        params: { query: { page_size: POOL_PAGE_SIZE } },
      });
      if (err) throw err;
      return res;
    },
  });

  const driversQ = useQuery({
    queryKey: keys.fleet.drivers.list({ page_size: POOL_PAGE_SIZE }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {
        params: { query: { page_size: POOL_PAGE_SIZE } },
      });
      if (err) throw err;
      return res;
    },
  });

  const locationsQ = useQuery({
    queryKey: keys.fleet.locations.list({ page_size: POOL_PAGE_SIZE }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/locations", {
        params: { query: { page_size: POOL_PAGE_SIZE } },
      });
      if (err) throw err;
      return res;
    },
  });

  const vendors = (vendorsQ.data?.results ?? []) as Vendor[];
  const vehicles = (vehiclesQ.data?.results ?? []) as Vehicle[];
  const drivers = (driversQ.data?.results ?? []) as Driver[];
  const locations = (locationsQ.data?.results ?? []) as Location[];

  const loading =
    vendorsQ.isLoading || vehiclesQ.isLoading || driversQ.isLoading || locationsQ.isLoading;

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const v of vendors) {
      if (v.city) set.add(v.city);
    }
    return [...set].sort();
  }, [vendors]);

  const vendorCityById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vendors) map.set(v.id, v.city);
    return map;
  }, [vendors]);

  const locationByVehicle = useMemo(() => {
    const map = new Map<string, Location>();
    for (const l of locations) map.set(l.vehicle, l);
    return map;
  }, [locations]);

  const dateMatches = (iso: string | undefined | null): boolean => {
    if (!date || !iso) return false;
    // Backend timestamps carry the server's +05:30 offset; slicing the raw string
    // keeps the server-local calendar date, where toISOString() would bucket a
    // pre-midnight-UTC fix onto the previous day.
    return iso.slice(0, 10) === date;
  };

  const inCity = (vendorId: string): boolean => {
    if (!city) return true; // no city selected → everything qualifies
    return vendorCityById.get(vendorId) === city;
  };

  const filteredVehicles = useMemo(() => {
    if (!applied) return [];
    return vehicles.filter((v) => {
      if (!inCity(v.vendor)) return false;
      if (!date) return true;
      return dateMatches(locationByVehicle.get(v.id)?.last_updated);
    });
  }, [applied, vehicles, city, date, vendorCityById, locationByVehicle]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDrivers = useMemo(() => {
    if (!applied) return [];
    return drivers.filter((d) => inCity(d.vendor));
  }, [applied, drivers, city, vendorCityById]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => setApplied(true);
  const reset = () => {
    setApplied(false);
    setCity("");
    setDate("");
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          open || applied
            ? "border-brand-wine/40 bg-brand-wine/5 text-brand-wine"
            : "border-border bg-white text-text-secondary hover:bg-ops-card2 hover:text-text-primary"
        }`}
        aria-expanded={open}
      >
        <Filter className="w-4 h-4" />
        Fleet by city & date
        {applied && <Badge variant="green">filtered</Badge>}
      </button>

      {open && (
        <Card padding="md" className="bg-ops-bg">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-3 py-2 bg-white border border-border rounded-lg text-sm text-text-primary"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Fix date</label>
              <DateTimePicker
                mode="date"
                value={date}
                onChange={(val) => setDate(val ?? "")}
              />
            </div>
            <Button onClick={apply} variant="primary" size="sm" className="mb-0.5">
              <Search className="w-3.5 h-3.5 mr-1" /> Apply filter
            </Button>
            {applied && (
              <Button onClick={reset} variant="ghost" size="sm" className="mb-0.5">
                <X className="w-3.5 h-3.5 mr-1" /> Clear
              </Button>
            )}
          </div>

          {applied && (
            <div className="mt-4 space-y-4">
              {/* Cars */}
              <div>
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-brand-wine" />
                  Cars {filteredVehicles.length > 0 && `(${filteredVehicles.length})`}
                </h4>
                {filteredVehicles.length === 0 ? (
                  <p className="text-xs text-text-tertiary mt-2">
                    {loading
                      ? "Loading fleet…"
                      : `No cars match ${city || "any city"}${date ? ` with a fix on ${date}` : ""}.`}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {filteredVehicles.map((v) => {
                      const loc = locationByVehicle.get(v.id);
                      return (
                        <div
                          key={v.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-white"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-medium text-text-primary">
                              {v.plate}
                            </span>
                            <span className="text-xs text-text-secondary">{v.vehicle_type_name}</span>
                            <span className="text-xs text-text-tertiary">{v.vendor_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            {loc ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-text-secondary">
                                  <MapPin className="w-3 h-3" />
                                  {Number(loc.lat).toFixed(4)}, {Number(loc.lng).toFixed(4)}
                                </span>
                                <Badge variant={loc.status === "active" ? "green" : "amber"}>
                                  {loc.status}
                                </Badge>
                              </>
                            ) : (
                              <Badge variant="amber">no fix</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Drivers */}
              <div>
                <h4 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                  <User className="w-4 h-4 text-brand-wine" />
                  Drivers {filteredDrivers.length > 0 && `(${filteredDrivers.length})`}
                </h4>
                {filteredDrivers.length === 0 ? (
                  <p className="text-xs text-text-tertiary mt-2">
                    {loading ? "Loading fleet…" : `No drivers match ${city || "any city"}.`}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {filteredDrivers.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-white"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-text-primary">
                            <PII value={d.name} type="name" />
                          </span>
                          <span className="text-xs text-text-secondary">
                            <PII value={d.phone} type="phone" />
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-text-tertiary">{d.vendor_name}</span>
                          <Badge
                            variant={
                              d.status === "AVAILABLE"
                                ? "green"
                                : d.status === "ON_TRIP"
                                  ? "blue"
                                  : "amber"
                            }
                          >
                            {d.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

FleetFilterPanel.displayName = "FleetFilterPanel";
