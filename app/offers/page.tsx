"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, isApiError, formatMoney, uuidv4 } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Inbox, RefreshCw, CheckCircle, Car, MapPin, User, Phone, Search } from "lucide-react";

type Vehicle = components["schemas"]["Vehicle"];

/** Just enough of a trip to work out which assets are busy. */
interface TripLite {
  id: string;
  vehicles?: { status: string; vehicle?: string | null; driver?: string | null }[];
}
type Driver = components["schemas"]["Driver"];

// The vendor-offer queue / accept endpoints are not in the committed OpenAPI schema, so we type
// them locally and drive them with csrfFetch (raw) instead of the typed apiClient.
interface OfferRow {
  id: string;
  trip_id: string;
  trip_vehicle_id: string;
  reference: string;
  vehicle_type: string;
  pickup_at: string | null;
  pickup: string | null;
  drop: string | null;
  passenger_name: string;
  passenger_phone: string;
  pax_count: number;
  locked_price_minor: number | null;
  currency: string | null;
  round: number;
  status: "OFFERED" | "ALERTED";
  offered_at: string;
  alerted_at: string | null;
  expires_alert_at: string;
  expires_at: string;
}

function countdown(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function OffersPage() {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState<OfferRow | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: offers = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["vendor", "offers"],
    queryFn: async (): Promise<OfferRow[]> => {
      const resp = await csrfFetch("/api/v1/vendor/offers/", { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load offers (${resp.status})`);
      const body = (await resp.json()) as { results?: OfferRow[] };
      return body.results ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["fleet", "vehicles"],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {});
      if (err) throw err;
      return (res?.results ?? []) as Vehicle[];
    },
    staleTime: 60_000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["fleet", "drivers"],
    queryFn: async (): Promise<Driver[]> => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
    staleTime: 60_000,
  });

  // This vendor's own trips — used only to work out which vehicles/drivers are already committed.
  const { data: myTrips = [] } = useQuery({
    queryKey: ["vendor", "trips", "for-availability"],
    queryFn: async (): Promise<TripLite[]> => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips", {});
      if (err) throw err;
      return ((res as unknown as { results?: TripLite[] })?.results ?? []) as TripLite[];
    },
    staleTime: 15_000,
  });

  const openAccept = (offer: OfferRow) => {
    setAccepting(offer);
    setVehicleId("");
    setDriverId("");
  };

  const submitAccept = async () => {
    if (!accepting) return;
    if (!vehicleId || !driverId) {
      addToast("Pick a vehicle and a driver.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await csrfFetch(`/api/v1/offers/${accepting.id}/accept/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
        body: JSON.stringify({ vehicle_id: vehicleId, driver_id: driverId }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Accept failed (${resp.status})`);
      }
      addToast("Offer accepted — trip assigned.", "success");
      setAccepting(null);
      void qc.invalidateQueries({ queryKey: ["vendor", "offers"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to accept",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const visibleOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      [o.reference, o.vehicle_type, o.passenger_name, o.passenger_phone, o.pickup, o.drop]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [offers, search]);

  // Assets already committed to a live trip: still listed, but greyed out and unselectable, so the
  // vendor sees the whole fleet and why something is unavailable. Freed the moment the trip ends.
  const { busyVehicleIds, busyDriverIds } = useMemo(() => {
    const ACTIVE = new Set([
      "ASSIGNED", "DRIVER_ACCEPTED", "EN_ROUTE_PICKUP", "AT_PICKUP", "PAX_PICKED",
      "IN_TRANSIT", "AT_DROP", "PAX_DROPPED", "BREAKDOWN", "ACCIDENT", "VEHICLE_SWAP", "DELAYED", "SOS",
    ]);
    const v = new Set<string>();
    const d = new Set<string>();
    for (const trip of myTrips) {
      for (const tv of trip.vehicles ?? []) {
        if (ACTIVE.has(tv.status)) {
          if (tv.vehicle) v.add(tv.vehicle);
          if (tv.driver) d.add(tv.driver);
        }
      }
    }
    return { busyVehicleIds: v, busyDriverIds: d };
  }, [myTrips]);

  const vehicleOptions = useMemo(
    () =>
      vehicles
        .filter((v) => v.is_active !== false)
        .map((v) => ({
          value: v.id,
          label: `${v.plate} · ${v.vehicle_type_name}`,
          disabled: busyVehicleIds.has(v.id),
          hint: "on a trip",
        })),
    [vehicles, busyVehicleIds],
  );

  // Phone is in the label so the vendor can search a driver by name *or* number.
  const driverOptions = useMemo(
    () =>
      drivers
        .filter((d) => d.is_active !== false)
        .map((d) => {
          const offline = d.status === "OFFLINE";
          const busy = busyDriverIds.has(d.id);
          return {
            value: d.id,
            label: d.phone ? `${d.name} · ${d.phone}` : d.name,
            disabled: busy || offline,
            hint: busy ? "on a trip" : offline ? "offline" : undefined,
          };
        }),
    [drivers, busyDriverIds],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 mt-0.5">
            Trips offered to you. Accept before the timer runs out by assigning a vehicle and driver —
            otherwise the offer expires and returns to the agency.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {offers.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offers — reference, car type, passenger, pickup or drop…"
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-slate-500">Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className="py-12 text-center text-slate-500 border border-dashed border-slate-300 rounded-lg">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No active offers right now.</p>
        </div>
      ) : visibleOffers.length === 0 ? (
        <div className="py-10 text-center text-slate-500 border border-dashed border-slate-300 rounded-lg">
          <p>
            No offers match <span className="font-medium">“{search}”</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleOffers.map((offer) => {
            const expired = new Date(offer.expires_at).getTime() - now <= 0;
            return (
              <div
                key={offer.id}
                className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={offer.status} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-sm text-slate-800">{offer.reference}</p>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold"
                        title="Car type requested — assign a matching vehicle"
                      >
                        <Car className="w-3.5 h-3.5" />
                        {offer.vehicle_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {offer.pickup_at ? new Date(offer.pickup_at).toLocaleString() : "—"} · Round{" "}
                      {offer.round}
                    </p>

                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-start gap-1.5 text-sm text-slate-700">
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                        <span>
                          {offer.pickup ?? "—"}
                          <span className="mx-1.5 text-slate-400">→</span>
                          {offer.drop ?? "—"}
                        </span>
                      </div>
                      {offer.passenger_name && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>{offer.passenger_name}</span>
                          {offer.passenger_phone && (
                            <a
                              href={`tel:${offer.passenger_phone}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              {offer.passenger_phone}
                            </a>
                          )}
                          {offer.pax_count > 1 && (
                            <span className="text-slate-400">· {offer.pax_count} pax</span>
                          )}
                        </div>
                      )}
                      {offer.locked_price_minor != null && (
                        <p className="text-sm font-semibold text-slate-800">
                          {formatMoney(offer.locked_price_minor, offer.currency ?? "USD")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded ${
                      expired
                        ? "bg-red-100 text-red-700"
                        : offer.status === "ALERTED"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {expired ? "expired" : `expires in ${countdown(offer.expires_at, now)}`}
                  </span>
                  <button
                    onClick={() => openAccept(offer)}
                    disabled={expired}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!accepting} onClose={() => setAccepting(null)} title="Accept offer">
        {accepting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Assign a vehicle and driver to accept trip{" "}
              <span className="font-mono font-medium">{accepting.reference}</span>.
            </p>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100">
              <Car className="w-4 h-4 text-indigo-700 shrink-0" />
              <span className="text-sm text-indigo-900">
                Car type requested: <strong>{accepting.vehicle_type}</strong>
              </span>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Vehicle <span className="text-slate-400">({vehicleOptions.length})</span>
              </label>
              <SearchableSelect
                value={vehicleId}
                onChange={setVehicleId}
                options={vehicleOptions}
                placeholder="Search by plate or type…"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Driver <span className="text-slate-400">({driverOptions.length})</span>
              </label>
              <SearchableSelect
                value={driverId}
                onChange={setDriverId}
                options={driverOptions}
                placeholder="Search driver by name or phone…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void submitAccept()}
                disabled={submitting || !vehicleId || !driverId}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Accepting…" : "Confirm & Accept"}
              </button>
              <button
                onClick={() => setAccepting(null)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
