"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, isApiError, uuidv4 } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Pagination } from "@/components/ui/Pagination";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BellRing, Car, CheckCircle, Inbox, MapPin, RefreshCw, Search, Send, User, Pencil } from "lucide-react";
import type { TripStatus } from "@/lib/types";

// The RITMO endpoints are not in the committed OpenAPI schema, so we type them locally and
// drive them with csrfFetch (raw) instead of the typed apiClient.
interface ActiveOffer {
  id: string;
  vendor_id: string;
  vendor_name: string | null;
  status: "OFFERED" | "ALERTED";
  round: number;
  offered_at: string;
  expires_alert_at: string;
  expires_at: string;
}

interface RitmoVehicle {
  id: string;
  vehicle_type_name: string;
  status: string;
  vendor_id: string | null;
  vendor_name: string | null;
  pax_count: number;
  pax: { name: string; phone: string }[];
  allottable: boolean;
  // Why a PENDING slot is not yet auto-allotted: "no_city_vendor" | "car_type_unavailable" | "".
  alloc_reason: string;
  active_offer: ActiveOffer | null;
}

interface RitmoTrip {
  id: string;
  reference: string;
  ritmo_ref: string;
  airport_code: string | null;
  contact_number: string | null;
  staff_number: string | null;
  remarks: string | null;
  luggage_count: number;
  status: string;
  pickup_at: string | null;
  created_at: string;
  // Set once the trip has been edited after booking (partner/RITMO modify). Drives the tag.
  modified_at: string | null;
  customer_name: string | null;
  stops: { kind: string; address: string }[];
  vehicles: RitmoVehicle[];
}

interface Vendor {
  id: string;
  name: string;
}

/**
 * Vehicle states that mean a vendor has taken the job — they accepted the offer by assigning a
 * vehicle and driver, and everything after that is the trip actually running. Anything earlier
 * (PENDING, VENDOR_OFFERED) is still ops' problem and must stay visually live.
 */
const ACCEPTED_VEHICLE_STATUSES = new Set([
  "ASSIGNED",
  "DRIVER_ACCEPTED",
  "EN_ROUTE_PICKUP",
  "AT_PICKUP",
  "PAX_PICKED",
  "IN_TRANSIT",
  "AT_DROP",
  "PAX_DROPPED",
  "COMPLETED",
]);

/**
 * True once every vehicle slot on the request has been accepted by a vendor.
 *
 * Deliberately `every`, not `some`: a two-vehicle request with one slot still unallotted is
 * only half done and has to keep drawing the eye. A request with no vehicle rows at all is not
 * "settled" either — that would grey out a request nobody can act on yet.
 */
function isFullyAccepted(trip: RitmoTrip): boolean {
  return (
    trip.vehicles.length > 0 &&
    trip.vehicles.every((v) => ACCEPTED_VEHICLE_STATUSES.has(v.status))
  );
}

function countdown(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RitmoPage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<Record<string, string>>({});
  const [allotting, setAllotting] = useState<string | null>(null);
  const [alerting, setAlerting] = useState<string | null>(null);
  const [alertingAll, setAlertingAll] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [search, setSearch] = useState("");
  // A 1s ticker so the offer countdowns tick down live between refetches.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cursor pagination: the endpoint returns 25 per page, so without this only the first 25
  // RITMO requests are ever shown. `cursor` is the value the hook hands us for each page.
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["ritmo", "requests", cursor ?? "first"],
    queryFn: async (): Promise<{ results: RitmoTrip[]; next: string | null }> => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const resp = await csrfFetch(`/api/v1/ritmo/requests/${qs}`, { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load RITMO requests (${resp.status})`);
      const body = (await resp.json()) as { results?: RitmoTrip[]; next?: string | null };
      return { results: body.results ?? [], next: body.next ?? null };
    },
    refetchInterval: 20_000,
  });
  const trips = useMemo(() => data?.results ?? [], [data]);
  const page = useCursorPagination(data?.next);
  useEffect(() => setCursor(page.cursor), [page.cursor]);

  const { data: vendors = [] } = useQuery({
    queryKey: ["fleet", "vendors", "all"],
    queryFn: async (): Promise<Vendor[]> => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vendors", {});
      if (err) throw err;
      return ((res as unknown as { results?: Vendor[] })?.results ?? []) as Vendor[];
    },
    staleTime: 60_000,
  });

  // Car types for the "car type not available" fallback picker.
  const { data: vehicleTypes = [] } = useQuery({
    queryKey: ["config", "vehicle-types", "all"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vehicle-types", {});
      if (err) throw err;
      return ((res as unknown as { results?: { id: string; name: string }[] })?.results ?? []);
    },
    staleTime: 60_000,
  });
  const vehicleTypeOptions = useMemo(
    () => vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name })),
    [vehicleTypes],
  );

  // Offers still awaiting a vendor response — exactly what "Alert vendors" will nudge.
  const pendingAlertCount = useMemo(
    () =>
      trips.reduce(
        (n, trip) =>
          n + trip.vehicles.filter((v) => v.active_offer?.status === "OFFERED").length,
        0,
      ),
    [trips],
  );

  const vendorOptions = useMemo(
    () => vendors.map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );

  // Vendors are airport-scoped (Vendor.airport_code): a RITMO request carries its operating airport,
  // and a slot may only be allotted to vendors at that airport. `airport_code` is not in the Vendor
  // type yet, so read it defensively. A request with no airport falls back to every vendor.
  const vendorOptionsForCity = useCallback(
    (city: string | null | undefined) => {
      const c = (city ?? "").trim().toLowerCase();
      if (!c) return vendorOptions;
      return vendors
        .filter((v) => ((v as { airport_code?: string }).airport_code ?? "").trim().toLowerCase() === c)
        .map((v) => ({ value: v.id, label: v.name }));
    },
    [vendors, vendorOptions],
  );

  const visibleTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((t) =>
      [
        t.reference,
        t.ritmo_ref,
        t.airport_code,
        t.contact_number,
        t.staff_number,
        t.remarks,
        t.customer_name,
        t.status,
        ...t.stops.map((s) => s.address),
        ...t.vehicles.map((v) => v.vehicle_type_name),
        ...t.vehicles.flatMap((v) => v.pax.map((p) => `${p.name} ${p.phone}`)),
        ...t.vehicles.map((v) => v.active_offer?.vendor_name ?? ""),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q)),
    );
  }, [trips, search]);

  const allot = async (vehicleId: string) => {
    const vendorId = selectedVendor[vehicleId];
    if (!vendorId) {
      addToast("Pick a vendor first.", "error");
      return;
    }
    setAllotting(vehicleId);
    try {
      const resp = await csrfFetch(`/api/v1/trips/vehicles/${vehicleId}/offer/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
        body: JSON.stringify({ vendor_id: vendorId }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Allot failed (${resp.status})`);
      }
      addToast("Offer sent to vendor — awaiting acceptance.", "success");
      setSelectedVendor((prev) => ({ ...prev, [vehicleId]: "" }));
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to allot",
        "error",
      );
    } finally {
      setAllotting(null);
    }
  };

  // Car-type fallback: when no city vendor has the requested type, ops picks another type and the
  // backend re-runs the city auto-dispatch (auto-allot + auto-accept) for that type.
  const reallocateWithType = async (vehicleId: string, vehicleTypeId: string) => {
    if (!vehicleTypeId) return;
    setAllotting(vehicleId);
    try {
      const resp = await csrfFetch(`/api/v1/trips/vehicles/${vehicleId}/reallocate/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
        body: JSON.stringify({ vehicle_type_id: vehicleTypeId }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: { status?: string; vendor_name?: string };
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Reallocate failed (${resp.status})`);
      const status = body.result?.status;
      if (status === "assigned") {
        addToast(`Auto-allotted to ${body.result?.vendor_name ?? "a vendor"} and accepted.`, "success");
      } else if (status === "car_type_unavailable") {
        addToast("That car type isn't available at this airport either — try another.", "error");
      } else if (status === "no_city_vendor") {
        addToast("No vendors operate at this airport.", "error");
      }
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to reallocate",
        "error",
      );
    } finally {
      setAllotting(null);
    }
  };

  const alertVendor = async (offerId: string, vendorName: string | null) => {
    setAlerting(offerId);
    try {
      const resp = await csrfFetch(`/api/v1/offers/${offerId}/alert/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Alert failed (${resp.status})`);
      }
      const body = (await resp.json().catch(() => ({}))) as { result?: { outcome?: string } };
      if (body.result?.outcome === "noop") {
        addToast("This offer was already alerted or is no longer active.", "info");
      } else {
        addToast(`Alert sent to ${vendorName ?? "the vendor"}.`, "success");
      }
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to alert",
        "error",
      );
    } finally {
      setAlerting(null);
    }
  };

  const alertAllVendors = async () => {
    setAlertingAll(true);
    try {
      const resp = await csrfFetch("/api/v1/ritmo/alert-all/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Alert failed (${resp.status})`);
      }
      const body = (await resp.json().catch(() => ({}))) as { result?: { alerted?: number } };
      const n = body.result?.alerted ?? 0;
      addToast(
        n === 0
          ? "No vendors to alert — every offer is already alerted or answered."
          : `Alert sent to ${n} vendor(s).`,
        n === 0 ? "info" : "success",
      );
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to alert",
        "error",
      );
    } finally {
      setAlertingAll(false);
    }
  };

  const sendAllToRitmo = async () => {
    setSendingAll(true);
    try {
      const resp = await csrfFetch("/api/v1/ritmo/push-all/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Send to RITMO failed (${resp.status})`);
      }
      const body = (await resp.json().catch(() => ({}))) as { result?: { pushed?: number } };
      const n = body.result?.pushed ?? 0;
      addToast(`Current status of ${n} RITMO request(s) sent back to RITMO.`, "success");
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to send to RITMO",
        "error",
      );
    } finally {
      setSendingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Inbox className="w-6 h-6" /> RITMO Requests
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Bookings received from RITMO. Allot each vehicle to a vendor — the vendor has ~5 minutes
            to accept in their portal, else the offer expires and you can re-allot.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void alertAllVendors()}
            disabled={alertingAll || pendingAlertCount === 0}
            title={
              pendingAlertCount === 0
                ? "No un-answered offers to alert"
                : `Nudge all ${pendingAlertCount} vendor(s) sitting on an un-answered offer`
            }
          >
            <BellRing className="w-4 h-4 mr-1" />
            {alertingAll
              ? "Alerting…"
              : `Alert vendors${pendingAlertCount ? ` (${pendingAlertCount})` : ""}`}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void sendAllToRitmo()}
            disabled={sendingAll || trips.length === 0}
            title="Push the current status of every RITMO request back to RITMO"
          >
            <Send className="w-4 h-4 mr-1" />
            {sendingAll ? "Sending…" : "Send to RITMO"}
          </Button>
        </div>
      </div>

      {trips.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests — reference, RITMO ref, passenger, car type, vendor, pickup or drop…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-10 text-center text-sm text-text-secondary">Loading RITMO requests…</div>
      ) : trips.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-10">
          <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No RITMO requests yet. Bookings pushed from RITMO will appear here.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleTrips.length === 0 ? (
            <Card padding="lg" className="text-center text-text-secondary py-8">
              <p>No requests match “{search}”.</p>
            </Card>
          ) : null}
          {visibleTrips.map((trip) => {
            const accepted = isFullyAccepted(trip);
            return (
            <Card
              key={trip.id}
              padding="md"
              // Greyed out once a vendor has taken every slot: the request needs nothing more
              // from ops, so it recedes and only the ones still awaiting action read as live.
              // No hover restore — bringing it back to full colour on mouseover made a settled
              // request look active again, which defeats the point of muting it.
              className={accepted ? "opacity-50 grayscale" : ""}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={trip.status as TripStatus} />
                    {accepted && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Vendor accepted
                      </span>
                    )}
                    <span className="font-mono text-sm text-text-primary">{trip.reference}</span>
                    {trip.modified_at && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium"
                        title={`Details edited after booking on ${new Date(trip.modified_at).toLocaleString()}`}
                      >
                        <Pencil className="w-3 h-3" />
                        Modified
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-medium">
                      RITMO: {trip.ritmo_ref}
                    </span>
                    {trip.airport_code && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-accent-gold/15 text-text-primary font-medium">
                        <MapPin className="w-3 h-3 text-accent-gold" />
                        {trip.airport_code}
                      </span>
                    )}
                    {trip.customer_name && (
                      <span className="text-sm text-text-secondary">{trip.customer_name}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {trip.pickup_at ? new Date(trip.pickup_at).toLocaleString() : "—"}
                  </p>
                  {trip.stops.length > 0 && (
                    <div className="mt-1.5 flex items-start gap-1 text-xs text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{trip.stops.map((s) => s.address).join("  →  ")}</span>
                    </div>
                  )}
                  {(trip.contact_number || trip.staff_number || trip.luggage_count > 0) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      {trip.contact_number && (
                        <span>Contact: <span className="text-text-primary">{trip.contact_number}</span></span>
                      )}
                      {trip.staff_number && (
                        <span>Staff #: <span className="text-text-primary">{trip.staff_number}</span></span>
                      )}
                      {trip.luggage_count > 0 && (
                        <span>Bags: <span className="text-text-primary">{trip.luggage_count}</span></span>
                      )}
                    </div>
                  )}
                  {trip.remarks && (
                    <div className="mt-1.5 text-xs text-text-secondary italic">
                      “{trip.remarks}”
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {trip.vehicles.map((v) => (
                  <div key={v.id} className="p-2.5 rounded border border-border bg-white">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm">
                        <StatusBadge status={v.status as TripStatus} />
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-semibold"
                          title="Car type requested by RITMO"
                        >
                          <Car className="w-3.5 h-3.5" />
                          {v.vehicle_type_name}
                        </span>
                        {v.pax.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <User className="w-3.5 h-3.5 text-text-tertiary" />
                            {v.pax[0]!.name}
                            {v.pax[0]!.phone && (
                              <span className="text-text-tertiary">· {v.pax[0]!.phone}</span>
                            )}
                          </span>
                        )}
                        {v.pax_count > 1 && (
                          <span className="text-xs text-text-tertiary">{v.pax_count} pax</span>
                        )}
                      </div>

                      {v.active_offer ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Send className="w-3.5 h-3.5 text-brand-blue" />
                          <span className="text-text-primary">
                            Offered to <strong>{v.active_offer.vendor_name}</strong>
                          </span>
                          <span
                            className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                              v.active_offer.status === "ALERTED"
                                ? "bg-warning/15 text-warning"
                                : "bg-brand-blue/10 text-brand-blue"
                            }`}
                          >
                            {v.active_offer.status} · {countdown(v.active_offer.expires_at, now)}
                          </span>
                          {v.active_offer.status === "OFFERED" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={alerting === v.active_offer.id}
                              onClick={() =>
                                void alertVendor(
                                  v.active_offer!.id,
                                  v.active_offer!.vendor_name,
                                )
                              }
                              title="Nudge the vendor now instead of waiting for the timer"
                            >
                              <BellRing className="w-3.5 h-3.5 mr-1" />
                              {alerting === v.active_offer.id ? "Alerting…" : "Alert"}
                            </Button>
                          )}
                        </div>
                      ) : v.allottable ? (
                        (() => {
                          // No vendor operates in the request's city at all.
                          if (v.alloc_reason === "no_city_vendor") {
                            return (
                              <span className="text-xs text-danger">
                                No vendors operating in {trip.airport_code || "this airport"} — add one in Configuration.
                              </span>
                            );
                          }
                          // Vendors exist in the city, but none has the requested car type free.
                          // Offer an alternate car type; picking one re-runs auto-allot + auto-accept.
                          if (v.alloc_reason === "car_type_unavailable") {
                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-danger whitespace-nowrap">
                                  {v.vehicle_type_name} not available in {trip.airport_code} —
                                </span>
                                <div className="w-48">
                                  <SearchableSelect
                                    options={vehicleTypeOptions.filter((o) => o.label !== v.vehicle_type_name)}
                                    value=""
                                    placeholder={allotting === v.id ? "Allotting…" : "Select other car type…"}
                                    onChange={(val) => void reallocateWithType(v.id, val)}
                                  />
                                </div>
                              </div>
                            );
                          }
                          // Genuinely allottable (a city vendor is free) — manual city-scoped picker.
                          const cityOptions = vendorOptionsForCity(trip.airport_code);
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-56">
                                <SearchableSelect
                                  options={cityOptions}
                                  value={selectedVendor[v.id] ?? ""}
                                  placeholder={trip.airport_code ? `Vendors in ${trip.airport_code}…` : "Search vendor…"}
                                  onChange={(val) =>
                                    setSelectedVendor((prev) => ({ ...prev, [v.id]: val }))
                                  }
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={allotting === v.id || !selectedVendor[v.id]}
                                onClick={() => void allot(v.id)}
                              >
                                {allotting === v.id ? "Allotting…" : "Allot"}
                              </Button>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-sm text-text-secondary">
                          {v.vendor_name ? `Assigned · ${v.vendor_name}` : v.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            );
          })}
          <Pagination page={page} count={trips.length} itemLabel="request" />
        </div>
      )}
    </div>
  );
}
