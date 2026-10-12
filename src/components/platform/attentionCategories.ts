import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Hourglass,
  Radio,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import type { AttentionCategory } from "@/lib/api";

export const CATEGORIES: {
  key: AttentionCategory;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { key: "safety_alerts", label: "Safety alerts", hint: "Open or acknowledged SOS, deviation, overspeed and similar", icon: AlertTriangle },
  { key: "stuck_assigned", label: "Stuck on assigned", hint: "Allotted but the driver never accepted", icon: Hourglass },
  { key: "stale_pending", label: "Waiting for a vendor", hint: "Pending slots nobody has allotted", icon: Clock3 },
  { key: "ritmo_push_issues", label: "RITMO not updated", hint: "Accepted trips whose status never reached RITMO", icon: Radio },
  { key: "expired_offers", label: "Expired offers", hint: "Vendor offers that timed out in the last 24 hours", icon: TimerOff },
  { key: "pending_changes", label: "Pending time changes", hint: "RITMO pickup changes waiting for ops", icon: CalendarClock },
];

