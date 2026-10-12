/**
 * One colour vocabulary for the console, so a status or a fleet state means the same thing on
 * every page: green = healthy/done, blue = in motion, navy = booked/neutral, amber = needs a
 * nudge, red = problem, purple = billed, grey = idle/unknown.
 */
export type Tone = "green" | "blue" | "navy" | "amber" | "red" | "purple" | "grey";

export const TONE: Record<Tone, { soft: string; solid: string; dot: string; row: string; text: string }> = {
  green: { soft: "bg-success-soft text-[#17623A] ring-success/25", solid: "bg-success text-white", dot: "bg-success", row: "", text: "text-success" },
  blue: { soft: "bg-[#E4EDFB] text-[#1D4F9A] ring-[#2F6FC0]/25", solid: "bg-[#2F6FC0] text-white", dot: "bg-[#2F6FC0]", row: "", text: "text-[#1D4F9A]" },
  navy: { soft: "bg-navy-soft text-brand-blue ring-brand-blue/20", solid: "bg-brand-blue text-white", dot: "bg-brand-blue", row: "", text: "text-brand-blue" },
  amber: { soft: "bg-amber-soft text-[#8A5A14] ring-alert-amber/35", solid: "bg-alert-amber text-white", dot: "bg-alert-amber", row: "bg-amber-soft/40", text: "text-[#8A5A14]" },
  red: { soft: "bg-danger-soft text-[#A3341F] ring-danger/25", solid: "bg-danger text-white", dot: "bg-danger", row: "bg-danger-soft/40", text: "text-danger" },
  purple: { soft: "bg-[#F0EAF8] text-[#5B2E91] ring-[#7C4DBA]/25", solid: "bg-[#7C4DBA] text-white", dot: "bg-[#7C4DBA]", row: "", text: "text-[#5B2E91]" },
  grey: { soft: "bg-ops-card2 text-text-secondary ring-border", solid: "bg-text-secondary text-white", dot: "bg-text-tertiary", row: "", text: "text-text-secondary" },
};

export const TRIP_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "grey",
  CONFIRMED: "navy",
  ASSIGNED: "blue",
  IN_PROGRESS: "green",
  COMPLETED: "green",
  BILLED: "purple",
  CANCELLED: "red",
};

export const toneOf = (status: string): Tone => TRIP_STATUS_TONE[status] ?? "grey";

/** Fleet mix segments, in the order they are drawn. */
export const VEHICLE_MIX: { key: string; label: string; tone: Tone }[] = [
  { key: "vehicles_active", label: "Active", tone: "green" },
  { key: "vehicles_on_trip", label: "On trip", tone: "blue" },
  { key: "vehicles_breakdown", label: "Breakdown", tone: "red" },
  { key: "vehicles_unavailable", label: "Unavailable", tone: "grey" },
  { key: "vehicles_no_location", label: "No location", tone: "amber" },
];

export const DRIVER_MIX: { key: string; label: string; tone: Tone }[] = [
  { key: "drivers_available", label: "Available", tone: "green" },
  { key: "drivers_on_trip", label: "On trip", tone: "blue" },
  { key: "drivers_offline", label: "Offline", tone: "grey" },
];
