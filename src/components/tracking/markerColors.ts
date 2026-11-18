// apps.tracking.api.markers.marker_color returns CSS colour NAMES ("blue", "green", "amber",
// "red", "grey"), not hex — code that did `` `#${color}` `` (treating it like a hex code)
// produced invalid CSS ("#blue"), which the browser silently drops, leaving the element with no
// background at all (blank/white, regardless of status). Real hex codes here, keyed by those
// same names — "amber" isn't even a standard CSS colour name, so that status was doubly broken.
// Shared between the map markers and the list's status dot so both stay in sync.
export const MARKER_HEX: Record<string, string> = {
  blue: "#2563eb",
  green: "#16a34a",
  amber: "#f59e0b",
  red: "#dc2626",
  grey: "#6b7280",
};

const FALLBACK_HEX = "#2563eb"; // same blue as MARKER_HEX.blue — literal, so it's never `undefined`

export function markerHex(color: string | undefined | null): string {
  if (!color) return FALLBACK_HEX;
  return MARKER_HEX[color] ?? FALLBACK_HEX;
}
