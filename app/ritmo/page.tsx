"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, isApiError, uuidv4 } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Pagination } from "@/components/ui/Pagination";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { VehicleAssignmentModal } from "@/components/trips/VehicleAssignmentModal";
import { RitmoManualAllotModal } from "@/components/trips/RitmoManualAllotModal";
import { RitmoManualSplitModal } from "@/components/trips/RitmoManualSplitModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRideEvents } from "@/lib/shared/realtime/ws";
import { AlertTriangle, BellRing, Building2, Car, CheckCircle, Clock, Inbox, MapPin, RefreshCw, Search, Send, User, Pencil, X } from "lucide-react";
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
  // Both null when the booked type name matched nothing in this tenant's fleet — see
  // requested_vehicle_type_name below for what was actually asked for in that case.
  vehicle_type_name: string | null;
  // The REQUESTED type's own seat count — gates whether "Split across vehicles" is even offered
  // (backend only allows splitting types with 5+ seats; see manual_split_allocate_ritmo_vehicle).
  vehicle_type_capacity: number | null;
  // What RITMO actually asked for when vehicle_type_name is null — e.g. "Sedan-XL" for a type
  // this tenant's fleet has no VehicleType named. Null once a real match exists.
  requested_vehicle_type_name: string | null;
  status: string;
  vendor_id: string | null;
  vendor_name: string | null;
  // Populated once a vehicle+driver is actually allotted (Accept / Manually allot); null while
  // still PENDING/VENDOR_OFFERED. Unmasked — this is the ops UI, not the partner-facing API.
  vehicle_number: string | null;
  vehicle_name: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  pax_count: number;
  pax: { name: string; phone: string }[];
  allottable: boolean;
  // Why a PENDING slot is not yet auto-allotted:
  // "type_not_in_fleet" | "no_city_vendor" | "car_type_unavailable" | "".
  alloc_reason: string;
  active_offer: ActiveOffer | null;
  // Set only on a row born from splitting an unfulfillable single-vehicle request across
  // multiple smaller vehicles (trips.services.split_allocate_ritmo_vehicle) — points at the
  // original (now cancelled) slot it was split off of.
  split_from_trip_vehicle_id: string | null;
  // "T-236-A" / "T-236-B" style label for a split child, computed server-side; null on a
  // non-split row.
  split_reference: string | null;
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
  // Outcome of the last RIDE -> RITMO status push (Accept/Cancel/"Send to RITMO"). null = never
  // attempted. Push failures never block Accept/Cancel itself (best-effort by design), so this
  // is the only place ops sees a delivery failure without reading worker logs.
  ritmo_last_push_ok: boolean | null;
  ritmo_last_push_error: string | null;
  ritmo_last_pushed_at: string | null;
  customer_name: string | null;
  stops: { kind: string; address: string }[];
  vehicles: RitmoVehicle[];
  // Set when RITMO has submitted a pickup-time change that's waiting on ops to approve/reject
  // (apps.trips.models.TripModificationRequest) — null once resolved one way or another, or if
  // RITMO withdrew it first via its own cancel endpoint. At most one at a time per trip.
  // A passenger-count change never appears here (2026-09-24): it auto-applies immediately with
  // no ops review — see each vehicle's own live pax_count below instead.
  pending_modification: {
    modification_request_id: string;
    requested_pickup_at: string | null;
    previous_pickup_at: string | null;
    requested_at: string;
  } | null;
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

// Mirrors apps.trips.lifecycle.ALLOWED_TRANSITIONS: CANCELLED is unreachable from any of
// these — the passenger's already been picked up (PAX_PICKED onward) or the slot already
// ended one way or another. Every other status, including ASSIGNED/DRIVER_ACCEPTED, can still
// cancel server-side, so Cancel stays offered through accept/reassign/split, not just PENDING.
const NOT_CANCELLABLE_VEHICLE_STATUSES = new Set([
  "PAX_PICKED",
  "IN_TRANSIT",
  "AT_DROP",
  "PAX_DROPPED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

// The backend's own apps.trips.services.reassign_vehicle allowed_for_reassign set — a vehicle
// already accepted by a vendor can still be swapped for a different one (any vendor's fleet)
// while it's in one of these, same option TripDetailView offers on the general Trips list.
const REASSIGNABLE_VEHICLE_STATUSES = new Set(["ASSIGNED", "DRIVER_ACCEPTED", "BREAKDOWN"]);

// Mirrors apps.trips.services._MIN_SPLITTABLE_CAPACITY — splitting a small requested type (a
// 4-seat Sedan, say) into several smaller vehicles isn't worth it; ops should pick a different
// single vehicle instead. The backend enforces this too (list_split_candidates /
// manual_split_allocate_ritmo_vehicle both 409 below this), this only hides the button early.
const MIN_SPLITTABLE_CAPACITY = 5;

// Mirrors apps.trips.models.TripRequest.Status — DRAFT/BILLED rarely show up on a RITMO trip in
// practice (booking lands straight on CONFIRMED-tier; billing is a later, separate step) but are
// included for completeness rather than silently hiding a request that happens to be in one.
const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "BILLED", label: "Billed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "DRAFT", label: "Draft" },
];

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

// dd/mm/yyyy, HH:mm — explicit "en-GB" rather than the browser's own locale (which reads
// mm/dd/yyyy for a US-locale browser regardless of where the viewer actually is), so every
// timestamp on this page reads the same way for every ops viewer.
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RitmoPage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  const [allotting, setAllotting] = useState<string | null>(null);
  const [alerting, setAlerting] = useState<string | null>(null);
  const [alertingAll, setAlertingAll] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
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

  // Live updates: a new RITMO booking or a pickup-time modification shouldn't wait on the 20s
  // poll. The modification events are RITMO-only by construction (apps.partner_api's own RITMO
  // surface is the only caller), so those toast directly off the WS payload below. trip.created
  // fires for every trip in the tenant, not just RITMO ones, so it can't be trusted the same
  // way — it only drives a refetch here; the effect below toasts once that refetch actually
  // surfaces a new row in this already RITMO-filtered list (apps.trips.selectors.
  // ritmo_trips_for_actor), which can never misattribute a manual, non-RITMO booking.
  useRideEvents({
    invalidationMap: {
      "trip.created": ["ritmo", "requests"],
      "trip.modification_requested": ["ritmo", "requests"],
      "trip.modification_applied": ["ritmo", "requests"],
      "trip.modification_rejected": ["ritmo", "requests"],
      "trip.modification_cancelled": ["ritmo", "requests"],
    },
    handler: (event) => {
      const payload = event.payload as { reference?: string };
      if (event.type === "trip.modification_requested") {
        addToast(
          `${payload.reference ?? "A trip"} — RITMO requested a pickup-time change.`,
          "info",
        );
      } else if (event.type === "trip.modification_cancelled") {
        addToast(
          `${payload.reference ?? "A trip"} — RITMO withdrew its pickup-time change request.`,
          "info",
        );
      }
    },
  });

  // Newest-first, page 1 only: the ref remembers which trip ids were on the first page after
  // the last render, seeded silently on first load (so the whole first page doesn't toast).
  // Any id present now that wasn't in the ref is a request that just landed — whether the list
  // changed via the WS-triggered refetch above or the ordinary 20s poll. Skipped while browsing
  // page 2+ (cursor set) so paging never gets misread as a wave of "new" arrivals.
  const seenTripIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (cursor !== undefined) return;
    // Wait for the real first page: `trips` is already `[]` before the query resolves, and
    // seeding off that empty array here would make every id in the actual first response look
    // "new" the moment it lands — toasting once per row instead of staying silent on load.
    if (data === undefined) return;
    const currentIds = new Set(trips.map((t) => t.id));
    const seen = seenTripIdsRef.current;
    if (seen === null) {
      seenTripIdsRef.current = currentIds;
      return;
    }
    for (const trip of trips) {
      if (!seen.has(trip.id)) {
        addToast(`New RITMO request received — ${trip.reference}.`, "info");
      }
    }
    seenTripIdsRef.current = currentIds;
  }, [trips, cursor, data, addToast]);

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

  const visibleTrips = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trips
      .filter((t) => statusFilter === "ALL" || t.status === statusFilter)
      .filter((t) => {
        if (!q) return true;
        return [
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
          ...t.vehicles.map((v) => v.requested_vehicle_type_name),
          ...t.vehicles.flatMap((v) => v.pax.map((p) => `${p.name} ${p.phone}`)),
          ...t.vehicles.map((v) => v.active_offer?.vendor_name ?? ""),
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q));
      });
  }, [trips, search, statusFilter]);

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

  const [deciding, setDeciding] = useState<string | null>(null);
  const [decidingModification, setDecidingModification] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<
    | { kind: "accept"; vehicleId: string }
    | { kind: "cancel"; vehicleId: string }
    | { kind: "approveModification"; modificationId: string }
    | { kind: "rejectModification"; modificationId: string }
    | null
  >(null);
  const [reassignModal, setReassignModal] = useState<{
    tripId: string;
    tripVehicleId: string;
    paxCount: number;
    airportCode: string | null;
  } | null>(null);
  const [manualAllotModal, setManualAllotModal] = useState<{
    tripVehicleId: string;
    vehicleTypeName: string;
    airportCode: string | null;
    paxCount: number;
  } | null>(null);
  const [splitModal, setSplitModal] = useState<{
    tripVehicleId: string;
    vehicleTypeName: string;
    paxCount: number;
  } | null>(null);

  // Dedicated RITMO-module endpoints (not the generic reallocate/transitions actions) — each
  // one auto-allots-and-accepts (or cancels) AND best-effort pushes the new status to RITMO
  // server-side, so there's no second network round-trip to remember here.
  const accept = async (vehicleId: string) => {
    setDeciding(vehicleId);
    try {
      const resp = await csrfFetch(`/api/v1/ritmo/accept/${vehicleId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: {
          status?: string;
          vendor_name?: string;
          split_into?: { vendor_name: string; vehicle_type: string; pax_count: number }[];
        };
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Accept failed (${resp.status})`);
      const outcome = body.result?.status;
      if (outcome === "assigned") {
        addToast(`Accepted — allotted to ${body.result?.vendor_name ?? "a vendor"}.`, "success");
      } else if (outcome === "split_assigned") {
        const into = body.result?.split_into ?? [];
        const summary = into.map((v) => `${v.vendor_name} (${v.vehicle_type} · ${v.pax_count}p)`).join(", ");
        addToast(
          `No single vehicle was free — split across ${into.length} vehicles instead: ${summary}.`,
          "success",
        );
      } else if (outcome === "car_type_unavailable") {
        addToast("No vendor has this car type free right now — try another type below.", "error");
      } else if (outcome === "no_city_vendor") {
        addToast("No vendors operate at this airport.", "error");
      }
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to accept",
        "error",
      );
    } finally {
      setDeciding(null);
    }
  };

  const cancel = async (vehicleId: string) => {
    setDeciding(vehicleId);
    try {
      const resp = await csrfFetch(`/api/v1/ritmo/cancel/${vehicleId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ops_declined" }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Cancel failed (${resp.status})`);
      }
      addToast("Request cancelled.", "success");
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to cancel",
        "error",
      );
    } finally {
      setDeciding(null);
    }
  };

  // Ok/Cancel on a RITMO-submitted pickup-time change (apps.trips.services.
  // approve_pickup_time_modification / reject_pickup_time_modification). Pushing the outcome
  // back to RITMO is a separate, not-yet-specified piece — these two only decide it on RIDE's
  // side for now.
  const approveModification = async (modificationId: string) => {
    setDecidingModification(modificationId);
    try {
      const resp = await csrfFetch(`/api/v1/ritmo/modifications/${modificationId}/approve/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Approve failed (${resp.status})`);
      }
      addToast("Pickup time updated.", "success");
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to approve",
        "error",
      );
    } finally {
      setDecidingModification(null);
    }
  };

  const rejectModification = async (modificationId: string) => {
    setDecidingModification(modificationId);
    try {
      const resp = await csrfFetch(`/api/v1/ritmo/modifications/reject/${modificationId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ops_declined" }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(body?.error?.message ?? `Reject failed (${resp.status})`);
      }
      addToast("Pickup time change rejected.", "success");
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to reject",
        "error",
      );
    } finally {
      setDecidingModification(null);
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

  const pendingCount = trips.filter((t) => !isFullyAccepted(t)).length;

  return (
    <div className="pt-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Automated Trips</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Bookings pushed in from RITMO — accept, allot, or cancel them here.
            {!isLoading && trips.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-ops-card2 tabular-nums">
                {trips.length} total · {pendingCount} need action
              </span>
            )}
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
        </div>
      </div>

      {trips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map((opt) => {
            const count =
              opt.value === "ALL"
                ? trips.length
                : trips.filter((t) => t.status === opt.value).length;
            if (opt.value !== "ALL" && count === 0) return null;
            const active = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-brand-blue text-white"
                    : "bg-ops-card2 text-text-secondary hover:text-text-primary hover:bg-ops-card2/70"
                }`}
              >
                {opt.label} <span className={active ? "text-white/80" : "text-text-tertiary"}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {trips.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests — reference, RITMO ref, passenger, car type, vendor, pickup or drop…"
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
              <p>
                {search
                  ? `No requests match “${search}”.`
                  : "No requests match this filter."}
              </p>
            </Card>
          ) : null}
          {visibleTrips.map((trip) => {
            const accepted = isFullyAccepted(trip);
            return (
            <Card key={trip.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                {/* Per explicit instruction, no longer greyed out once a vendor has taken every
                    slot — the "Vendor accepted" badge below is still shown as the signal, just
                    without dimming the rest of the request's details. */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={trip.status as TripStatus} />
                    {accepted && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Vendor accepted
                      </span>
                    )}
                    <span className="font-mono text-sm font-semibold text-text-primary">{trip.reference}</span>
                    {trip.modified_at && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-success/10 text-success font-medium"
                        title={`Details edited after booking on ${formatDateTime(trip.modified_at)}`}
                      >
                        <Pencil className="w-3 h-3" />
                        Modified
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-medium">
                      RITMO: {trip.ritmo_ref}
                    </span>
                    {trip.ritmo_last_push_ok === false && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-danger/10 text-danger font-medium"
                        title={
                          (trip.ritmo_last_push_error ? `${trip.ritmo_last_push_error} — ` : "") +
                          (trip.ritmo_last_pushed_at
                            ? `last attempted ${formatDateTime(trip.ritmo_last_pushed_at)}`
                            : "")
                        }
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Not yet confirmed by RITMO
                      </span>
                    )}
                    {trip.airport_code && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-accent-gold/15 text-text-primary font-medium">
                        <MapPin className="w-3 h-3 text-accent-gold" />
                        {trip.airport_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    {trip.pickup_at ? formatDateTime(trip.pickup_at) : "—"}
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

              {trip.pending_modification && (
                <div className="mt-3 p-2.5 rounded border border-accent-gold/40 bg-accent-gold/10 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex flex-col gap-1 text-sm">
                    {trip.pending_modification.requested_pickup_at && (
                      <span className="flex items-center gap-2 text-text-primary">
                        <Clock className="w-4 h-4 text-accent-gold shrink-0" />
                        RITMO wants to move pickup from time{" "}
                        <span className="line-through text-text-tertiary">
                          {formatDateTime(trip.pending_modification.previous_pickup_at!)}
                        </span>{" "}
                        to{" "}
                        <strong>
                          {formatDateTime(trip.pending_modification.requested_pickup_at)}
                        </strong>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      className="bg-success! hover:bg-success/90! shadow-none!"
                      disabled={decidingModification === trip.pending_modification.modification_request_id}
                      onClick={() =>
                        setPendingConfirm({
                          kind: "approveModification",
                          modificationId: trip.pending_modification!.modification_request_id,
                        })
                      }
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {decidingModification === trip.pending_modification.modification_request_id
                        ? "Working…"
                        : "Accept"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={decidingModification === trip.pending_modification.modification_request_id}
                      onClick={() =>
                        setPendingConfirm({
                          kind: "rejectModification",
                          modificationId: trip.pending_modification!.modification_request_id,
                        })
                      }
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {trip.vehicles.map((v) => {
                  // Mirrors apps.trips.lifecycle.ALLOWED_TRANSITIONS: every pre-pickup status
                  // (including ASSIGNED/DRIVER_ACCEPTED — accepted, reassigned, or a split
                  // child) can still transition to CANCELLED server-side. Only once the
                  // passenger has actually been picked up, or the slot already ended one way
                  // or another, is there nothing left to cancel.
                  const canCancel = !NOT_CANCELLABLE_VEHICLE_STATUSES.has(v.status);
                  return (
                  <div key={v.id} className="p-2.5 rounded border border-border bg-white">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm">
                        <StatusBadge status={v.status as TripStatus} />
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            v.vehicle_type_name
                              ? "bg-brand-blue/10 text-brand-blue"
                              : "bg-danger/10 text-danger"
                          }`}
                          title={
                            v.vehicle_type_name
                              ? "Car type requested by RITMO"
                              : "This car type isn't in the fleet — pick a vehicle to allot"
                          }
                        >
                          <Car className="w-3.5 h-3.5" />
                          {v.vehicle_type_name ?? v.requested_vehicle_type_name ?? "Unknown type"}
                        </span>
                        {v.split_from_trip_vehicle_id && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-semibold font-mono"
                            title="No single vehicle was free for the original request — this seat group was split off onto its own vehicle"
                          >
                            {v.split_reference ?? "Split"}
                          </span>
                        )}
                        {v.pax_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-text-secondary">
                            <User className="w-3.5 h-3.5 text-text-tertiary" />
                            {v.pax_count} pax
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
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
                          // Booked against a type name that matched nothing in this tenant's
                          // fleet at all (apps.trips.services.book_trip_unmatched_type) —
                          // checked first server-side, before any city/availability logic runs.
                          // The only path forward is picking a real vehicle by hand; there is
                          // no "other type" to fall back to since none was ever resolved.
                          if (v.alloc_reason === "type_not_in_fleet") {
                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-danger whitespace-nowrap">
                                  {v.requested_vehicle_type_name || "Requested type"} isn&apos;t in
                                  this tenant&apos;s fleet —
                                </span>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setManualAllotModal({
                                      tripVehicleId: v.id,
                                      vehicleTypeName:
                                        v.requested_vehicle_type_name || "any vehicle",
                                      airportCode: trip.airport_code,
                                      paxCount: v.pax_count,
                                    })
                                  }
                                  title="Pick a vehicle that seats everyone — any type"
                                >
                                  Manually allot
                                </Button>
                              </div>
                            );
                          }
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
                            // Only reachable with a real matched type (type_not_in_fleet is
                            // checked first, above) — vehicle_type_name is never null here.
                            const typeName = v.vehicle_type_name ?? "";
                            return (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-danger whitespace-nowrap">
                                  {typeName} not available in {trip.airport_code} —
                                </span>
                                <div className="w-48">
                                  <SearchableSelect
                                    options={vehicleTypeOptions.filter((o) => o.label !== typeName)}
                                    value=""
                                    placeholder={allotting === v.id ? "Allotting…" : "Select other car type…"}
                                    onChange={(val) => void reallocateWithType(v.id, val)}
                                  />
                                </div>
                                {v.vehicle_type_capacity !== null &&
                                  v.vehicle_type_capacity >= MIN_SPLITTABLE_CAPACITY && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                      setSplitModal({
                                        tripVehicleId: v.id,
                                        vehicleTypeName: typeName,
                                        paxCount: v.pax_count,
                                      })
                                    }
                                    title="Seat everyone across several smaller vehicles instead"
                                  >
                                    Split across vehicles
                                  </Button>
                                )}
                              </div>
                            );
                          }
                          // Genuinely allottable (a city vendor is free): Accept is the fast
                          // path — auto-allots the first free vendor and accepts in one step.
                          // "Manually allot" is the override — ops browses every vendor's
                          // vehicle at this airport directly and picks one; the driver is still
                          // auto-picked either way. Split is offered here too, not just on
                          // car_type_unavailable — per explicit instruction, any still-PENDING
                          // 5+ seat request can be split proactively even when a single vehicle
                          // of the requested type IS currently free. Cancel renders once, below,
                          // alongside every other case.
                          //
                          // alloc_reason is "" here — type_not_in_fleet/no_city_vendor/
                          // car_type_unavailable are all handled above — so a real matched
                          // type is guaranteed; vehicle_type_name is never null.
                          const typeName = v.vehicle_type_name ?? "";
                          return (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                className="bg-success! hover:bg-success/90! shadow-none!"
                                disabled={deciding === v.id}
                                onClick={() => setPendingConfirm({ kind: "accept", vehicleId: v.id })}
                                title="Auto-allot the first free vendor and accept"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                {deciding === v.id ? "Accepting…" : "Accept"}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  setManualAllotModal({
                                    tripVehicleId: v.id,
                                    vehicleTypeName: typeName,
                                    airportCode: trip.airport_code,
                                    paxCount: v.pax_count,
                                  })
                                }
                                title="Pick the vendor & vehicle by hand instead of auto-allotting"
                              >
                                Manually allot
                              </Button>
                              {v.vehicle_type_capacity !== null &&
                                v.vehicle_type_capacity >= MIN_SPLITTABLE_CAPACITY && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    setSplitModal({
                                      tripVehicleId: v.id,
                                      vehicleTypeName: typeName,
                                      paxCount: v.pax_count,
                                    })
                                  }
                                  title="Seat everyone across several smaller vehicles instead"
                                >
                                  Split across vehicles
                                </Button>
                              )}
                            </div>
                          );
                        })()
                      ) : ACCEPTED_VEHICLE_STATUSES.has(v.status) && v.vendor_name ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium">
                            <Building2 className="w-3 h-3" /> {v.vendor_name}
                          </span>
                          {(v.vehicle_number || v.vehicle_name) && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-primary text-xs font-medium"
                              title="Assigned vehicle"
                            >
                              <Car className="w-3 h-3 text-text-tertiary" />
                              {v.vehicle_name ? `${v.vehicle_name} — ${v.vehicle_number}` : v.vehicle_number}
                            </span>
                          )}
                          {v.driver_name && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-primary text-xs font-medium"
                              title="Assigned driver"
                            >
                              <User className="w-3 h-3 text-text-tertiary" />
                              {v.driver_name}
                              {v.driver_phone && (
                                <span className="text-text-tertiary">· {v.driver_phone}</span>
                              )}
                            </span>
                          )}
                          {REASSIGNABLE_VEHICLE_STATUSES.has(v.status) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              // Deliberately more than a plain secondary button: this is the one
                              // action that can still matter on an otherwise "done" request (see
                              // the card-level muting note above), so it needs its own colour to
                              // catch the eye rather than blend in as just another grey control.
                              className="border-brand-blue/40 text-brand-blue hover:bg-brand-blue/10"
                              onClick={() =>
                                setReassignModal({
                                  tripId: trip.id,
                                  tripVehicleId: v.id,
                                  paxCount: v.pax_count,
                                  airportCode: trip.airport_code,
                                })
                              }
                              title="Swap in a different vehicle, driver, or vendor"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reassign
                            </Button>
                          )}
                        </div>
                      ) : null}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deciding === v.id}
                          onClick={() => setPendingConfirm({ kind: "cancel", vehicleId: v.id })}
                          title="Cancel this request"
                        >
                          <X className="w-3.5 h-3.5" />
                          {deciding === v.id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </Card>
            );
          })}
          <Pagination page={page} count={trips.length} itemLabel="request" />
        </div>
      )}

      {reassignModal && (
        <VehicleAssignmentModal
          tripId={reassignModal.tripId}
          tripVehicleId={reassignModal.tripVehicleId}
          mode="reassign"
          paxCount={reassignModal.paxCount}
          airportCode={reassignModal.airportCode}
          onClose={() => {
            setReassignModal(null);
            void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
          }}
        />
      )}

      {manualAllotModal && (
        <RitmoManualAllotModal
          tripVehicleId={manualAllotModal.tripVehicleId}
          vehicleTypeName={manualAllotModal.vehicleTypeName}
          airportCode={manualAllotModal.airportCode}
          paxCount={manualAllotModal.paxCount}
          onClose={() => setManualAllotModal(null)}
        />
      )}

      {splitModal && (
        <RitmoManualSplitModal
          tripVehicleId={splitModal.tripVehicleId}
          vehicleTypeName={splitModal.vehicleTypeName}
          paxCount={splitModal.paxCount}
          onClose={() => setSplitModal(null)}
        />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          open
          title={
            pendingConfirm.kind === "accept"
              ? "Accept this request?"
              : pendingConfirm.kind === "cancel"
                ? "Cancel this request?"
                : pendingConfirm.kind === "approveModification"
                  ? "Accept the pickup-time change?"
                  : "Reject the pickup-time change?"
          }
          message={
            pendingConfirm.kind === "accept"
              ? "This auto-allots the first free vendor and confirms the trip with them."
              : pendingConfirm.kind === "cancel"
                ? "This cancels the request and best-effort notifies RITMO. This can't be undone."
                : pendingConfirm.kind === "approveModification"
                  ? "This updates the trip's pickup time to what RITMO requested."
                  : "RITMO's requested pickup time will be declined; the trip keeps its current pickup time."
          }
          confirmLabel={
            pendingConfirm.kind === "accept" || pendingConfirm.kind === "approveModification"
              ? "Accept"
              : pendingConfirm.kind === "cancel"
                ? "Cancel request"
                : "Reject"
          }
          cancelLabel="Back"
          destructive={pendingConfirm.kind === "cancel" || pendingConfirm.kind === "rejectModification"}
          onConfirm={() => {
            const p = pendingConfirm;
            setPendingConfirm(null);
            if (p.kind === "accept") void accept(p.vehicleId);
            else if (p.kind === "cancel") void cancel(p.vehicleId);
            else if (p.kind === "approveModification") void approveModification(p.modificationId);
            else void rejectModification(p.modificationId);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}
