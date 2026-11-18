import { describe, it, expect } from "vitest";
import { formatMoney, toMinor } from "../money";

describe("formatMoney", () => {
  it("formats INR minor units correctly", () => {
    const result = formatMoney(150000, "INR", "en-IN");
    expect(result).toMatch(/1,500/);
  });

  it("formats INR in lakh range with en-IN locale", () => {
    const result = formatMoney(10000000, "INR", "en-IN");
    expect(result).toMatch(/1,00,000/);
  });

  it("formats AED minor units", () => {
    const result = formatMoney(5000, "AED", "en-AE");
    expect(result).toMatch(/50/);
    expect(result).toMatch(/AED|د\.إ/);
  });

  it("formats USD minor units", () => {
    const result = formatMoney(9999, "USD", "en-US");
    expect(result).toMatch(/99\.99/);
  });

  it("formats JPY with zero exponent (no decimal)", () => {
    const result = formatMoney(1000, "JPY", "ja-JP");
    expect(result).toMatch(/1,000|1000/);
    expect(result).not.toMatch(/\.\d/);
  });

  it("formats zero correctly", () => {
    const result = formatMoney(0, "INR", "en-IN");
    expect(result).toMatch(/0/);
  });
});

describe("toMinor", () => {
  it("converts numeric display to minor units for INR", () => {
    expect(toMinor(1500, "INR")).toBe(150000);
  });

  it("converts string with currency symbol to minor units", () => {
    expect(toMinor("₹1,500.00", "INR")).toBe(150000);
  });

  it("converts AED correctly", () => {
    expect(toMinor(50, "AED")).toBe(5000);
  });

  it("handles whole-number inputs exactly", () => {
    expect(toMinor(100, "USD")).toBe(10000);
  });

  it("converts JPY with zero exponent", () => {
    expect(toMinor(1000, "JPY")).toBe(1000);
  });

  it("throws on unparseable string", () => {
    expect(() => toMinor("not-a-number", "INR")).toThrow(RangeError);
  });

  it("round-trips: toMinor → formatMoney produces original major units", () => {
    const major = 1234.56;
    const minor = toMinor(major, "USD");
    const formatted = formatMoney(minor, "USD", "en-US");
    expect(formatted).toContain("1,234.56");
  });

  it("converts string decimal to minor units", () => {
    expect(toMinor("12.50", "USD")).toBe(1250);
  });
});
