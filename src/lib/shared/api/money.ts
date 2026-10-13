const EXPONENT_MAP: Record<string, number> = {
  INR: 2,
  AED: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

function getExponent(currency: string): number {
  return EXPONENT_MAP[currency.toUpperCase()] ?? 2;
}

export function formatMoney(
  minor: number,
  currency: string,
  locale?: string
): string {
  const exponent = getExponent(currency);
  const major = minor / Math.pow(10, exponent);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(major);
}

export function toMinor(
  display: string | number,
  currency: string
): number {
  const exponent = getExponent(currency);
  const factor = Math.pow(10, exponent);
  if (typeof display === "number") {
    return Math.round(display * factor);
  }
  const cleaned = display.replace(/[^\d.-]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    throw new RangeError(`toMinor: cannot parse "${display}" as a number`);
  }
  return Math.round(parsed * factor);
}
