import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Flag, MapPin, UserRound, UserX } from "lucide-react";
import { csrfFetch, keys } from "@/lib/shared";
import { useToast } from "@/components/ui/Toast";

export interface PanelPassenger {
  id: string;
  name: string;
  phone: string;
  status: "PENDING" | "PICKED_UP" | "DROPPED" | "NO_SHOW";
  drop_stop: { id: string; address: string } | null;
  picked_up_at: string | null;
  dropped_at: string | null;
  dropped_stop: { id: string; address: string } | null;
}

export interface PanelStop {
  id: string;
  kind: string;
  address: string;
}

const PICKUP_STATUSES = new Set(["EN_ROUTE_PICKUP", "AT_PICKUP"]);
const DROP_STATUSES = new Set(["PAX_PICKED", "IN_TRANSIT", "AT_DROP"]);

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

/** Each passenger's pickup/drop confirmation: the vendor/driver enters that passenger's own OTP. */
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
  const [otps, setOtps] = useState<Record<string, string>>({});
  const [dropStop, setDropStop] = useState<Record<string, string>>({});
  const base = `/api/v1/trips/${tripId}/vehicles/${vehicleId}/passengers`;

  const act = useMutation({
    mutationFn: async (a: { id: string; kind: "pickup" | "drop" | "no-show"; stopId?: string }) => {
      const body: Record<string, unknown> =
        a.kind === "no-show" ? {} : { otp: (otps[a.id] ?? "").trim() };
      if (a.kind === "drop" && a.stopId) body.stop_id = a.stopId;
      await call(`${base}/${a.id}/${a.kind}/`, body);
    },
    onSuccess: (_d, a) => {
      addToast(
        a.kind === "pickup" ? "Passenger picked up" : a.kind === "drop" ? "Passenger dropped" : "Marked as no-show",
        "success",
      );
      setOtps((o) => ({ ...o, [a.id]: "" }));
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
    },
    onError: (err) => addToast(err instanceof Error ? err.message : "Could not confirm", "error"),
  });

  if (!passengers.length) return null;
  const dropChoices = stops.filter((s) => s.kind !== "PICKUP");

  return (
    <div className="space-y-2 pt-1">
      <h5 className="text-xs font-semibold text-text-primary">
        Passengers <span className="text-text-muted font-normal">· ask each for their OTP</span>
      </h5>
      {passengers.map((p) => {
        const st = STATUS_LABEL[p.status];
        const canPickup = p.status === "PENDING" && PICKUP_STATUSES.has(vehicleStatus);
        const canDrop = p.status === "PICKED_UP" && DROP_STATUSES.has(vehicleStatus);
        const stopValue = dropStop[p.id] ?? p.drop_stop?.id ?? dropChoices[dropChoices.length - 1]?.id ?? "";
        const otp = otps[p.id] ?? "";
        const changed = p.drop_stop && stopValue && stopValue !== p.drop_stop.id;
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
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={10}
                  placeholder={canPickup ? "Pickup OTP" : "Drop OTP"}
                  value={otp}
                  onChange={(e) => setOtps((m) => ({ ...m, [p.id]: e.target.value.replace(/\D/g, "") }))}
                  aria-label={`${canPickup ? "Pickup" : "Drop"} OTP for ${p.name}`}
                  className="w-32 rounded-lg border border-border bg-card-bg px-2.5 py-1.5 text-sm font-mono tracking-widest text-text-primary"
                />
                <button
                  type="button"
                  disabled={otp.length < 4 || act.isPending}
                  onClick={() =>
                    act.mutate({
                      id: p.id,
                      kind: canPickup ? "pickup" : "drop",
                      stopId: canDrop ? stopValue : undefined,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {canPickup ? "Confirm pickup" : "Confirm drop"}
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
