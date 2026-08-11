import { describe, expect, it } from "vitest";
import { normalizeFrame } from "../ws";

/**
 * The server frame is exactly what apps/dispatch/consumers.py sends:
 *   {"event_type": ..., "payload": {...}}
 * It has no top-level `type`, which is what `RideEvent` is discriminated on. Before
 * normalizeFrame the raw frame was cast straight to RideEvent, so `event.type` was undefined,
 * every invalidationMap lookup missed, and the WS layer did nothing at all.
 */
const offerAlertedFrame = {
  event_type: "trip.offer_alerted",
  payload: {
    offer_id: "019f8339-2b5c-7f91-8d28-41a9051e39cc",
    trip_id: "019f888d-f599-7b73-8576-5babba6d4c6a",
    trip_vehicle_id: "019f888d-aaaa-7b73-8576-5babba6d4c6a",
    vendor_id: "019f8339-2b5c-7f91-8d28-41a9051e39cc",
    reference: "T-1",
    round: 1,
    priority: "high",
  },
};

describe("normalizeFrame", () => {
  it("exposes the server's event_type as `type` so invalidationMap lookups hit", () => {
    const event = normalizeFrame(offerAlertedFrame);
    expect(event?.type).toBe("trip.offer_alerted");
  });

  it("keeps the payload intact for handlers that read it", () => {
    // RideEvent is a union and not every member declares `payload`, so narrow to read it.
    const event = normalizeFrame(offerAlertedFrame) as { payload?: Record<string, unknown> };
    expect(event.payload).toMatchObject({ reference: "T-1", vendor_id: expect.any(String) });
  });

  it("lifts ids out of the payload onto the event", () => {
    const event = normalizeFrame(offerAlertedFrame) as { tripId?: string };
    expect(event.tripId).toBe("019f888d-f599-7b73-8576-5babba6d4c6a");
  });

  it("still accepts a top-level `type` if the wire format is ever unified", () => {
    expect(normalizeFrame({ type: "trip.created", payload: {} })?.type).toBe("trip.created");
  });

  it("drops frames that carry no usable event type", () => {
    expect(normalizeFrame({ payload: {} })).toBeNull();
    expect(normalizeFrame(null)).toBeNull();
    expect(normalizeFrame("nonsense")).toBeNull();
  });
});
