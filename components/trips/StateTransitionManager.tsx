"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";

type TripRequest = components["schemas"]["TripRequest"];
import { useToastStore } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

interface StateTransitionManagerProps {
  tripId: string;
  vehicleId: string;
  currentStatus: string;
}

const TRANSITION_LABELS: Record<string, string> = {
  ASSIGNED: "Mark Assigned",
  DRIVER_ACCEPTED: "Driver Accepted",
  EN_ROUTE_PICKUP: "En Route Pickup",
  AT_PICKUP: "At Pickup",
  PAX_PICKED: "Pax Picked (OTP)",
  IN_TRANSIT: "In Transit",
  AT_DROP: "At Drop",
  PAX_DROPPED: "Pax Dropped (OTP)",
  COMPLETED: "Complete",
  NO_SHOW: "No Show",
  BREAKDOWN: "Breakdown",
  DELAYED: "Mark Delayed",
  CANCELLED: "Cancel Vehicle",
};

const OTP_REQUIRED_STATUSES = new Set(["PAX_PICKED", "PAX_DROPPED"]);

const OTP_PHASE_MAP: Record<string, "pickup" | "drop"> = {
  PAX_PICKED: "pickup",
  PAX_DROPPED: "drop",
};

// Mirrors apps.trips.lifecycle.ALLOWED_TRANSITIONS exactly — showing a target this map doesn't
// list is worse than showing nothing: it looks like a valid action and just 409s when clicked.
// VENDOR_OFFERED/SOS are legal backend targets too but have no button here (VENDOR_OFFERED is
// the RITMO timed-offer cycle, not a manual pick; SOS is the dedicated safety flow, not a
// generic status dropdown) — TRANSITION_LABELS simply has no entry for either, so the
// intersection below already excludes them without special-casing.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["DRIVER_ACCEPTED", "BREAKDOWN", "CANCELLED"],
  DRIVER_ACCEPTED: ["EN_ROUTE_PICKUP", "BREAKDOWN", "CANCELLED"],
  EN_ROUTE_PICKUP: ["AT_PICKUP", "BREAKDOWN", "DELAYED", "CANCELLED"],
  AT_PICKUP: ["PAX_PICKED", "NO_SHOW", "BREAKDOWN", "DELAYED", "CANCELLED"],
  PAX_PICKED: ["IN_TRANSIT", "BREAKDOWN"],
  IN_TRANSIT: ["AT_DROP", "BREAKDOWN"],
  AT_DROP: ["PAX_DROPPED", "BREAKDOWN"],
  PAX_DROPPED: ["COMPLETED"],
  BREAKDOWN: ["EN_ROUTE_PICKUP", "CANCELLED"],
  DELAYED: ["EN_ROUTE_PICKUP", "AT_PICKUP", "CANCELLED"],
};

function getAvailableTargets(currentStatus: string): string[] {
  return ALLOWED_TRANSITIONS[currentStatus] ?? [];
}

export const StateTransitionManager: React.FC<StateTransitionManagerProps> = ({
  tripId,
  vehicleId,
  currentStatus,
}) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [otpModal, setOtpModal] = useState<{ targetStatus: string; phase: "pickup" | "drop" } | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  const transitionMutation = useMutation({
    mutationFn: async ({ targetStatus, note }: { targetStatus: string; note?: string }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/transitions",
        {
          params: { path: { id: tripId, vehicle_pk: vehicleId } },
          body: { targetStatus, note } as unknown as TripRequest,
        }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: (_, vars) => {
      addToast(`Vehicle → ${vars.targetStatus}`, "success");
      void qc.invalidateQueries({ queryKey: keys.trips.detail(tripId) });
      void qc.invalidateQueries({ queryKey: keys.dispatch.board() });
    },
    onError: (err, vars) => {
      if (isApiError(err) && err.status === 409) {
        addToast(`Transition to ${vars.targetStatus} not allowed: ${err.message}`, "error");
      } else {
        addToast(isApiError(err) ? err.message : "Transition failed", "error");
      }
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ phase, otp }: { phase: "pickup" | "drop"; otp: string }) => {
      const { data: res, error: err } = await apiClient.POST(
        "/v1/trips/{id}/vehicles/{vehicle_pk}/verify-otp",
        {
          params: { path: { id: tripId, vehicle_pk: vehicleId } },
          body: { phase, otp } as unknown as TripRequest,
        }
      );
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      addToast("OTP verified", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.detail(tripId) });
      void qc.invalidateQueries({ queryKey: keys.dispatch.board() });
      setOtpModal(null);
      setOtpValue("");
      setPendingTarget(null);
    },
    onError: (err) => {
      const msg = isApiError(err) ? err.message : "OTP verification failed";
      addToast(msg, "error");
    },
  });

  const availableTargets = getAvailableTargets(currentStatus);
  if (availableTargets.length === 0) {
    return null;
  }

  const handleTransition = (targetStatus: string) => {
    if (OTP_REQUIRED_STATUSES.has(targetStatus)) {
      const phase = OTP_PHASE_MAP[targetStatus] ?? "pickup";
      setPendingTarget(targetStatus);
      setOtpModal({ targetStatus, phase });
      return;
    }
    transitionMutation.mutate({ targetStatus });
  };

  const handleOtpSubmit = () => {
    if (!otpModal || !otpValue.trim()) return;
    verifyOtpMutation.mutate({ phase: otpModal.phase, otp: otpValue.trim() });
  };

  const DANGER_TARGETS = new Set(["BREAKDOWN", "NO_SHOW", "CANCELLED"]);
  // The first listed target is always the normal forward step in the lifecycle (see
  // ALLOWED_TRANSITIONS — it's listed first for every status); everything after it is an
  // exception path. Highlighting it lets ops spot the expected next click at a glance instead
  // of scanning an unranked row of buttons.
  // Non-null: the length===0 return above guarantees at least one target here.
  const [primaryTarget, ...restTargets] = availableTargets as [string, ...string[]];

  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide mb-1">Update status</p>
      <div className="flex flex-wrap gap-1.5">
        <Button
          key={primaryTarget}
          size="sm"
          variant="primary"
          onClick={() => handleTransition(primaryTarget)}
          disabled={transitionMutation.isPending}
        >
          {TRANSITION_LABELS[primaryTarget] ?? primaryTarget}
        </Button>
        {restTargets.map((target) => (
          <Button
            key={target}
            size="sm"
            variant={DANGER_TARGETS.has(target) ? "ghost" : "secondary"}
            className={DANGER_TARGETS.has(target) ? "text-danger hover:bg-danger/10" : ""}
            onClick={() => handleTransition(target)}
            disabled={transitionMutation.isPending}
          >
            {TRANSITION_LABELS[target] ?? target}
          </Button>
        ))}
      </div>

      {otpModal && (
        <Modal
          open={true}
          onClose={() => { setOtpModal(null); setOtpValue(""); setPendingTarget(null); }}
          title={`OTP Verification — ${otpModal.phase === "pickup" ? "Pickup" : "Drop"}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter the OTP provided by the passenger to confirm {otpModal.phase}.
            </p>
            <Input
              value={otpValue}
              onChange={(e) => setOtpValue(e.target.value)}
              placeholder="Enter OTP"
              maxLength={8}
              className="text-center text-xl tracking-widest font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handleOtpSubmit(); }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleOtpSubmit}
                disabled={!otpValue.trim() || verifyOtpMutation.isPending}
              >
                {verifyOtpMutation.isPending ? "Verifying…" : "Verify OTP"}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setOtpModal(null); setOtpValue(""); setPendingTarget(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

StateTransitionManager.displayName = "StateTransitionManager";
