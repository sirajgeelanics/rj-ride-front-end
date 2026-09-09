"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, csrfFetch, formatMoney } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

// The generated Vendor type is stale here — it still has "city" (a field that no longer
// exists on the backend model) instead of the current "airport_code" (apps.fleet.models.
// Vendor.airport_code). Same fix as the other hand-typed extensions in this codebase for a
// field the schema hasn't caught up on: intersect it in rather than trust the generated type.
type Vendor = components["schemas"]["Vendor"] & { airport_code?: string | null };
type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

// Not yet in the generated OpenAPI schema (a new backend endpoint) — hand-typed to match
// apps.trips.services.preview_reassign_price's result shape.
interface ReassignQuote {
  vendor_changed: boolean;
  current_price_minor: number | null;
  new_price_minor: number | null;
  currency: string;
  rate_card_found: boolean;
}

interface VehicleAssignmentModalProps {
  tripId: string;
  tripVehicleId: string;
  /** "assign" — no vehicle/driver on this slot yet (PENDING/VENDOR_OFFERED). "reassign" —
   * already has a vehicle/driver; requires a reason. Both allow ANY vendor's fleet and ANY
   * vehicle type — the only guard is seat capacity (apps.trips.services.assign_vehicle /
   * reassign_vehicle), never an exact match to the originally requested type. */
  mode: "assign" | "reassign";
  /** Passenger count already booked on this slot — shown so the picker knows what a
   * different-type substitution still needs to seat (the backend checks this too). */
  paxCount?: number;
  /** RITMO-origin trips only (apps.trips.models.TripRequest.airport_code) — narrows the
   * Vendor picker to vendors operating at that airport, the same city-matching
   * apps.trips.services.vendors_in_city already uses for auto-dispatch. Omit entirely for a
   * non-RITMO trip (manual/other origins): no airport concept applies, so every vendor stays
   * offered, unchanged from before. */
  airportCode?: string | null;
  onClose: () => void;
}

export const VehicleAssignmentModal: React.FC<VehicleAssignmentModalProps> = ({
  tripId,
  tripVehicleId,
  mode,
  paxCount = 0,
  airportCode,
  onClose,
}) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [vendorId, setVendorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [reason, setReason] = useState("");

  // Deliberately NOT keys.config.vendors.list() / keys.fleet.vehicles.list() / .drivers.list():
  // those bare keys are already shared across screens with inconsistent shapes (ManualTripCreation
  // /FleetFilterPanel cache { results: [...] } under the vendors key; app/page.tsx's dashboard
  // caches a plain array under the vehicles/drivers keys). React Query dedupes by key only, not
  // by shape, so reusing either key risks this modal being handed whichever shape happened to
  // load first. A private key sidesteps the whole inconsistency.
  const { data: allVendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["vehicle-assignment-modal", "vendors"],
    queryFn: () => fetchAllPages<Vendor>("/api/v1/config/vendors/"),
  });

  // RITMO trips only: same airport-matching apps.trips.services.vendors_in_city uses for
  // auto-dispatch (case-insensitive — Vendor.airport_code is free-text). A trip with no
  // airport_code (manual/other origins) leaves every vendor offered, unchanged from before.
  const vendors = useMemo(() => {
    if (!airportCode) return allVendors;
    const code = airportCode.toLowerCase();
    return allVendors.filter((v) => (v.airport_code ?? "").toLowerCase() === code);
  }, [allVendors, airportCode]);

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ["vehicle-assignment-modal", "vehicles"],
    queryFn: () => fetchAllPages<Vehicle>("/api/v1/fleet/vehicles/"),
  });

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["vehicle-assignment-modal", "drivers"],
    queryFn: () => fetchAllPages<Driver>("/api/v1/fleet/drivers/"),
  });

  const loading = vendorsLoading || vehiclesLoading || driversLoading;

  // Reassign only — assign mode never re-prices (locked_price is fixed at booking regardless
  // of which vendor picks it up). Refetches whenever the candidate vehicle changes, so the
  // price shown always matches whatever's currently selected, not a stale earlier pick.
  const { data: priceQuote, isFetching: quoteLoading } = useQuery({
    queryKey: ["vehicle-assignment-modal", "reassign-quote", tripVehicleId, vehicleId],
    queryFn: async (): Promise<ReassignQuote | null> => {
      const resp = await csrfFetch(
        `/api/v1/trips/${tripId}/vehicles/${tripVehicleId}/reassign-quote/?new_vehicle_id=${vehicleId}`,
        { credentials: "include" }
      );
      const body = (await resp.json().catch(() => ({}))) as {
        result?: ReassignQuote;
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Quote failed (${resp.status})`);
      return body.result ?? null;
    },
    enabled: mode === "reassign" && !!vehicleId,
  });

  // Blocks submit client-side too — matches the backend's own hard block (reassign_vehicle
  // refuses a cross-vendor move with no rate card), so this never fires a doomed request.
  const blockedByMissingRateCard = !!priceQuote?.vendor_changed && !priceQuote.rate_card_found;

  // Any type is offered in BOTH modes — a vehicle need not match the requested type exactly,
  // only seat everyone booked (apps.trips.services.assign_vehicle / reassign_vehicle apply the
  // identical capacity-only guard now; requested vehicle type stays what the trip was priced
  // on regardless of which type actually turns up). The backend is the source of truth on
  // capacity — this list is deliberately unfiltered by it, so a rejection always comes with
  // the specific "N passengers exceed the M-seat capacity of X" reason, not a silently
  // vanished option.
  const vehiclesForVendor = useMemo(() => {
    if (!vendorId) return [];
    return vehicles.filter((v) => v.vendor === vendorId && v.is_active);
  }, [vehicles, vendorId]);

  const driversForVendor = useMemo(() => {
    if (!vendorId) return [];
    return drivers.filter(
      (d) => d.vendor === vendorId && d.is_active && d.status === "AVAILABLE"
    );
  }, [drivers, vendorId]);

  // Changing vendor invalidates whatever vehicle/driver was picked under the old one.
  const onVendorChange = (val: string) => {
    setVendorId(val);
    setVehicleId("");
    setDriverId("");
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "assign") {
        const { error: err } = await apiClient.POST(
          "/v1/trips/{id}/vehicles/{vehicle_pk}/assign",
          {
            params: { path: { id: tripId, vehicle_pk: tripVehicleId } },
            body: { mode: "manual", vehicle_id: vehicleId, driver_id: driverId } as never,
          }
        );
        if (err) throw err;
        return;
      }
      const { error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/reassign",
        {
          params: { path: { id: tripId, vehicle_pk: tripVehicleId } },
          body: {
            new_vehicle_id: vehicleId,
            new_driver_id: driverId,
            reason: reason.trim(),
          } as never,
        }
      );
      if (err) throw err;
    },
    onSuccess: () => {
      addToast(mode === "assign" ? "Vehicle & driver assigned" : "Vehicle & driver reassigned", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.detail(tripId) });
      void qc.invalidateQueries({ queryKey: keys.dispatch.board() });
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Request failed";
      addToast(message, "error");
    },
  });

  const canSubmit =
    !!vendorId &&
    !!vehicleId &&
    !!driverId &&
    (mode === "assign" || reason.trim().length > 0) &&
    !blockedByMissingRateCard;

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "assign" ? "Assign vehicle & driver" : "Reassign vehicle & driver"}
      size="lg"
    >
      <div className="space-y-4">
        {mode === "reassign" && !airportCode && (
          <p className="text-xs text-text-secondary">
            Any vendor&apos;s fleet may be picked here — this hands the whole trip-vehicle to
            that vendor, not just the car on it.
          </p>
        )}
        {airportCode && (
          <p className="text-xs text-text-secondary">
            Only vendors operating at {airportCode} are offered — this hands the whole
            trip-vehicle to whichever one is picked, not just the car on it.
          </p>
        )}

        <FormField label="Vendor" required>
          <SearchableSelect
            value={vendorId}
            onChange={onVendorChange}
            options={vendors.map((v) => ({ value: v.id, label: v.name }))}
            placeholder={airportCode ? `Search vendor at ${airportCode}…` : "Search vendor…"}
          />
          {airportCode && vendors.length === 0 && !vendorsLoading && (
            <p className="text-xs text-warning mt-1">
              No vendors operate at {airportCode} — add one under Configuration.
            </p>
          )}
        </FormField>

        <FormField label="Vehicle" required>
          <SearchableSelect
            value={vehicleId}
            onChange={setVehicleId}
            options={vehiclesForVendor.map((v) => ({
              value: v.id,
              label: v.vehicle_name_display
                ? `${v.vehicle_name_display} — ${v.plate} (${v.vehicle_type_name})`
                : `${v.plate} — ${v.vehicle_type_name}`,
            }))}
            placeholder={vendorId ? "Search vehicle…" : "Pick a vendor first"}
          />
          {vendorId && vehiclesForVendor.length === 0 && !loading && (
            <p className="text-xs text-warning mt-1">This vendor has no active vehicle.</p>
          )}
        </FormField>

        <FormField label="Driver" required>
          <SearchableSelect
            value={driverId}
            onChange={setDriverId}
            options={driversForVendor.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.phone})`,
            }))}
            placeholder={vendorId ? "Search driver…" : "Pick a vendor first"}
          />
          {vendorId && driversForVendor.length === 0 && !loading && (
            <p className="text-xs text-warning mt-1">This vendor has no available driver.</p>
          )}
        </FormField>

        {mode === "reassign" && vehicleId && (
          <div className="rounded-lg border border-border p-3 text-sm">
            {quoteLoading ? (
              <p className="text-text-secondary">Checking price…</p>
            ) : !priceQuote?.vendor_changed ? (
              <p className="text-text-secondary">Same vendor — price is unchanged.</p>
            ) : priceQuote.rate_card_found ? (
              <p>
                Price changes with the vendor:{" "}
                {priceQuote.current_price_minor != null && (
                  <span className="text-text-tertiary line-through mr-1">
                    {formatMoney(priceQuote.current_price_minor, priceQuote.currency)}
                  </span>
                )}
                <strong>
                  {formatMoney(priceQuote.new_price_minor ?? 0, priceQuote.currency)}
                </strong>{" "}
                <span className="text-text-secondary">(this vendor&apos;s own rate card)</span>
              </p>
            ) : (
              <p className="text-danger">
                No rate card for this vendor for this vehicle&apos;s type — reassignment is
                blocked until one exists.
              </p>
            )}
          </div>
        )}

        {mode === "reassign" && (
          <FormField label="Reason" required>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this vehicle/driver being changed?"
            />
          </FormField>
        )}

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
            disabled={!canSubmit || submit.isPending}
          >
            {submit.isPending ? "Saving…" : mode === "assign" ? "Assign" : "Reassign"}
          </Button>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

VehicleAssignmentModal.displayName = "VehicleAssignmentModal";
