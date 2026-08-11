/**
 * A v4 UUID that works outside a secure context.
 *
 * `crypto.randomUUID` is only defined in a *secure context* — HTTPS, or plain HTTP on
 * `localhost`. The moment the app is served over plain HTTP on anything else (a LAN IP such as
 * http://192.168.1.39:3000, or a hostname like http://ride.192.168.1.39.nip.io:3000) the browser
 * stops exposing it and calling it throws `crypto.randomUUID is not a function`.
 *
 * `crypto.getRandomValues` has no such restriction, so fall back to assembling an RFC-4122 v4
 * UUID by hand. Always use this instead of calling `crypto.randomUUID()` directly.
 */
export function uuidv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}
