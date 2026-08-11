"use client";

import React, { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, isApiError, useLanguageStore, t, formatMoney } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useVendorTrips, useVendorTripDetail } from "@/hooks/useVendorTrips";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Drawer } from "@/components/ui/Drawer";
import { TripMapViewWrapper } from "@/components/trips/TripMapViewWrapper";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, X, CheckCircle, RefreshCw, Key } from "lucide-react";

type Trip = components["schemas"]["TripRequest"];
type Stop = components["schemas"]["Stop"];
type TripVehicle = components["schemas"]["TripVehicle"];
type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

const ACTIVE_STATUSES = new Set([
  "ASSIGNED", "DRIVER_ACCEPTED", "EN_ROUTE_PICKUP", "AT_PICKUP",
  "PAX_PICKED", "IN_TRANSIT", "AT_DROP", "PAX_DROPPED",
]);

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

// The happy-path lifecycle in order. The vendor drives it with just two OTP actions
// (Passenger Pickup, Passenger Drop); the intermediate driver states are advanced
// automatically so a single click moves the whole journey forward.
const LIFECYCLE = [
  "ASSIGNED",
  "DRIVER_ACCEPTED",
  "EN_ROUTE_PICKUP",
  "AT_PICKUP",
  "PAX_PICKED",
  "IN_TRANSIT",
  "AT_DROP",
  "PAX_DROPPED",
  "COMPLETED",
];
const PRE_PICKUP = new Set(["ASSIGNED", "DRIVER_ACCEPTED", "EN_ROUTE_PICKUP", "AT_PICKUP"]);
const PRE_DROP = new Set(["PAX_PICKED", "IN_TRANSIT", "AT_DROP"]);

// Ordered list of statuses to transition THROUGH to get from `from` up to and including `to`.
function advancePath(from: string, to: string): string[] {
  const i = LIFECYCLE.indexOf(from);
  const j = LIFECYCLE.indexOf(to);
  return i >= 0 && j > i ? LIFECYCLE.slice(i + 1, j + 1) : [];
}

async function postTransition(tripId: string, vehicleId: string, status: string): Promise<void> {
  const { error } = await apiClient.POST("/v1/trips/{id}/vehicles/{vehicle_pk}/transitions", {
    params: { path: { id: tripId, vehicle_pk: vehicleId } },
    body: { status } as never,
  });
  if (error) throw error;
}

async function postVerifyOtp(
  tripId: string,
  vehicleId: string,
  phase: "pickup" | "drop",
  otp: string,
): Promise<void> {
  const { error } = await apiClient.POST("/v1/trips/{id}/vehicles/{vehicle_pk}/verify-otp", {
    params: { path: { id: tripId, vehicle_pk: vehicleId } },
    body: { phase, otp } as never,
  });
  if (error) throw error;
}

// Re-read the vehicle's live status so an orchestration is resilient to a partially-advanced
// state (e.g. a previous wrong-OTP attempt already moved it to AT_PICKUP).
async function fetchTvStatus(tripId: string, vehicleId: string, fallback: string): Promise<string> {
  const { data } = await apiClient.GET("/v1/trips/{id}", { params: { path: { id: tripId } } });
  const tv = (data as unknown as { vehicles?: { id: string; status: string }[] })?.vehicles?.find(
    (v) => v.id === vehicleId,
  );
  return tv?.status ?? fallback;
}

export default function TripsPage() {
  const language = useLanguageStore((s) => s.language);
  const { addToast } = useToast();
  const qc = useQueryClient();

  const { data: trips = [], isLoading } = useVendorTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState<{ tripId: string; vehicleId: string; mode: "allot" | "reassign" } | null>(null);
  const [otpModal, setOtpModal] = useState<{ tripId: string; vehicleId: string; phase: "pickup" | "drop"; currentStatus: string } | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [reassignVehicleId, setReassignVehicleId] = useState("");
  const [reassignDriverId, setReassignDriverId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { data: tripDetail } = useVendorTripDetail(selectedTripId);

  const { data: fleetVehicles = [] } = useQuery({
    queryKey: keys.fleet.vehicles.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {});
      if (err) throw err;
      return (res?.results ?? []) as Vehicle[];
    },
  });

  const { data: fleetDrivers = [] } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
  });

  // Assets already committed to a live trip are locked (also enforced server-side) and must
  // not be offered for another allocation. Derived from this vendor's active trips.
  const { onTripVehicleIds, onTripDriverIds } = useMemo(() => {
    const vIds = new Set<string>();
    const dIds = new Set<string>();
    const ACTIVE = new Set([
      "ASSIGNED", "DRIVER_ACCEPTED", "EN_ROUTE_PICKUP", "AT_PICKUP", "PAX_PICKED",
      "IN_TRANSIT", "AT_DROP", "PAX_DROPPED", "BREAKDOWN", "ACCIDENT", "VEHICLE_SWAP", "DELAYED", "SOS",
    ]);
    for (const trip of trips) {
      for (const tv of trip.vehicles ?? []) {
        if (ACTIVE.has(tv.status)) {
          if (tv.vehicle) vIds.add(tv.vehicle);
          if (tv.driver) dIds.add(tv.driver);
        }
      }
    }
    return { onTripVehicleIds: vIds, onTripDriverIds: dIds };
  }, [trips]);

  // Busy assets stay VISIBLE but greyed out, so the vendor can see the whole fleet and understand
  // why something can't be picked. They become selectable again the moment the trip releases them.
  const vehicleOptions = useMemo(
    () =>
      fleetVehicles
        .filter((v) => v.is_active !== false)
        .map((v) => ({
          value: v.id,
          label: `${v.plate} — ${v.vehicle_type_name}`,
          disabled: onTripVehicleIds.has(v.id),
          hint: "on a trip",
        })),
    [fleetVehicles, onTripVehicleIds],
  );

  const driverOptions = useMemo(
    () =>
      fleetDrivers
        .filter((d) => d.is_active !== false)
        .map((d) => {
          const offline = d.status === "OFFLINE";
          const busy = onTripDriverIds.has(d.id);
          return {
            value: d.id,
            label: `${d.name} — ${d.phone}`,
            disabled: busy || offline,
            hint: busy ? "on a trip" : offline ? "offline" : undefined,
          };
        }),
    [fleetDrivers, onTripDriverIds],
  );

  const statusOptions = useMemo(() => {
    const set = new Set(trips.map((t) => t.status));
    return ["All", ...Array.from(set)];
  }, [trips]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (statusFilter !== "All" && trip.status !== statusFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const matchId = trip.id.toLowerCase().includes(q);
        const matchRef = trip.reference?.toLowerCase().includes(q) ?? false;
        const matchAddr = trip.stops?.[0]?.address?.toLowerCase().includes(q) ?? false;
        if (!matchId && !matchRef && !matchAddr) return false;
      }
      return true;
    });
  }, [trips, statusFilter, debouncedSearch]);

  const transitionMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId, targetStatus }: { tripId: string; vehicleId: string; targetStatus: string }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/transitions",
        { params: { path: { id: tripId, vehicle_pk: vehicleId } }, body: { status: targetStatus } as never }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: (_, vars) => {
      addToast(`Status updated → ${vars.targetStatus.replace(/_/g, " ")}`, "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err, vars) => {
      if (isApiError(err) && err.status === 409) {
        addToast(`Transition to ${vars.targetStatus} not allowed: ${(err as { message: string }).message}`, "error");
      } else {
        addToast(isApiError(err) ? (err as { message: string }).message : "Transition failed", "error");
      }
    },
  });

  // Pickup: advance the vehicle to AT_PICKUP (through any intermediate driver states),
  // verify the pickup OTP, then move it to PAX_PICKED — one click, one OTP.
  const pickupMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId, currentStatus, otp }: { tripId: string; vehicleId: string; currentStatus: string; otp: string }) => {
      const cur = await fetchTvStatus(tripId, vehicleId, currentStatus);
      for (const s of advancePath(cur, "AT_PICKUP")) await postTransition(tripId, vehicleId, s);
      await postVerifyOtp(tripId, vehicleId, "pickup", otp);
      await postTransition(tripId, vehicleId, "PAX_PICKED");
    },
    onSuccess: () => {
      addToast("Passenger picked up", "success");
      setOtpModal(null);
      setOtpValue("");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? (err as { message: string }).message : "Pickup failed", "error");
    },
  });

  // Drop: advance to AT_DROP (through IN_TRANSIT), verify the drop OTP, then PAX_DROPPED →
  // COMPLETED, ending the trip — one click, one OTP.
  const dropMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId, currentStatus, otp }: { tripId: string; vehicleId: string; currentStatus: string; otp: string }) => {
      const cur = await fetchTvStatus(tripId, vehicleId, currentStatus);
      for (const s of advancePath(cur, "AT_DROP")) await postTransition(tripId, vehicleId, s);
      await postVerifyOtp(tripId, vehicleId, "drop", otp);
      await postTransition(tripId, vehicleId, "PAX_DROPPED");
      await postTransition(tripId, vehicleId, "COMPLETED");
    },
    onSuccess: () => {
      addToast("Trip completed", "success");
      setOtpModal(null);
      setOtpValue("");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? (err as { message: string }).message : "Drop failed", "error");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId, fleetVehicleId, driverId, reason }: {
      tripId: string; vehicleId: string; fleetVehicleId: string; driverId: string; reason: string;
    }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/reassign",
        {
          params: { path: { id: tripId, vehicle_pk: vehicleId } },
          body: { new_vehicle_id: fleetVehicleId, new_driver_id: driverId, reason } as never,
        }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      addToast("Vehicle and driver reassigned", "success");
      setShowReassignModal(null);
      setReassignVehicleId("");
      setReassignDriverId("");
      setReassignReason("");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? (err as { message: string }).message : "Reassignment failed", "error");
    },
  });

  // Initial allotment for a PENDING slot routed to this vendor: the vendor accepts the trip
  // by choosing a vehicle+driver from their own fleet (assign, mode=manual → status ASSIGNED).
  const allotMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId, fleetVehicleId, driverId }: {
      tripId: string; vehicleId: string; fleetVehicleId: string; driverId: string;
    }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/assign",
        {
          params: { path: { id: tripId, vehicle_pk: vehicleId } },
          body: { mode: "manual", vehicle_id: fleetVehicleId, driver_id: driverId } as never,
        }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      addToast("Trip accepted — vehicle & driver allotted", "success");
      setShowReassignModal(null);
      setReassignVehicleId("");
      setReassignDriverId("");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? (err as { message: string }).message : "Allotment failed", "error");
    },
  });

  // Reject a PENDING request — Phase-1 has no soft decline, so this cancels the slot.
  const rejectMutation = useMutation({
    mutationFn: async ({ tripId, vehicleId }: { tripId: string; vehicleId: string }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/transitions",
        {
          params: { path: { id: tripId, vehicle_pk: vehicleId } },
          body: { status: "CANCELLED", context: { reason: "Rejected by vendor" } } as never,
        }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      addToast("Trip request rejected (cancelled)", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? (err as { message: string }).message : "Reject failed", "error");
    },
  });

  const handleOtpSubmit = () => {
    if (!otpModal || !otpValue.trim()) return;
    if (otpModal.phase === "pickup") {
      pickupMutation.mutate({ ...otpModal, otp: otpValue });
    } else {
      dropMutation.mutate({ ...otpModal, otp: otpValue });
    }
  };

  const columns: Column<Trip>[] = [
    {
      key: "id", header: t("tripId", language),
      render: (trip) => <span className="font-mono text-xs">{trip.id.substring(0, 8)}…</span>,
      sortable: true,
    },
    {
      key: "status", header: t("status", language),
      render: (trip) => <StatusBadge status={trip.status} />,
      sortable: true,
    },
    {
      key: "route", header: t("route", language),
      render: (trip) => (
        <span className="text-xs text-text-muted truncate max-w-[200px] inline-block">
          {trip.stops?.[0]?.address ?? "—"}
        </span>
      ),
    },
    {
      key: "vehicles", header: "Vehicles",
      render: (trip) => <span className="text-sm">{trip.vehicles?.length ?? 1}</span>,
    },
    {
      key: "scheduled", header: t("scheduled", language),
      render: (trip) => trip.pickup_at ? (
        <span className="text-xs">{new Date(trip.pickup_at).toLocaleString()}</span>
      ) : <span className="text-text-muted">—</span>,
      sortable: true,
    },
    {
      key: "ref", header: "Ref",
      render: (trip) => trip.reference ? (
        <span className="text-xs text-text-muted">{trip.reference}</span>
      ) : <span className="text-text-muted">—</span>,
    },
    {
      key: "actions", header: t("actions", language),
      render: (trip) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedTripId(trip.id); setShowDetailDrawer(true); }}
          className="px-2.5 py-1 text-xs text-brand-blue hover:bg-brand-blue/5 rounded-md transition-colors font-medium"
        >
          {t("view", language)}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{t("trips", language)}</h2>
        <p className="text-sm text-text-muted mt-1">
          {trips.length} {t("tripsAssignedToFleet", language)}
        </p>
      </div>

      <div className="bg-card-bg border border-card-border rounded-xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchTripIdOrRoute", language)}
              className="w-full pl-9 pr-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          >
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "All" ? t("allStatuses", language) : opt.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {(searchQuery || statusFilter !== "All") && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("All"); }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" /> {t("clear", language)}
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-text-muted text-sm">Loading trips…</div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredTrips}
          pageSize={15}
          emptyMessage={t("noTripsMatch", language)}
          onRowClick={(trip) => { setSelectedTripId(trip.id); setShowDetailDrawer(true); }}
        />
      )}

      {/* TRIP DETAIL DRAWER */}
      <Drawer open={showDetailDrawer} onClose={() => { setShowDetailDrawer(false); setSelectedTripId(null); }} title={t("tripDetails", language)} width="max-w-2xl">
        {selectedTripId && tripDetail && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-text-muted">{tripDetail.id}</span>
              <StatusBadge status={tripDetail.status} size="md" />
            </div>

            {tripDetail.reference && (
              <p className="text-xs text-text-muted">Ref: {tripDetail.reference}</p>
            )}

            {tripDetail.stops.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{t("route", language)}</h4>
                <div className="space-y-3">
                  {tripDetail.stops.map((stop: Stop, idx: number) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-1 ${idx === 0 ? "bg-success" : idx === tripDetail.stops.length - 1 ? "bg-danger" : "bg-warning"}`} />
                        {idx < tripDetail.stops.length - 1 && <div className="w-0.5 h-8 bg-border" />}
                      </div>
                      <div>
                        <p className="text-sm text-text-primary font-medium">{stop.address}</p>
                        <p className="text-xs text-text-muted">
                          {stop.location_type} · {stop.kind}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <TripMapViewWrapper stops={tripDetail.stops.map((s: Stop) => ({
                    address: s.address,
                    lat: s.lat != null ? Number(s.lat) : 0,
                    lng: s.lng != null ? Number(s.lng) : 0,
                    type: s.kind,
                  }))} />
                </div>
              </div>
            )}

            {tripDetail.vehicles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Vehicles</h4>
                <div className="space-y-3">
                  {tripDetail.vehicles.map((tv: TripVehicle, idx: number) => {
                    const currentStatus = tv.status;
                    const canPickup = PRE_PICKUP.has(currentStatus);
                    const canDrop = PRE_DROP.has(currentStatus);
                    const canComplete = currentStatus === "PAX_DROPPED";
                    const canReassign = ACTIVE_STATUSES.has(currentStatus);
                    const isTerminal = TERMINAL_STATUSES.has(currentStatus);

                    return (
                      <div key={tv.id} className="p-4 bg-ops-bg rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-text-muted font-mono">Vehicle {idx + 1}</span>
                            <StatusBadge status={tv.status} />
                          </div>
                          {currentStatus === "PENDING" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setReassignVehicleId("");
                                  setReassignDriverId("");
                                  setShowReassignModal({ tripId: tripDetail.id, vehicleId: tv.id, mode: "allot" });
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-success/10 text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors font-medium"
                              >
                                <CheckCircle className="w-3 h-3" /> Accept &amp; Allot
                              </button>
                              <button
                                onClick={() => rejectMutation.mutate({ tripId: tripDetail.id, vehicleId: tv.id })}
                                disabled={rejectMutation.isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-danger/10 text-danger border border-danger/30 rounded-lg hover:bg-danger/20 transition-colors font-medium disabled:opacity-50"
                              >
                                <X className="w-3 h-3" /> Reject
                              </button>
                            </div>
                          )}
                          {!isTerminal && canReassign && (
                            <button
                              onClick={() => {
                                setReassignVehicleId(tv.vehicle ?? "");
                                setReassignDriverId(tv.driver ?? "");
                                setShowReassignModal({ tripId: tripDetail.id, vehicleId: tv.id, mode: "reassign" });
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors font-medium"
                            >
                              <RefreshCw className="w-3 h-3" /> Reassign
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-text-muted">Vehicle needed:</span>
                          <span className="px-2 py-0.5 text-xs font-semibold bg-brand-blue/10 text-brand-blue rounded-md">
                            {tv.vehicle_type_name}
                          </span>
                        </div>

                        {tv.vehicle && (
                          <p className="text-xs text-text-muted">
                            Fleet Vehicle: <span className="font-mono text-text-primary">{tv.vehicle_plate ?? tv.vehicle}</span>
                          </p>
                        )}
                        {tv.driver && (
                          <p className="text-xs text-text-muted">
                            Driver: <span className="font-mono text-text-primary">{tv.driver_name ?? tv.driver}</span>
                          </p>
                        )}
                        {tv.locked_price != null && tv.currency && (
                          <p className="text-sm font-semibold text-text-primary">
                            {formatMoney(tv.locked_price, tv.currency)}
                          </p>
                        )}

                        {(() => {
                          // pickup_otp/drop_otp aren't in the generated schema yet — read via cast.
                          const otp = tv as unknown as { pickup_otp?: string; drop_otp?: string };
                          if (!otp.pickup_otp && !otp.drop_otp) return null;
                          return (
                            <div className="flex flex-wrap gap-4 mt-1 p-2 bg-brand-blue/5 rounded-lg border border-brand-blue/10">
                              {otp.pickup_otp && (
                                <div className="text-xs">
                                  <span className="text-text-muted">Pickup OTP: </span>
                                  <span className="font-mono font-bold text-brand-blue tracking-widest">{otp.pickup_otp}</span>
                                </div>
                              )}
                              {otp.drop_otp && (
                                <div className="text-xs">
                                  <span className="text-text-muted">Drop OTP: </span>
                                  <span className="font-mono font-bold text-brand-blue tracking-widest">{otp.drop_otp}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {(canPickup || canDrop || canComplete) && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {canPickup && (
                              <button
                                onClick={() => setOtpModal({ tripId: tripDetail.id, vehicleId: tv.id, phase: "pickup", currentStatus })}
                                disabled={pickupMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 hover:bg-brand-blue/20 transition-colors disabled:opacity-50"
                              >
                                <Key className="w-3 h-3" /> {pickupMutation.isPending ? "Picking up…" : "Passenger Pickup"}
                              </button>
                            )}
                            {canDrop && (
                              <button
                                onClick={() => setOtpModal({ tripId: tripDetail.id, vehicleId: tv.id, phase: "drop", currentStatus })}
                                disabled={dropMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >
                                <Key className="w-3 h-3" /> {dropMutation.isPending ? "Completing…" : "Passenger Drop"}
                              </button>
                            )}
                            {canComplete && (
                              <button
                                onClick={() => transitionMutation.mutate({ tripId: tripDetail.id, vehicleId: tv.id, targetStatus: "COMPLETED" })}
                                disabled={transitionMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle className="w-3 h-3" /> Complete Trip
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {selectedTripId && !tripDetail && (
          <div className="text-center py-8 text-text-muted text-sm">Loading trip details…</div>
        )}
      </Drawer>

      {/* REASSIGN MODAL */}
      {showReassignModal && (
        <Modal
          open={!!showReassignModal}
          onClose={() => { setShowReassignModal(null); setReassignVehicleId(""); setReassignDriverId(""); setReassignReason(""); }}
          title={showReassignModal.mode === "allot" ? "Accept & Allot — Vehicle & Driver" : "Reassign Vehicle & Driver"}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              {showReassignModal.mode === "allot"
                ? "Choose a vehicle and driver from your fleet to serve this trip. This accepts the request and assigns it."
                : "Select a replacement vehicle and driver from your fleet. The current assignment will be replaced."}
            </p>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Vehicle <span className="text-danger">*</span>
              </label>
              <SearchableSelect
                value={reassignVehicleId}
                onChange={setReassignVehicleId}
                options={vehicleOptions}
                placeholder="Search by plate or type…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Driver <span className="text-danger">*</span>
              </label>
              <SearchableSelect
                value={reassignDriverId}
                onChange={setReassignDriverId}
                options={driverOptions}
                placeholder="Search driver by name or phone…"
              />
            </div>

            {showReassignModal.mode !== "allot" && (
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Reason <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Vehicle breakdown, driver unavailable…"
                  className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              {showReassignModal.mode === "allot" ? (
                <button
                  onClick={() => {
                    if (!showReassignModal || !reassignVehicleId || !reassignDriverId) return;
                    allotMutation.mutate({
                      tripId: showReassignModal.tripId,
                      vehicleId: showReassignModal.vehicleId,
                      fleetVehicleId: reassignVehicleId,
                      driverId: reassignDriverId,
                    });
                  }}
                  disabled={!reassignVehicleId || !reassignDriverId || allotMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-success text-white rounded-lg font-medium text-sm hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {allotMutation.isPending ? "Allotting…" : "Accept & Allot"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!showReassignModal || !reassignVehicleId || !reassignDriverId || !reassignReason.trim()) return;
                    assignMutation.mutate({
                      tripId: showReassignModal.tripId,
                      vehicleId: showReassignModal.vehicleId,
                      fleetVehicleId: reassignVehicleId,
                      driverId: reassignDriverId,
                      reason: reassignReason,
                    });
                  }}
                  disabled={!reassignVehicleId || !reassignDriverId || !reassignReason.trim() || assignMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-brand-blue text-white rounded-lg font-medium text-sm hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {assignMutation.isPending ? "Reassigning…" : "Confirm Reassign"}
                </button>
              )}
              <button
                onClick={() => { setShowReassignModal(null); setReassignVehicleId(""); setReassignDriverId(""); setReassignReason(""); }}
                className="px-4 py-2.5 border border-border text-text-primary rounded-lg font-medium text-sm hover:bg-ops-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* OTP MODAL */}
      {otpModal && (
        <Modal
          open={!!otpModal}
          onClose={() => { setOtpModal(null); setOtpValue(""); }}
          title={`OTP Verification — ${otpModal.phase.charAt(0).toUpperCase() + otpModal.phase.slice(1)}`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-brand-blue/5 rounded-lg">
              <Key className="w-4 h-4 text-brand-blue" />
              <p className="text-sm text-text-primary">Enter the OTP provided by the passenger to confirm {otpModal.phase}.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">OTP Code</label>
              <input
                type="text"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value)}
                placeholder="Enter OTP…"
                maxLength={6}
                className="w-full px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-primary font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-blue/30 text-center text-lg"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleOtpSubmit}
                disabled={!otpValue.trim() || pickupMutation.isPending || dropMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-success text-white rounded-lg font-medium text-sm hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pickupMutation.isPending || dropMutation.isPending
                  ? "Confirming…"
                  : otpModal.phase === "pickup"
                    ? "Confirm Pickup"
                    : "Confirm Drop & Complete"}
              </button>
              <button
                onClick={() => { setOtpModal(null); setOtpValue(""); }}
                className="px-4 py-2.5 border border-border text-text-primary rounded-lg font-medium text-sm hover:bg-ops-bg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
