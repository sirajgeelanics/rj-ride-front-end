"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch, isApiError } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

// Same stale-schema workaround as VehicleAssignmentModal.tsx — Vendor.airport_code isn't in the
// generated type yet.
type Vendor = components["schemas"]["Vendor"] & { airport_code?: string | null };
type Vehicle = components["schemas"]["Vehicle"];

interface RitmoManualAllotModalProps {
  tripVehicleId: string;
  vehicleTypeName: string;
  /** apps.trips.models.TripRequest.airport_code — narrows the combined vehicle list to every
   * vendor operating at this airport, same city-matching apps.trips.services.vendors_in_city
   * uses for auto-dispatch. There is no vendor step: picking a vehicle picks its vendor. */
  airportCode: string | null;
  paxCount?: number;
  onClose: () => void;
}

/**
 * The RITMO ops module's manual alternative to Accept: ops picks one vehicle out of every
 * vendor's fleet at the trip's airport — no separate vendor step, since the vehicle alone
 * determines who gets the trip (apps.trips.services.manual_allocate_ritmo_vehicle derives the
 * vendor from vehicle.vendor). The driver is still auto-picked server-side (first AVAILABLE,
 * free at the trip's time) and auto-accepted through in the same call, exactly like Accept.
 *
 * Not in the generated OpenAPI schema (a RITMO-module endpoint) — driven with csrfFetch, same
 * as the rest of app/ritmo/page.tsx.
 */
export const RitmoManualAllotModal: React.FC<RitmoManualAllotModalProps> = ({
  tripVehicleId,
  vehicleTypeName,
  airportCode,
  paxCount = 0,
  onClose,
}) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  const [vehicleId, setVehicleId] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { data: allVendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["ritmo-manual-allot-modal", "vendors"],
    queryFn: () => fetchAllPages<Vendor>("/api/v1/config/vendors/"),
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["ritmo-manual-allot-modal", "vehicles"],
    queryFn: () => fetchAllPages<Vehicle>("/api/v1/fleet/vehicles/"),
  });

  const loading = vendorsLoading || vehiclesLoading;

  const vendorNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of allVendors) m.set(v.id, v.name);
    return m;
  }, [allVendors]);

  // Vendors operating at this airport (case-insensitive — Vendor.airport_code is free-text).
  const vendorIdsAtAirport = useMemo(() => {
    if (!airportCode) return null;
    const code = airportCode.toLowerCase();
    return new Set(
      allVendors.filter((v) => (v.airport_code ?? "").toLowerCase() === code).map((v) => v.id)
    );
  }, [allVendors, airportCode]);

  // One combined, active fleet across every vendor at the airport — deliberately unfiltered by
  // vehicle type (any type is fine as long as it seats everyone; the backend's own capacity
  // check on assign_vehicle is what actually gates it, same as VehicleAssignmentModal).
  const candidateVehicles = useMemo(() => {
    return vehicles.filter(
      (v) => v.is_active && (!vendorIdsAtAirport || vendorIdsAtAirport.has(v.vendor))
    );
  }, [vehicles, vendorIdsAtAirport]);

  // Filter option lists are both derived from the full candidate pool (not from each other's
  // current selection), so picking one never hides options for the other.
  const vendorFilterOptions = useMemo(() => {
    const ids = new Set(candidateVehicles.map((v) => v.vendor));
    return Array.from(ids)
      .map((id) => ({ value: id, label: vendorNameById.get(id) ?? "Unknown vendor" }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [candidateVehicles, vendorNameById]);

  const typeFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const v of candidateVehicles) seen.set(v.vehicle_type, v.vehicle_type_name);
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [candidateVehicles]);

  const filteredVehicles = useMemo(() => {
    return candidateVehicles.filter(
      (v) =>
        (!vendorFilter || v.vendor === vendorFilter) &&
        (!typeFilter || v.vehicle_type === typeFilter)
    );
  }, [candidateVehicles, vendorFilter, typeFilter]);

  const submit = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(`/api/v1/ritmo/manual-allot/${tripVehicleId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_id: vehicleId }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: { vendor_name?: string };
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Manual allot failed (${resp.status})`);
      return body.result;
    },
    onSuccess: (result) => {
      addToast(`Allotted to ${result?.vendor_name ?? "the selected vendor"} and accepted.`, "success");
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
      onClose();
    },
    onError: (err: unknown) => {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Request failed",
        "error"
      );
    },
  });

  return (
    <Modal open onClose={onClose} title="Manually allot vehicle" size="md">
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          Requested car type: <strong>{vehicleTypeName}</strong>. Every active vehicle from
          every vendor{airportCode ? ` at ${airportCode}` : ""} is offered here, any type — the
          driver is auto-picked (first available, free at this trip&apos;s time) and the trip is
          accepted in one step, same as Accept.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Filter by vendor">
            <SearchableSelect
              value={vendorFilter}
              onChange={(val) => {
                setVendorFilter(val);
                setVehicleId("");
              }}
              options={vendorFilterOptions}
              placeholder="All vendors"
              clearable
            />
          </FormField>
          <FormField label="Filter by vehicle type">
            <SearchableSelect
              value={typeFilter}
              onChange={(val) => {
                setTypeFilter(val);
                setVehicleId("");
              }}
              options={typeFilterOptions}
              placeholder="All vehicle types"
              clearable
            />
          </FormField>
        </div>

        <FormField label="Vehicle" required>
          <SearchableSelect
            value={vehicleId}
            onChange={setVehicleId}
            options={filteredVehicles.map((v) => ({
              value: v.id,
              label: v.vehicle_name_display
                ? `${v.vehicle_name_display} — ${v.plate} — ${v.vehicle_type_name} — ${vendorNameById.get(v.vendor) ?? "Unknown vendor"}`
                : `${v.plate} — ${v.vehicle_type_name} — ${vendorNameById.get(v.vendor) ?? "Unknown vendor"}`,
            }))}
            placeholder={loading ? "Loading vehicles…" : "Search vehicle…"}
          />
          {!loading && candidateVehicles.length === 0 && (
            <p className="text-xs text-warning mt-1">
              {airportCode
                ? `No active vehicles from any vendor at ${airportCode}.`
                : "No active vehicles."}
            </p>
          )}
          {!loading && candidateVehicles.length > 0 && filteredVehicles.length === 0 && (
            <p className="text-xs text-warning mt-1">No vehicle matches these filters.</p>
          )}
        </FormField>

        {paxCount > 0 && (
          <p className="text-xs text-text-tertiary">
            {paxCount} passenger{paxCount !== 1 ? "s" : ""} booked — the chosen vehicle must
            seat at least that many, whatever its type (the backend checks this too).
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => submit.mutate()}
            variant="primary"
            disabled={!vehicleId || submit.isPending}
          >
            {submit.isPending ? "Allotting…" : "Allot & accept"}
          </Button>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

RitmoManualAllotModal.displayName = "RitmoManualAllotModal";
