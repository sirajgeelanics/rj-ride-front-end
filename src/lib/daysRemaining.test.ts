import { describe, expect, it } from "vitest";
import { daysRemaining } from "./daysRemaining";

const at = (s: string) => new Date(s);

describe("daysRemaining", () => {
  it("counts whole calendar days, inclusive of the last valid day", () => {
    expect(daysRemaining("2026-11-13", at("2026-11-13T23:59:00"))).toBe(0);
    expect(daysRemaining("2026-11-14", at("2026-11-13T00:01:00"))).toBe(1);
    expect(daysRemaining("2026-11-23", at("2026-11-13T12:00:00"))).toBe(10);
  });
  it("is negative once the expiry date has passed", () => {
    expect(daysRemaining("2026-11-12", at("2026-11-13T00:00:00"))).toBe(-1);
  });
  it("crosses month and year ends correctly", () => {
    expect(daysRemaining("2026-12-01", at("2026-11-30T10:00:00"))).toBe(1);
    expect(daysRemaining("2027-01-01", at("2026-12-31T23:30:00"))).toBe(1);
  });
  it("returns null when there is no expiry", () => {
    expect(daysRemaining(null, at("2026-11-13T00:00:00"))).toBeNull();
    expect(daysRemaining(undefined, at("2026-11-13T00:00:00"))).toBeNull();
  });
});
