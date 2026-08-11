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

const VEHICLE_STATUS = [
  "PENDING", "ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_REJECTED",
  "EN_ROUTE_PICKUP", "AT_PICKUP", "PAX_PICKED", "IN_TRANSIT",
  "AT_DROP", "PAX_DROPPED", "COMPLETED",
  "NO_SHOW", "BREAKDOWN", "ACCIDENT", "VEHICLE_SWAP", "DELAYED", "SOS", "CANCELLED",
] as const;

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

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "ACCIDENT"]);

function getAvailableTargets(currentStatus: string): string[] {
  const allTargets = Object.keys(TRANSITION_LABELS);
  return allTargets.filter(
    (t) => t !== currentStatus && !TERMINAL_STATUSES.has(currentStatus)
  );
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

  if (TERMINAL_STATUSES.has(currentStatus)) {
    return null;
  }

  const availableTargets = getAvailableTargets(currentStatus);

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

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {availableTargets.map((target) => (
        <Button
          key={target}
          size="sm"
          variant={["BREAKDOWN", "NO_SHOW", "ACCIDENT", "CANCELLED"].includes(target) ? "ghost" : "secondary"}
          className={["BREAKDOWN", "NO_SHOW", "ACCIDENT", "CANCELLED"].includes(target) ? "text-danger border-danger/30 text-xs" : "text-xs"}
          onClick={() => handleTransition(target)}
          disabled={transitionMutation.isPending}
        >
          {TRANSITION_LABELS[target] ?? target}
        </Button>
      ))}

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
