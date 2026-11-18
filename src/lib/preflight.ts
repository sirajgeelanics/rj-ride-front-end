import { Offer, TripRequest, TripVehicle } from "@/lib/types";

export interface CheckTimeResult {
  allowBooking: boolean;
  reasons: string[];
  warning?: string;
}

export interface CheckCancelResult {
  allowed: boolean;
  free: boolean;
  penaltyPct: number;
  resultingStatus: "CANCELLED_FREE" | "CANCELLED_PENALTY";
  reason: string;
  penaltyAmount?: number;
}

export interface CheckUpdateResult {
  allowed: boolean;
  message: string;
  blockedReason?: string;
}

// Check if booking is allowed for a trip at the given time
export function checkTime(offer: Offer, pickupTime: string): CheckTimeResult {
  const now = new Date();
  const pickup = new Date(pickupTime);
  const hoursUntilPickup = (pickup.getTime() - now.getTime()) / (1000 * 60 * 60);

  const reasons: string[] = [];
  let allowBooking = true;

  // Check minimum lead time
  if (hoursUntilPickup < offer.minLeadTimeHours) {
    reasons.push(
      `Pickup time is too soon. Minimum lead time: ${offer.minLeadTimeHours} hours (${(hoursUntilPickup).toFixed(1)} hours from now)`
    );
    allowBooking = false;
  }

  // Check if pickup time has passed
  if (pickup < now) {
    reasons.push("Pickup time is in the past");
    allowBooking = false;
  }

  // Check if offer is expired
  const expiresAt = new Date(offer.expiresAt);
  if (expiresAt < now) {
    reasons.push("Price quote has expired");
    allowBooking = false;
  }

  return {
    allowBooking,
    reasons: reasons.length > 0 ? reasons : ["Booking allowed"],
    warning: !allowBooking ? "Check failures prevent booking" : undefined,
  };
}

// Check if cancellation is allowed and compute penalty
export function checkCancel(offer: Offer, pickupTime: string, lockedPrice: number): CheckCancelResult {
  const now = new Date();
  const pickup = new Date(pickupTime);

  // Deadline = pickupTime - freeCancellationHours
  const deadlineMs = pickup.getTime() - offer.freeCancellationHours * 60 * 60 * 1000;
  const deadline = new Date(deadlineMs);

  const isBefore = now < deadline;

  if (isBefore) {
    return {
      allowed: true,
      free: true,
      penaltyPct: 0,
      resultingStatus: "CANCELLED_FREE",
      reason: `Free cancellation allowed until ${deadline.toLocaleTimeString()}`,
      penaltyAmount: 0,
    };
  } else {
    // Past deadline: apply penalty
    const defaultPenaltyPct = 20; // Default 20% penalty if past free cancellation window
    const penaltyAmount = (lockedPrice * defaultPenaltyPct) / 100;

    return {
      allowed: true,
      free: false,
      penaltyPct: defaultPenaltyPct,
      resultingStatus: "CANCELLED_PENALTY",
      reason: `Cancellation after free window (deadline: ${deadline.toLocaleTimeString()}). Penalty: ${defaultPenaltyPct}% of fare ($${penaltyAmount.toFixed(0)})`,
      penaltyAmount,
    };
  }
}

// Check if trip can be updated
export function checkUpdate(trip: TripRequest): CheckUpdateResult {
  const activeStatuses = ["IN_PROGRESS", "COMPLETED", "BILLED"];
  const cancelledStatuses = ["CANCELLED"];

  // Cannot update if trip is in progress, completed, or billed
  if (activeStatuses.includes(trip.status)) {
    return {
      allowed: false,
      message: `Trip cannot be updated when status is ${trip.status}`,
      blockedReason: `Status is ${trip.status} (trip in active delivery or finalized)`,
    };
  }

  // Cannot update if trip is cancelled
  if (cancelledStatuses.includes(trip.status)) {
    return {
      allowed: false,
      message: `Trip cannot be updated when cancelled`,
      blockedReason: "Trip is cancelled",
    };
  }

  // Can update if DRAFT or CONFIRMED or ASSIGNED
  if (["DRAFT", "CONFIRMED", "ASSIGNED"].includes(trip.status)) {
    return {
      allowed: true,
      message: `Trip can be updated (status: ${trip.status})`,
    };
  }

  return {
    allowed: false,
    message: "Cannot update trip",
    blockedReason: `Unknown status: ${trip.status}`,
  };
}

// Convenience function to check if action is allowed before attempting it
export function checkActionAllowed(action: "CANCEL" | "UPDATE", offer?: Offer, pickupTime?: string, lockedPrice?: number, trip?: TripRequest): {
  allowed: boolean;
  message: string;
  details?: CheckCancelResult | CheckUpdateResult | CheckTimeResult;
} {
  switch (action) {
    case "CANCEL":
      if (!offer || !pickupTime || !lockedPrice) {
        return {
          allowed: false,
          message: "Missing required parameters for cancellation check",
        };
      }
      const cancelResult = checkCancel(offer, pickupTime, lockedPrice);
      return {
        allowed: cancelResult.allowed,
        message: cancelResult.reason,
        details: cancelResult,
      };

    case "UPDATE":
      if (!trip) {
        return {
          allowed: false,
          message: "Missing required parameters for update check",
        };
      }
      const updateResult = checkUpdate(trip);
      return {
        allowed: updateResult.allowed,
        message: updateResult.message,
        details: updateResult,
      };

    default:
      return {
        allowed: false,
        message: "Unknown action",
      };
  }
}
