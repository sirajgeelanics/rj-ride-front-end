import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { countdownFrom } from "../countdown";

// Anchor "now" so deadlines are deterministic. countdownFrom reads Date.now(), so faking the
// system clock (and advancing it) simulates the 1s ticks the hook performs.
const BASE = new Date("2026-07-21T10:00:00.000Z").getTime();
const at = (secondsFromBase: number) => new Date(BASE + secondsFromBase * 1000).toISOString();

describe("countdownFrom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats remaining time as MM:SS", () => {
    expect(countdownFrom(at(90)).mmss).toBe("01:30");
    expect(countdownFrom(at(5)).mmss).toBe("00:05");
    expect(countdownFrom(at(600)).mmss).toBe("10:00");
  });

  it("is not urgent when 60s or more remain", () => {
    const c = countdownFrom(at(60));
    expect(c.urgent).toBe(false);
    expect(c.expired).toBe(false);
    expect(c.remainingMs).toBe(60_000);
  });

  it("is urgent under 60s (but not expired)", () => {
    const c = countdownFrom(at(59));
    expect(c.urgent).toBe(true);
    expect(c.expired).toBe(false);
    expect(c.mmss).toBe("00:59");
  });

  it("advancing the clock ticks it down and flips urgent", () => {
    const deadline = at(90);
    expect(countdownFrom(deadline).urgent).toBe(false);
    vi.setSystemTime(BASE + 31_000); // 59s left
    const c = countdownFrom(deadline);
    expect(c.mmss).toBe("00:59");
    expect(c.urgent).toBe(true);
  });

  it("clamps to expired 00:00 once the deadline passes", () => {
    const deadline = at(10);
    vi.setSystemTime(BASE + 15_000); // 5s past
    const c = countdownFrom(deadline);
    expect(c.expired).toBe(true);
    expect(c.mmss).toBe("00:00");
    expect(c.remainingMs).toBe(0);
    expect(c.urgent).toBe(false);
  });

  it("treats a missing or invalid deadline as expired", () => {
    for (const bad of [null, undefined, "", "not-a-date"]) {
      const c = countdownFrom(bad as string | null | undefined);
      expect(c.expired).toBe(true);
      expect(c.mmss).toBe("00:00");
      expect(c.urgent).toBe(false);
    }
  });

  it("derives from the server deadline, not elapsed-since-mount", () => {
    // Two reads 40s apart against the same deadline differ by exactly 40s — proving the value
    // is anchored to the absolute deadline rather than a timer started at first render.
    const deadline = at(120);
    expect(countdownFrom(deadline).mmss).toBe("02:00");
    vi.setSystemTime(BASE + 40_000);
    expect(countdownFrom(deadline).mmss).toBe("01:20");
  });
});
