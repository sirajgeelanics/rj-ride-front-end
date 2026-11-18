/** The local calendar date (YYYY-MM-DD) of an instant. Not the UTC date, which is a day behind
 * for several hours a day in India. */
export function localDayString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days from today until `validTo` (a YYYY-MM-DD date, inclusive: the card still applies on
 * that day, same as the server's status_on). 0 = last valid day, negative = already expired,
 * null = no expiry date. Both dates are read as calendar days in UTC so daylight-saving or
 * timezone offsets can never shift the count by one.
 */
export function daysRemaining(validTo: string | null | undefined, now: Date): number | null {
  if (!validTo) return null;
  const end = Date.parse(`${validTo.slice(0, 10)}T00:00:00Z`);
  const start = Date.parse(`${localDayString(now)}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(start)) return null;
  return Math.round((end - start) / MS_PER_DAY);
}
