"use client";

import React from "react";
import { useLanguageStore, t } from "@/lib/shared";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  ASSIGNED: "bg-blue-100 text-blue-700",
  DRIVER_ACCEPTED: "bg-purple-100 text-purple-700",
  EN_ROUTE_PICKUP: "bg-amber-100 text-amber-700",
  AT_PICKUP: "bg-amber-200 text-amber-800",
  PAX_PICKED: "bg-emerald-100 text-emerald-700",
  IN_TRANSIT: "bg-green-100 text-green-700",
  AT_DROP: "bg-teal-100 text-teal-700",
  PAX_DROPPED: "bg-emerald-200 text-emerald-800",
  COMPLETED: "bg-emerald-600 text-white",
  BILLED: "bg-blue-600 text-white",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
  BREAKDOWN: "bg-red-200 text-red-800",
  ACCIDENT: "bg-red-300 text-red-900",
  SOS: "bg-red-500 text-white",
  DELAYED: "bg-yellow-100 text-yellow-700",
  VEHICLE_SWAP: "bg-purple-200 text-purple-800",
  DRIVER_REJECTED: "bg-red-100 text-red-600",
  DRAFT: "bg-gray-100 text-gray-500",
  CONFIRMED: "bg-blue-100 text-blue-600",
  IN_PROGRESS: "bg-green-100 text-green-600",
  AVAILABLE: "bg-green-100 text-green-700",
  ON_TRIP: "bg-amber-100 text-amber-700",
  OFFLINE: "bg-gray-100 text-gray-500",
  IDLE: "bg-gray-100 text-gray-600",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  UNBILLED: "bg-yellow-100 text-yellow-700",
  STATEMENTED: "bg-blue-100 text-blue-700",
  RECONCILED: "bg-emerald-100 text-emerald-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

// Maps status values to translation keys
const STATUS_KEYS: Record<string, string> = {
  PENDING: "statusPending",
  ASSIGNED: "statusAssigned",
  DRIVER_ACCEPTED: "statusDriverAccepted",
  DRIVER_REJECTED: "statusDriverRejected",
  EN_ROUTE_PICKUP: "statusEnRoutePickup",
  AT_PICKUP: "statusAtPickup",
  PAX_PICKED: "statusPaxPicked",
  IN_TRANSIT: "statusInTransit",
  AT_DROP: "statusAtDrop",
  PAX_DROPPED: "statusPaxDropped",
  COMPLETED: "statusCompleted",
  NO_SHOW: "statusNoShow",
  BREAKDOWN: "statusBreakdown",
  ACCIDENT: "statusAccident",
  VEHICLE_SWAP: "statusVehicleSwap",
  DELAYED: "statusDelayed",
  SOS: "statusSOS",
  CANCELLED: "statusCancelled",
  DRAFT: "statusDraft",
  CONFIRMED: "statusConfirmed",
  IN_PROGRESS: "inProgress",
  BILLED: "statusBilled",
  AVAILABLE: "statusAvailable",
  ON_TRIP: "statusOnTrip",
  OFFLINE: "statusOffline",
  UNBILLED: "statusUnbilled",
  STATEMENTED: "statusStatemented",
  RECONCILED: "statusReconciled",
  PAID: "statusPaid",
};

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "sm" }) => {
  const language = useLanguageStore((s) => s.language);
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600";
  const key = STATUS_KEYS[status];
  const label = key ? t(key as Parameters<typeof t>[0], language) : status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const px = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  return (
    <span className={`inline-block ${px} rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
};
