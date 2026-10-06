/** A vendor's `airport_code` is a comma-separated list ("BLR,HBX") — one entry per airport it serves. */
export function splitAirportCodes(value: string | null | undefined): string[] {
  const seen = new Set<string>();
  for (const part of (value ?? "").split(",")) {
    const code = part.trim().toUpperCase();
    if (code) seen.add(code);
  }
  return [...seen];
}

/** Whole-entry, case-insensitive: "BL" does not match a vendor listing "BLR,HBX". */
export function vendorServesAirport(vendorCodes: string | null | undefined, airport: string): boolean {
  const wanted = airport.trim().toUpperCase();
  return wanted !== "" && splitAirportCodes(vendorCodes).includes(wanted);
}
