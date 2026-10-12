import React from "react";
import { Badge } from "@/components/ui/Badge";
import { titleCase } from "@/lib/format";

type Variant = "default" | "blue" | "green" | "amber" | "red" | "purple" | "teal";

const VARIANTS: Record<string, Variant> = {
  DRAFT: "default",
  CONFIRMED: "blue",
  PENDING: "amber",
  VENDOR_OFFERED: "amber",
  ASSIGNED: "blue",
  DRIVER_ACCEPTED: "blue",
  EN_ROUTE_PICKUP: "teal",
  AT_PICKUP: "teal",
  PAX_PICKED: "green",
  IN_TRANSIT: "green",
  AT_DROP: "green",
  PAX_DROPPED: "green",
  IN_PROGRESS: "green",
  COMPLETED: "green",
  BILLED: "purple",
  CANCELLED: "red",
  NO_SHOW: "red",
  BREAKDOWN: "red",
  ACCIDENT: "red",
  SOS: "red",
  DELAYED: "amber",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? "default"}>{titleCase(status)}</Badge>;
}
