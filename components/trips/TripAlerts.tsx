"use client";

import React, { useState } from "react";
import { TripVehicle, VehicleStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, AlertTriangle, CheckCircle, X } from "lucide-react";

interface Alert {
  vehicleIndex: number;
  type: "exception" | "warning" | "info";
  message: string;
}

interface TripAlertsProps {
  vehicles: TripVehicle[];
  onDismiss?: (vehicleIndex: number) => void;
}

const EXCEPTION_STATUSES: VehicleStatus[] = ["NO_SHOW", "BREAKDOWN", "ACCIDENT", "VEHICLE_SWAP", "DELAYED", "SOS", "CANCELLED"];

export const TripAlerts: React.FC<TripAlertsProps> = ({ vehicles, onDismiss }) => {
  const [dismissedVehicles, setDismissedVehicles] = useState<Set<number>>(new Set());

  const alerts: Alert[] = [];

  vehicles.forEach((vehicle, idx) => {
    if (dismissedVehicles.has(idx)) return;

    if (EXCEPTION_STATUSES.includes(vehicle.status as VehicleStatus)) {
      const statusLabels: Record<VehicleStatus, string> = {
        NO_SHOW: "Driver no-show — reassign or mark as no-show",
        BREAKDOWN: "Vehicle breakdown — arrange replacement",
        ACCIDENT: "Accident reported — investigate and resolve",
        VEHICLE_SWAP: "Vehicle swapped — update tracking",
        DELAYED: "Trip delayed — notify passengers",
        SOS: "SOS triggered — immediate assistance needed",
        CANCELLED: "Vehicle cancelled — reassign to another",
        PENDING: "",
        ASSIGNED: "",
        DRIVER_ACCEPTED: "",
        DRIVER_REJECTED: "",
        EN_ROUTE_PICKUP: "",
        AT_PICKUP: "",
        PAX_PICKED: "",
        IN_TRANSIT: "",
        AT_DROP: "",
        PAX_DROPPED: "",
        COMPLETED: "",
      };

      alerts.push({
        vehicleIndex: idx,
        type: vehicle.status === "SOS" ? "exception" : "warning",
        message: statusLabels[vehicle.status as VehicleStatus] || `Status: ${vehicle.status}`,
      });
    }

    // Check for unpriced vehicles
    if (!vehicle.lockedPrice && vehicle.status !== "CANCELLED") {
      alerts.push({
        vehicleIndex: idx,
        type: "warning",
        message: "No locked price — cannot confirm",
      });
    }

    // Check for unassigned vehicles
    if (!vehicle.vehicleId && vehicle.status !== "PENDING" && vehicle.status !== "CANCELLED") {
      alerts.push({
        vehicleIndex: idx,
        type: "info",
        message: "Vehicle not assigned to fleet",
      });
    }

    if (!vehicle.driverId && vehicle.status !== "PENDING" && vehicle.status !== "CANCELLED") {
      alerts.push({
        vehicleIndex: idx,
        type: "info",
        message: "Driver not assigned",
      });
    }
  });

  if (alerts.length === 0) {
    return null;
  }

  const handleDismiss = (vehicleIndex: number) => {
    const newDismissed = new Set(dismissedVehicles);
    newDismissed.add(vehicleIndex);
    setDismissedVehicles(newDismissed);
    onDismiss?.(vehicleIndex);
  };

  return (
    <Card padding="lg" header={<h3 className="font-semibold flex items-center gap-2">⚠️ Alerts ({alerts.length})</h3>}>
      <div className="space-y-2">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`flex items-start justify-between p-3 rounded border ${
              alert.type === "exception"
                ? "bg-red-900/20 border-red-700/40"
                : alert.type === "warning"
                ? "bg-orange-900/20 border-orange-700/40"
                : "bg-blue-900/20 border-blue-700/40"
            }`}
          >
            <div className="flex items-start gap-2">
              {alert.type === "exception" ? (
                <AlertCircle className="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
              ) : alert.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
              )}
              <div>
                <p className="text-xs font-medium">Vehicle {alert.vehicleIndex + 1}</p>
                <p className="text-xs mt-1 text-text-primary">{alert.message}</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleDismiss(alert.vehicleIndex)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};

TripAlerts.displayName = "TripAlerts";
