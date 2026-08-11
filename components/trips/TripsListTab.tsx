"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TripDetailView } from "@/components/trips/TripDetailView";
import { cursorFromUrl } from "@/hooks/useCursorPagination";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { ChevronRight, ChevronLeft, X, Building2 } from "lucide-react";
import type { TripStatus } from "@/lib/types";

type TripRequest = components["schemas"]["TripRequest"];

const STATUS_FILTERS = ["", "DRAFT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"];

/** Vendors that have been offered/assigned to this trip's vehicles, de-duped, in trip order. */
const assignedVendors = (trip: TripRequest): string[] => {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const v of trip.vehicles ?? []) {
    // PENDING means no vendor has been engaged yet — an offer or an assignment both count.
    if (v.status === "PENDING" || !v.vendor_name) continue;
    if (!seen.has(v.vendor_name)) {
      seen.add(v.vendor_name);
      names.push(v.vendor_name);
    }
  }
  return names;
};

export const TripsListTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [pageIdx, setPageIdx] = useState(0);

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [cancelTrip, setCancelTrip] = useState<TripRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const filters = {
    status: statusFilter || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    cursor: cursor ?? undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: keys.trips.list(filters),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips", {
        params: { query: filters },
      });
      if (err) throw err;
      return res;
    },
  });

  const trips: TripRequest[] = (data?.results ?? []) as TripRequest[];
  // DRF returns `next` as a full URL; the API expects a bare `cursor` value. Feeding the
  // URL straight back made Next silently re-serve page 1.
  const nextCursor = cursorFromUrl(data?.next);
  const hasPrev = pageIdx > 0;
  const hasNext = !!nextCursor;

  const goNext = () => {
    if (!nextCursor) return;
    const newStack = [...cursorStack.slice(0, pageIdx + 1), nextCursor];
    setCursorStack(newStack);
    setPageIdx(pageIdx + 1);
    setCursor(nextCursor);
  };

  const goPrev = () => {
    if (pageIdx === 0) return;
    const newIdx = pageIdx - 1;
    setPageIdx(newIdx);
    setCursor(cursorStack[newIdx] ?? null);
  };

  const resetPagination = () => {
    setCursor(null);
    setCursorStack([null]);
    setPageIdx(0);
  };

  const openCancel = (trip: TripRequest) => {
    setCancelTrip(trip);
    setCancelReason("");
  };

  const handleCancel = async () => {
    if (!cancelTrip) return;
    setCancelling(true);
    try {
      const vehicles = cancelTrip.vehicles ?? [];
      if (vehicles.length === 0) {
        addToast("No vehicles to cancel", "error");
        return;
      }
      for (const v of vehicles) {
        // Cancel each convoy vehicle. The transition serializer's field is `status` (not `to`),
        // and apiClient handles the forced trailing slash + CSRF header — the previous raw
        // csrfFetch sent `{to: "CANCELLED"}` to a slashless URL, so every cancel 400'd. The
        // reason rides along in `context` (the serializer's optional free-form dict).
        const { error: txErr } = await apiClient.POST("/v1/trips/{id}/vehicles/{vehicle_pk}/transitions", {
          params: { path: { id: cancelTrip.id, vehicle_pk: v.id } },
          body: { status: "CANCELLED", context: cancelReason ? { reason: cancelReason } : {} } as never,
        });
        if (txErr) throw txErr;
      }
      addToast("Trip cancelled", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setCancelTrip(null);
      setCancelReason("");
    } catch (err) {
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to cancel", "error");
    } finally {
      setCancelling(false);
    }
  };

  if (selectedTripId) {
    return (
      <div>
        <button
          onClick={() => setSelectedTripId(null)}
          className="text-sm text-brand-blue hover:text-brand-blue/80 mb-4 flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Back to list
        </button>
        <TripDetailView tripId={selectedTripId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-text-secondary mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); resetPagination(); }}
            className="px-3 py-2 bg-white border border-border rounded-lg text-sm text-text-primary"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>{s || "All statuses"}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Date from</label>
          <DateTimePicker mode="date" value={dateFrom} onChange={(val) => { setDateFrom(val); resetPagination(); }} />
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-1">Date to</label>
          <DateTimePicker mode="date" value={dateTo} onChange={(val) => { setDateTo(val); resetPagination(); }} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading trips…</div>
      ) : trips.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-8">
          <p>No trips found. Create your first trip request above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => (
            <div
              key={trip.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTripId(trip.id)}
              onKeyDown={(e) => e.key === "Enter" && setSelectedTripId(trip.id)}
              className="p-3 rounded border border-border cursor-pointer hover:border-brand-blue/40 transition-colors bg-white"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={trip.status as TripStatus} />
                  <div>
                    <p className="text-sm font-medium text-text-primary font-mono">
                      {trip.reference}
                      {trip.customer_name && (
                        <span className="ml-2 text-text-secondary font-sans">{trip.customer_name}</span>
                      )}
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {trip.pickup_at ? new Date(trip.pickup_at).toLocaleString() : "—"}
                      {trip.vehicles.length > 0 && ` · ${trip.vehicles.length} vehicle(s)`}
                    </p>
                    {assignedVendors(trip).length > 0 && (
                      <p className="text-xs mt-0.5 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-text-tertiary" />
                        <span className="text-text-tertiary">Vendor:</span>
                        <span className="text-text-primary font-medium">
                          {assignedVendors(trip).join(", ")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!["COMPLETED", "BILLED", "CANCELLED"].includes(trip.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); openCancel(trip); }}
                      className="text-danger hover:bg-danger/10"
                    >
                      <X className="w-3 h-3 mr-1" /> Cancel
                    </Button>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button onClick={goPrev} disabled={!hasPrev} variant="secondary" size="sm">
          <ChevronLeft className="w-4 h-4 mr-1" /> Prev
        </Button>
        <span className="text-xs text-text-secondary">Page {pageIdx + 1}</span>
        <Button onClick={goNext} disabled={!hasNext} variant="secondary" size="sm">
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {cancelTrip && (
        <Modal
          open={true}
          onClose={() => { setCancelTrip(null); }}
          title="Cancel Trip"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Cancel trip <span className="font-mono font-medium">{cancelTrip.reference}</span>?
              This will cancel all {cancelTrip.vehicles.length} vehicle(s).
            </p>

            <div>
              <label className="block text-xs text-text-secondary mb-1">Reason (optional)</label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation…"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => { void handleCancel(); }}
                variant="primary"
                className="flex-1 bg-danger hover:bg-danger/90"
                disabled={cancelling}
              >
                {cancelling ? "Cancelling…" : "Confirm Cancel"}
              </Button>
              <Button
                onClick={() => { setCancelTrip(null); }}
                variant="secondary"
                className="flex-1"
              >
                Keep Trip
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

TripsListTab.displayName = "TripsListTab";
