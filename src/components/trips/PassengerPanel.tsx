import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Flag, MapPin, Navigation, UserRound, UserX } from "lucide-react";
import { csrfFetch, keys } from "@/lib/shared";
import { useToast } from "@/components/ui/Toast";

// Matches apps.trips.services.geofence_status_for_passenger's return shape, surfaced on each
// passenger by apps.trips.api.serializers.TripPassengerSerializer's "geofence" field — the
// same "is the vehicle close enough?" check the backend's pickup-override/drop-override
// endpoints already enforce server-side, exposed here so the button can be disabled BEFORE
// someone taps it and gets a rejected request, instead of only after.
export interface PanelGeofenceStatus {
  phase: "pickup" | "drop" | null;
  enabled: boolean;
  within_radius: boolean | null;
  distance_m: number | null;
  radius_m: number | null;
  reason: "no_position" | "stale_position" | "no_stop" | null;
}

export interface PanelPassenger {
  id: string;
  name: string;
  phone: string;
  status: "PENDING" | "PICKED_UP" | "DROPPED" | "NO_SHOW";
  drop_stop: { id: string; address: string } | null;
  picked_up_at: string | null;
  dropped_at: string | null;
  dropped_stop: { id: string; address: string } | null;
  geofence: PanelGeofenceStatus;
}

// The backend's own override endpoint silently allows the action when it has nothing to check
// proximity against ("no_stop" -- a stop with no coordinates), so that case must not block the
// button either, even though within_radius reads null there same as the genuinely-blocking
// reasons. Mirrors apps.trips.services._enforce_geofence's own "nothing to check against ->
// allow" branch exactly, so the button's enabled/disabled state never disagrees with what the
// backend will actually do when tapped.
function isGeofenceBlocked(g: PanelGeofenceStatus): boolean {
  return g.enabled && g.within_radius !== true && g.reason !== "no_stop";
}

function geofenceHint(g: PanelGeofenceStatus): string | null {
  if (!isGeofenceBlocked(g)) return null;
  if (g.reason === "no_position") return "Waiting for the vehicle's position.";
  if (g.reason === "stale_position") return "Vehicle's last known position is too old.";
  if (g.distance_m != null && g.radius_m != null) {
    return `${g.distance_m}m away — need to be within ${g.radius_m}m.`;
  }
  return "Vehicle is too far away.";
}

export interface PanelStop {
  id: string;
  kind: string;
  address: string;
}

const PICKUP_STATUSES = new Set(["EN_ROUTE_PICKUP", "AT_PICKUP"]);
const DROP_STATUSES = new Set(["PAX_PICKED", "IN_TRANSIT", "AT_DROP"]);

// The vendor portal doesn't collect a per-passenger OTP — these buttons always go through the
// backend's OTP-less override endpoint, with a fixed audit reason rather than one typed per
// click (the backend's override function requires a non-blank reason for its audit log; this
// is the one constant value for the portal's normal, no-remark pickup/drop flow).
const CONFIRM_REASON = "Confirmed via vendor portal (no per-passenger OTP collected)";

const STATUS_LABEL: Record<PanelPassenger["status"], { text: string; cls: string }> = {
  PENDING: { text: "Waiting for pickup", cls: "bg-page-bg text-text-muted border-border" },
  PICKED_UP: { text: "On board", cls: "bg-brand-blue/10 text-brand-blue border-brand-blue/20" },
  DROPPED: { text: "Dropped", cls: "bg-success/10 text-success border-success/30" },
  NO_SHOW: { text: "No show", cls: "bg-danger/10 text-danger border-danger/30" },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

async function call(url: string, body?: Record<string, unknown>): Promise<void> {
  const res = await csrfFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const env = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(env?.error?.message ?? `Request failed (${res.status})`);
  }
}

/** Each passenger's own Pickup/Drop — one click, no OTP, no remark. */
export function PassengerPanel({
  tripId,
  vehicleId,
  vehicleStatus,
  passengers,
  stops,
}: {
  tripId: string;
  vehicleId: string;
  vehicleStatus: string;
  passengers: PanelPassenger[];
  stops: PanelStop[];
}) {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [dropStop, setDropStop] = useState<Record<string, string>>({});
  const base = `/api/v1/trips/${tripId}/vehicles/${vehicleId}/passengers`;

  type ActionKind = "pickup-override" | "drop-override" | "no-show";

  const act = useMutation({
    mutationFn: async (a: { id: string; kind: ActionKind; stopId?: string }) => {
      const body: Record<string, unknown> = a.kind === "no-show" ? {} : { reason: CONFIRM_REASON };
      if (a.kind === "drop-override" && a.stopId) body.stop_id = a.stopId;
      await call(`${base}/${a.id}/${a.kind}/`, body);
    },
    onSuccess: (_d, a) => {
      addToast(
        a.kind === "pickup-override"
          ? "Passenger picked up"
          : a.kind === "drop-override"
            ? "Passenger dropped"
            : "Marked as no-show",
        "success",
      );
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => addToast(err instanceof Error ? err.message : "Could not confirm", "error"),
  });

  if (!passengers.length) return null;
  const dropChoices = stops.filter((s) => s.kind !== "PICKUP");

  return (
    <div className="space-y-2 pt-1">
      <h5 className="text-xs font-semibold text-text-primary">Passengers</h5>
      {passengers.map((p) => {
        const st = STATUS_LABEL[p.status];
        const canPickup = p.status === "PENDING" && PICKUP_STATUSES.has(vehicleStatus);
        const canDrop = p.status === "PICKED_UP" && DROP_STATUSES.has(vehicleStatus);
        const stopValue = dropStop[p.id] ?? p.drop_stop?.id ?? dropChoices[dropChoices.length - 1]?.id ?? "";
        const changed = p.drop_stop && stopValue && stopValue !== p.drop_stop.id;
        const geofenceBlocked = (canPickup || canDrop) && isGeofenceBlocked(p.geofence);
        const geofenceHintText = (canPickup || canDrop) ? geofenceHint(p.geofence) : null;
        return (
          <div key={p.id} className="rounded-xl border border-border bg-card-bg p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-page-bg text-text-muted shrink-0">
                {p.status === "NO_SHOW" ? <UserX className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}
              </span>
              <span className="text-sm font-medium text-text-primary">{p.name}</span>
              {p.phone && <span className="text-xs text-text-muted">{p.phone}</span>}
              <span className={`ml-auto px-2 py-0.5 text-[11px] font-semibold rounded-full border ${st.cls}`}>
                {st.text}
              </span>
            </div>

            <p className="flex items-start gap-1.5 text-xs text-text-muted">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Drops at{" "}
                <span className="font-medium text-text-primary">{p.drop_stop?.address ?? "the trip's drop"}</span>
              </span>
            </p>

            {p.picked_up_at && (
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <Clock className="w-3.5 h-3.5 shrink-0" /> Picked up{" "}
                <span className="font-medium text-text-primary">{when(p.picked_up_at)}</span>
              </p>
            )}
            {p.status === "DROPPED" && (
              <p className="flex items-start gap-1.5 text-xs text-text-muted">
                <Flag className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Dropped at <span className="font-medium text-text-primary">{p.dropped_stop?.address ?? "—"}</span>{" "}
                  on <span className="font-medium text-text-primary">{when(p.dropped_at)}</span>
                </span>
              </p>
            )}

            {(canPickup || canDrop) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {canDrop && (
                  <select
                    value={stopValue}
                    onChange={(e) => setDropStop((m) => ({ ...m, [p.id]: e.target.value }))}
                    aria-label={`Drop point for ${p.name}`}
                    className="min-w-0 max-w-[16rem] rounded-lg border border-border bg-card-bg px-2 py-1.5 text-xs text-text-primary"
                  >
                    {dropChoices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.kind === "DROP" ? "Drop" : "Waypoint"} · {s.address}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  disabled={act.isPending || geofenceBlocked}
                  title={geofenceHintText ?? undefined}
                  onClick={() =>
                    act.mutate({
                      id: p.id,
                      kind: canPickup ? "pickup-override" : "drop-override",
                      stopId: canDrop ? stopValue : undefined,
                    })
                  }
                  className={
                    canPickup
                      ? "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 hover:bg-brand-blue/20 transition-colors disabled:opacity-50"
                      : "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {act.isPending ? "Working…" : canPickup ? "Pickup" : "Drop"}
                </button>
                {canPickup && (
                  <button
                    type="button"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ id: p.id, kind: "no-show" })}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-page-bg disabled:opacity-50 transition-colors"
                  >
                    No-show
                  </button>
                )}
                {geofenceHintText && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-700">
                    <Navigation className="w-3 h-3 shrink-0" /> {geofenceHintText}
                  </span>
                )}
                {changed && <span className="text-[11px] text-amber-700">different from the planned drop</span>}
              </div>
            )}

            {p.status === "PENDING" && !canPickup && (
              <p className="text-[11px] text-text-muted">
                Pickup can be confirmed once the vehicle is on its way to, or at, the pickup.
              </p>
            )}
            {p.status === "PICKED_UP" && !canDrop && (
              <p className="text-[11px] text-text-muted">Drop can be confirmed once the vehicle is on the road.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
