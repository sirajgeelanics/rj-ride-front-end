import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface MockWsInstance {
  url: string;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close: (code?: number, reason?: string) => void;
  _trigger: (event: "open" | "message" | "error" | "close", data?: string) => void;
}

let mockWsInstances: MockWsInstance[] = [];
let mockTicketCallCount = 0;
let mockTicketShouldFail = false;

vi.mock("../../api/client", () => ({
  apiClient: {
    POST: vi.fn(async (_path: string) => {
      mockTicketCallCount++;
      if (mockTicketShouldFail) {
        return { data: null, error: new Error("ticket fail") };
      }
      return {
        data: { result: { ticket: `ticket-${mockTicketCallCount}`, expiresAt: new Date().toISOString() } },
        error: null,
      };
    }),
  },
  ApiError: class ApiError extends Error {},
  isApiError: () => false,
}));

class MockWebSocket implements MockWsInstance {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  close(_code?: number, _reason?: string) {
    this.onclose?.();
  }

  _trigger(event: "open" | "message" | "error" | "close", data?: string) {
    if (event === "open") this.onopen?.();
    if (event === "message" && data !== undefined) this.onmessage?.({ data });
    if (event === "error") this.onerror?.();
    if (event === "close") this.onclose?.();
  }
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe("connectEvents WebSocket", () => {
  beforeEach(() => {
    mockWsInstances = [];
    mockTicketCallCount = 0;
    mockTicketShouldFail = false;
    vi.useFakeTimers();
    (global as unknown as Record<string, unknown>)["WebSocket"] = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("fetches a ticket and opens a WS connection with it in the URL", async () => {
    const { connectEvents } = await import("../ws");
    const handle = connectEvents({ onEvent: vi.fn(), wsOrigin: "ws://test-host" });

    await flushMicrotasks();

    expect(mockWsInstances.length).toBeGreaterThanOrEqual(1);
    expect(mockWsInstances[0]!.url).toContain("ticket=ticket-1");
    expect(mockWsInstances[0]!.url).toContain("ws://test-host");
    handle.close();
  });

  it("delivers parsed events via onEvent callback", async () => {
    const receivedEvents: unknown[] = [];
    const { connectEvents } = await import("../ws");
    const handle = connectEvents({
      onEvent: (e) => receivedEvents.push(e),
      wsOrigin: "ws://test-host",
    });

    await flushMicrotasks();

    const ws = mockWsInstances[0]!;
    ws._trigger("open");
    ws._trigger("message", JSON.stringify({ type: "trip.updated", tripId: "T1", payload: {} }));

    expect(receivedEvents).toHaveLength(1);
    expect((receivedEvents[0] as { type: string }).type).toBe("trip.updated");
    handle.close();
  });

  it("reconnects with a fresh ticket after connection closes", async () => {
    const { connectEvents } = await import("../ws");
    const handle = connectEvents({ onEvent: vi.fn(), wsOrigin: "ws://test-host" });

    await flushMicrotasks();
    expect(mockWsInstances.length).toBe(1);

    mockWsInstances[0]!._trigger("close");

    vi.advanceTimersByTime(1001);
    await flushMicrotasks();

    expect(mockWsInstances.length).toBe(2);
    expect(mockWsInstances[1]!.url).toContain("ticket=ticket-2");
    handle.close();
  });

  it("does not reconnect after explicit close()", async () => {
    const { connectEvents } = await import("../ws");
    const handle = connectEvents({ onEvent: vi.fn(), wsOrigin: "ws://test-host" });

    await flushMicrotasks();
    handle.close();

    const countAfterClose = mockWsInstances.length;

    vi.advanceTimersByTime(60_000);
    await flushMicrotasks();

    expect(mockWsInstances.length).toBe(countAfterClose);
  });

  it("skips WS creation on ticket fetch failure and retries later", async () => {
    mockTicketShouldFail = true;

    const { connectEvents } = await import("../ws");
    const handle = connectEvents({ onEvent: vi.fn(), wsOrigin: "ws://test-host" });

    await flushMicrotasks();

    expect(mockWsInstances.length).toBe(0);

    mockTicketShouldFail = false;
    vi.advanceTimersByTime(1001);
    await flushMicrotasks();

    expect(mockWsInstances.length).toBeGreaterThanOrEqual(1);
    handle.close();
  });

  it("uses exponential backoff (second reconnect delay > first)", async () => {
    const { connectEvents } = await import("../ws");
    const handle = connectEvents({ onEvent: vi.fn(), wsOrigin: "ws://test-host" });

    await flushMicrotasks();
    mockWsInstances[0]!._trigger("close");

    vi.advanceTimersByTime(1001);
    await flushMicrotasks();
    expect(mockWsInstances.length).toBe(2);

    mockWsInstances[1]!._trigger("close");

    vi.advanceTimersByTime(1500);
    await flushMicrotasks();
    const countAfterShortWait = mockWsInstances.length;

    vi.advanceTimersByTime(600);
    await flushMicrotasks();
    expect(mockWsInstances.length).toBeGreaterThan(countAfterShortWait);

    handle.close();
  });
});
