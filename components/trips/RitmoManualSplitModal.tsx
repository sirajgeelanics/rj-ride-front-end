"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch, isApiError } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle } from "lucide-react";

interface SplitCandidate {
  vendor_id: string;
  vendor_name: string;
  vehicle_id: string;
  plate: string;
  vehicle_name: string | null;
  vehicle_type_name: string;
  capacity: number;
}

interface RitmoManualSplitModalProps {
  tripVehicleId: string;
  vehicleTypeName: string;
  paxCount: number;
  onClose: () => void;
}

/**
 * The RITMO ops module's manual split: ops hand-picks which vehicles cover the passenger count
 * instead of Accept's own automatic fallback (trips.services.split_allocate_ritmo_vehicle), which
 * picks the largest free vehicles citywide on its own. Each checked vehicle is assumed filled to
 * its own full seat capacity, IN THE ORDER PICKED — the running "N passengers pending" / "All N
 * covered" counter reflects that; the actual per-vehicle pax split happens server-side the same
 * way (apps.trips.services.manual_split_allocate_ritmo_vehicle).
 *
 * Not in the generated OpenAPI schema (a RITMO-module endpoint) — driven with csrfFetch, same as
 * the rest of app/ritmo/page.tsx.
 */
export const RitmoManualSplitModal: React.FC<RitmoManualSplitModalProps> = ({
  tripVehicleId,
  vehicleTypeName,
  paxCount,
  onClose,
}) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();
  // Ordered, not a Set — pick order determines which vehicle fills to capacity first
  // (server mirrors this exactly), so insertion order must survive.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ["ritmo-manual-split-modal", "candidates", tripVehicleId],
    queryFn: async (): Promise<SplitCandidate[]> => {
      const resp = await csrfFetch(`/api/v1/ritmo/split-candidates/${tripVehicleId}/`, {
        credentials: "include",
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: SplitCandidate[];
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Failed to load candidates (${resp.status})`);
      return body.result ?? [];
    },
  });

  const candidatesById = useMemo(() => {
    const m = new Map<string, SplitCandidate>();
    for (const c of candidates) m.set(c.vehicle_id, c);
    return m;
  }, [candidates]);

  const totalSelectedCapacity = useMemo(
    () =>
      selectedIds.reduce((sum, id) => sum + (candidatesById.get(id)?.capacity ?? 0), 0),
    [selectedIds, candidatesById],
  );
  const remaining = Math.max(0, paxCount - totalSelectedCapacity);
  const covered = selectedIds.length > 0 && remaining === 0;

  const toggle = (vehicleId: string) => {
    setSelectedIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId],
    );
  };

  const submit = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch(`/api/v1/ritmo/manual-split/${tripVehicleId}/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_ids: selectedIds }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: { split_into?: { vendor_name: string; vehicle_type: string; pax_count: number }[] };
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Split failed (${resp.status})`);
      return body.result;
    },
    onSuccess: (result) => {
      const into = result?.split_into ?? [];
      const summary = into
        .map((v) => `${v.vendor_name} (${v.vehicle_type} · ${v.pax_count}p)`)
        .join(", ");
      addToast(`Split across ${into.length} vehicles: ${summary}.`, "success");
      void qc.invalidateQueries({ queryKey: ["ritmo", "requests"] });
      onClose();
    },
    onError: (err: unknown) => {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Split failed",
        "error",
      );
    },
  });

  return (
    <Modal open onClose={onClose} title="Split across vehicles" size="md">
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">
          {vehicleTypeName} isn&apos;t available for all {paxCount} passenger
          {paxCount !== 1 ? "s" : ""}. Pick vehicles below — each fills to its own seat capacity
          in the order you pick them.
        </p>

        <div
          className={`rounded-lg border p-3 text-sm font-medium ${
            covered
              ? "border-success/40 bg-success/10 text-success"
              : "border-border bg-ops-card2 text-text-primary"
          }`}
        >
          {covered ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              All {paxCount} passengers covered
            </span>
          ) : (
            <span>
              {remaining} passenger{remaining !== 1 ? "s" : ""} pending
              {selectedIds.length > 0 && (
                <span className="text-text-tertiary font-normal">
                  {" "}
                  ({totalSelectedCapacity} of {paxCount} seated so far)
                </span>
              )}
            </span>
          )}
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-text-secondary">Loading vehicles…</p>
          ) : candidates.length === 0 ? (
            <p className="text-xs text-warning">No vehicles free at this trip&apos;s time.</p>
          ) : (
            candidates.map((c) => {
              const checked = selectedIds.includes(c.vehicle_id);
              const pickOrder = checked ? selectedIds.indexOf(c.vehicle_id) + 1 : null;
              // Once the pax count is already covered, adding another vehicle can only ever
              // be an unnecessary extra allotment — lock the remaining unchecked rows rather
              // than let ops keep piling more vehicles onto an already-satisfied split. An
              // already-checked row stays toggleable, so backing out a pick is never blocked.
              const lockedOut = !checked && covered;
              return (
                <label
                  key={c.vehicle_id}
                  className={`flex items-center gap-2.5 p-2 rounded border text-sm ${
                    checked
                      ? "border-brand-blue/40 bg-brand-blue/5 cursor-pointer"
                      : lockedOut
                        ? "border-border bg-ops-card2 opacity-50 cursor-not-allowed"
                        : "border-border bg-white cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={lockedOut}
                    onChange={() => toggle(c.vehicle_id)}
                    className="w-4 h-4 disabled:cursor-not-allowed"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-text-primary font-medium">
                      {c.vehicle_name ? `${c.vehicle_name} — ${c.plate}` : c.plate}
                    </span>
                    <span className="text-text-secondary">
                      {" "}
                      — {c.vehicle_type_name} ({c.capacity} seats) — {c.vendor_name}
                    </span>
                  </span>
                  {pickOrder !== null && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue shrink-0">
                      #{pickOrder}
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => submit.mutate()}
            variant="primary"
            disabled={!covered || submit.isPending}
          >
            {submit.isPending ? "Splitting…" : "Assign split"}
          </Button>
          <Button onClick={onClose} variant="ghost">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

RitmoManualSplitModal.displayName = "RitmoManualSplitModal";
