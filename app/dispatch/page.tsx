"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, wsInvalidationMap, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useRideEvents } from "@/lib/shared/realtime/ws";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { VehicleStatus } from "@/lib/types";
import { StateTransitionManager } from "@/components/trips/StateTransitionManager";
import { Zap, CheckCircle2, AlertCircle, MapPin } from "lucide-react";

type BoardCard = components["schemas"]["BoardCard"];
type AutoAssignResult = {
  assigned: number;
  skipped: number;
  reasons: string[];
  lock_skipped: boolean;
};

type BoardColumns = {
  PENDING: BoardCard[];
  ASSIGNED: BoardCard[];
  EN_ROUTE_PICKUP: BoardCard[];
  IN_TRANSIT: BoardCard[];
  EXCEPTION: BoardCard[];
  [key: string]: BoardCard[];
};

const COLUMN_ORDER = ["PENDING", "ASSIGNED", "EN_ROUTE_PICKUP", "IN_TRANSIT", "EXCEPTION"] as const;
const COLUMN_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  EN_ROUTE_PICKUP: "En Route Pickup",
  IN_TRANSIT: "In Transit",
  EXCEPTION: "Exception",
};

const EXCEPTION_STATUSES = ["SOS", "BREAKDOWN", "ACCIDENT", "NO_SHOW"];

export default function DispatchPage() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [autoAssignResult, setAutoAssignResult] = useState<AutoAssignResult | null>(null);

  useRideEvents({ invalidationMap: wsInvalidationMap });

  const { data: boardData, isLoading } = useQuery<{ columns: BoardColumns }>({
    queryKey: keys.dispatch.board(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/dispatch/board", {});
      if (err) throw err;
      return res as unknown as { columns: BoardColumns };
    },
    refetchInterval: 30_000,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      const { data: res, error: err } = await apiClient.POST("/v1/dispatch/auto-assign-all", {});
      if (err) throw err;
      return res;
    },
    onSuccess: (result) => {
      if (!result) return;
      const r = result as unknown as AutoAssignResult;
      setAutoAssignResult(r);
      addToast(`Auto-assign: ${r.assigned} assigned, ${r.skipped} skipped`, "success");
      void qc.invalidateQueries({ queryKey: keys.dispatch.board() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Auto-assign failed", "error");
    },
  });

  const columns = boardData?.columns ?? {} as BoardColumns;
  const allCards = COLUMN_ORDER.flatMap((col) => columns[col] ?? []);
  const totalCards = allCards.length;
  const alertCards = allCards.filter((card) => EXCEPTION_STATUSES.includes(card.status));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dispatch Board</h1>
        <p className="text-sm text-text-secondary mt-1">Real-time trip dispatch from the live API. WS events auto-refresh.</p>
      </div>

      <div className="bg-gradient-to-r from-brand-blue/5 to-indigo-500/5 border border-brand-blue/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-blue" /> Auto-Assign All
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Assigns best available vehicles to all pending trips in one call.</p>
          </div>
          <Button
            onClick={() => autoAssignMutation.mutate()}
            variant="primary"
            disabled={autoAssignMutation.isPending}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {autoAssignMutation.isPending ? "Assigning…" : "Auto-Assign All"}
          </Button>
        </div>

        {autoAssignResult && (
          <div className="mt-3 pt-3 border-t border-brand-blue/10 space-y-2">
            <p className="text-xs font-medium text-text-primary">
              {autoAssignResult.assigned} assigned · {autoAssignResult.skipped} skipped
            </p>
            {autoAssignResult.reasons && autoAssignResult.reasons.length > 0 && (
              <div className="space-y-1">
                {autoAssignResult.reasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-ops-bg border border-border rounded px-2 py-1">
                    <CheckCircle2 className="w-3 h-3 text-text-secondary shrink-0" />
                    <span className="text-text-secondary">{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60">Total Vehicles</p>
          <p className="text-2xl font-bold text-white mt-1">{totalCards}</p>
        </div>
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60">Columns</p>
          <p className="text-2xl font-bold text-white mt-1">{COLUMN_ORDER.length}</p>
        </div>
        <div className={`${alertCards.length > 0 ? "bg-danger" : "bg-ops-sidebar"} rounded-xl p-4`}>
          <p className="text-xs text-white/60">Alerts</p>
          <p className="text-2xl font-bold text-white mt-1">{alertCards.length}</p>
        </div>
        <div className="bg-ops-sidebar rounded-xl p-4">
          <p className="text-xs text-white/60">Pending</p>
          <p className="text-2xl font-bold text-white mt-1">{(columns["PENDING"] ?? []).length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-text-secondary">Loading dispatch board…</div>
      ) : totalCards === 0 ? (
        <Card padding="lg" className="text-center py-8 text-text-secondary">No board data.</Card>
      ) : (
        <div className="space-y-6">
          {COLUMN_ORDER.map((colKey) => {
            const cards = columns[colKey] ?? [];
            return (
              <div key={colKey}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-text-primary">{COLUMN_LABELS[colKey] ?? colKey}</h3>
                  <span className="text-xs text-text-secondary bg-ops-bg border border-border rounded px-1.5 py-0.5">
                    {cards.length}
                  </span>
                </div>
                {!cards.length ? (
                  <p className="text-xs text-text-secondary italic">No vehicles in this stage.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {cards.map((card: BoardCard) => {
                      const isAlert = EXCEPTION_STATUSES.includes(card.status);
                      return (
                        <div
                          key={card.id}
                          className={`p-4 rounded-xl border space-y-3 ${isAlert ? "bg-danger/5 border-danger/20" : "bg-white border-border"}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={card.status as VehicleStatus} />
                                {isAlert && <AlertCircle className="w-4 h-4 text-danger" />}
                              </div>
                              <p className="text-xs text-text-secondary font-mono">{card.trip_reference}</p>
                            </div>
                          </div>

                          <div className="text-xs space-y-1">
                            {card.vendor_name && (
                              <p className="text-text-primary font-medium">{card.vendor_name}</p>
                            )}
                            {card.vehicle_type && (
                              <p className="text-text-secondary">{card.vehicle_type}{card.vehicle_registration ? ` · ${card.vehicle_registration}` : ""}</p>
                            )}
                            {card.driver_name && (
                              <p className="text-text-secondary">{card.driver_name}</p>
                            )}
                            {card.pickup_address && (
                              <p className="text-text-secondary flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" /> {card.pickup_address}
                              </p>
                            )}
                            {card.pickup_at && (
                              <p className="text-text-secondary">
                                {new Date(card.pickup_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                              </p>
                            )}
                          </div>

                          {card.trip && card.id && (
                            <StateTransitionManager
                              tripId={card.trip}
                              vehicleId={card.id}
                              currentStatus={card.status as VehicleStatus}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
