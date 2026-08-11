"use client";

import React from "react";
import { useLanguageStore, t } from "@/lib/shared";
import { TripStatus, VehicleStatus } from "@/lib/types";
import { Badge } from "./Badge";

type Status = TripStatus | VehicleStatus;

const statusColorMap: Record<Status, "default" | "blue" | "green" | "amber" | "red" | "purple" | "teal"> = {
  DRAFT: "default",
  CONFIRMED: "blue",
  ASSIGNED: "purple",
  IN_PROGRESS: "amber",
  COMPLETED: "green",
  BILLED: "teal",
  CANCELLED: "red",
  PENDING: "default",
  DRIVER_ACCEPTED: "blue",
  DRIVER_REJECTED: "red",
  EN_ROUTE_PICKUP: "amber",
  AT_PICKUP: "amber",
  PAX_PICKED: "amber",
  IN_TRANSIT: "amber",
  AT_DROP: "teal",
  PAX_DROPPED: "green",
  NO_SHOW: "red",
  BREAKDOWN: "red",
  ACCIDENT: "red",
  VEHICLE_SWAP: "purple",
  DELAYED: "amber",
  SOS: "red",
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
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const language = useLanguageStore((s) => s.language);
  const variant = statusColorMap[status] || "default";
  const key = STATUS_KEYS[status];
  const label = key ? t(key as any, language) : status;
  return (
    <Badge variant={variant} className={status === "SOS" ? "animate-pulse font-bold" : className}>
      {label}
    </Badge>
  );
};

StatusBadge.displayName = "StatusBadge";
