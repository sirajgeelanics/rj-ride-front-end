"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export type TripEvent =
  | { type: "trip.created"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.updated"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.cancelled"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.completed"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.assigned"; tripId: string; payload: Record<string, unknown> };

// Vendor allocation offer cycle (BE-18): an offer is made to a vendor, alerted near its
// response deadline, then either accepted (→ trip.assigned), withdrawn, or expired.
export type OfferEvent =
  | { type: "trip.offer_made"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.offer_alerted"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.offer_expired"; tripId: string; payload: Record<string, unknown> }
  | { type: "trip.offer_withdrawn"; tripId: string; payload: Record<string, unknown> };

export type BillingEvent =
  | { type: "billing.invoice_created"; invoiceId: string; payload: Record<string, unknown> }
  | { type: "billing.invoice_updated"; invoiceId: string; payload: Record<string, unknown> };

export type SosEvent = {
  type: "sos.raised";
  tripVehicleId: string;
  payload: Record<string, unknown>;
};

export type TrackingEvent = {
  type: "tracking.position";
  deviceId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: string;
};

export type DocumentEvent = {
  type: "document.expiry_warning";
  entityId: string;
  entityType: "driver" | "vehicle";
  daysRemaining: number;
  payload: Record<string, unknown>;
};

export type RideEvent =
  | TripEvent
  | OfferEvent
  | BillingEvent
  | SosEvent
  | TrackingEvent
  | DocumentEvent;

/**
 * Translate a server frame into a `RideEvent`.
 *
 * The server (apps/dispatch/consumers.py) sends `{"event_type": ..., "payload": {...}}`, but
 * `RideEvent` is discriminated on `type`. The old code cast the frame straight across, so
 * `event.type` was always `undefined` — every `invalidationMap` lookup missed and every
 * `event.type === "..."` check in a handler was false. The whole WS layer was silently inert
 * and the portals were kept up to date only by their polling intervals.
 *
 * The id fields (`tripId`, `invoiceId`, ...) are lifted out of the payload, which is where the
 * backend actually puts them.
 */
export function normalizeFrame(data: unknown): RideEvent | null {
  if (!data || typeof data !== "object") return null;
  const frame = data as { event_type?: unknown; type?: unknown; payload?: unknown };
  // Tolerate `type` too, so this keeps working if the wire format is ever unified.
  const type = typeof frame.event_type === "string" ? frame.event_type : frame.type;
  if (typeof type !== "string") return null;

  const payload = (frame.payload ?? {}) as Record<string, unknown>;
  return {
    type,
    payload,
    tripId: payload.trip_id,
    tripVehicleId: payload.trip_vehicle_id,
    invoiceId: payload.invoice_id,
    vehicleId: payload.vehicle_id,
    documentId: payload.document_id,
  } as unknown as RideEvent;
}

interface ConnectEventsOptions {
  onEvent: (event: RideEvent) => void;
  wsOrigin?: string;
}

interface ConnectionHandle {
  close: () => void;
}

async function fetchWsTicket(): Promise<string> {
  const { data, error } = await apiClient.POST("/v1/auth/ws-ticket", {});
  if (error || !(data as unknown as { ticket?: string } | undefined)?.ticket) {
    throw new Error("Failed to obtain WS ticket");
  }
  return (data as unknown as { ticket: string }).ticket;
}

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 45_000;

export function connectEvents({
  onEvent,
  wsOrigin,
}: ConnectEventsOptions): ConnectionHandle {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

  const origin =
    wsOrigin ??
    (typeof process !== "undefined"
      ? process.env["NEXT_PUBLIC_WS_ORIGIN"]
      : undefined) ??
    (typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "ws")
      : "wss://api-ravani.rezolv.app");

  function resetHeartbeat() {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      ws?.close(4000, "heartbeat timeout");
    }, HEARTBEAT_TIMEOUT_MS);
  }

  async function connect() {
    if (closed) return;
    let ticket: string;
    try {
      ticket = await fetchWsTicket();
    } catch {
      scheduleReconnect();
      return;
    }
    const url = `${origin}/ws/v1/events/?ticket=${encodeURIComponent(ticket)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      attempt = 0;
      resetHeartbeat();
    };

    ws.onmessage = (ev) => {
      resetHeartbeat();
      try {
        const data = JSON.parse(ev.data as string) as unknown;
        const event = normalizeFrame(data);
        if (event) onEvent(event);
      } catch {
      }
    };

    ws.onerror = () => {
    };

    ws.onclose = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (closed) return;
    const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
    attempt += 1;
    setTimeout(connect, delay);
  }

  void connect();

  return {
    close() {
      closed = true;
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      ws?.close(1000, "client close");
    },
  };
}

type QueryKeyInvalidationMap = Partial<
  Record<RideEvent["type"], readonly unknown[]>
>;

interface UseRideEventsOptions {
  handler?: (event: RideEvent) => void;
  invalidationMap?: QueryKeyInvalidationMap;
  wsOrigin?: string;
}

export function useRideEvents({
  handler,
  invalidationMap,
  wsOrigin,
}: UseRideEventsOptions = {}) {
  const queryClient = useQueryClient();
  const handlerRef = useRef(handler);
  const mapRef = useRef(invalidationMap);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    mapRef.current = invalidationMap;
  }, [invalidationMap]);

  useEffect(() => {
    const handle = connectEvents({
      wsOrigin,
      onEvent(event) {
        handlerRef.current?.(event);
        const keyToInvalidate = mapRef.current?.[event.type];
        if (keyToInvalidate) {
          void queryClient.invalidateQueries({ queryKey: keyToInvalidate });
        }
      },
    });
    return () => handle.close();
  }, [queryClient, wsOrigin]);
}
