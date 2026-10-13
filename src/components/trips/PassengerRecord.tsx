import React from "react";
import { CheckCircle2, Clock, Flag, MapPin, UserRound, UserX } from "lucide-react";

export interface PassengerRow {
  id: string;
  position: number;
  name: string;
  phone: string;
  status: "PENDING" | "PICKED_UP" | "DROPPED" | "NO_SHOW";
  drop_stop: { id: string; sequence: number; kind: string; address: string } | null;
  picked_up_at: string | null;
  picked_up_by_name: string | null;
  dropped_at: string | null;
  dropped_by_name: string | null;
  dropped_stop: { id: string; sequence: number; kind: string; address: string } | null;
  pickup_otp: string | null;
  drop_otp: string | null;
}

const STATUS: Record<PassengerRow["status"], { label: string; tone: string }> = {
  PENDING: { label: "Waiting for pickup", tone: "bg-ops-card2 text-text-secondary" },
  PICKED_UP: { label: "On board", tone: "bg-navy-soft text-brand-blue" },
  DROPPED: { label: "Dropped", tone: "bg-success-soft text-[#17623A]" },
  NO_SHOW: { label: "No show", tone: "bg-danger-soft text-[#A3341F]" },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

/**
 * Per-passenger drop point and the pickup/drop record (who, where, when).
 * `showOtps` prints each passenger's pickup/drop codes — only ever populated for agency admins.
 */
export function PassengerRecord({
  passengers,
  showOtps = false,
}: {
  passengers: PassengerRow[];
  showOtps?: boolean;
}) {
  if (!passengers.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-primary">Passengers · {passengers.length}</p>
      <ul className="space-y-2">
        {passengers.map((p) => {
          const st = STATUS[p.status];
          const droppedElsewhere =
            p.status === "DROPPED" && p.dropped_stop && p.drop_stop && p.dropped_stop.id !== p.drop_stop.id;
          return (
            <li key={p.id} className="rounded-xl border border-ops-line bg-white p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ops-card2 text-text-tertiary shrink-0">
                  {p.status === "NO_SHOW" ? <UserX className="w-3.5 h-3.5" /> : <UserRound className="w-3.5 h-3.5" />}
                </span>
                <span className="text-sm font-medium text-text-primary">{p.name}</span>
                {p.phone && <span className="text-xs text-text-secondary">{p.phone}</span>}
                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${st.tone}`}>
                  {st.label}
                </span>
              </div>

              <div className="grid gap-x-6 gap-y-1.5 text-xs text-text-secondary sm:grid-cols-2">
                <p className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-tertiary" />
                  <span>
                    Drops at{" "}
                    <span className="font-medium text-text-primary">
                      {p.drop_stop ? p.drop_stop.address : "the trip's drop"}
                    </span>
                  </span>
                </p>
                <p className="flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-tertiary" />
                  <span>
                    Picked up <span className="font-medium text-text-primary">{when(p.picked_up_at)}</span>
                    {p.picked_up_by_name && <> · {p.picked_up_by_name}</>}
                  </span>
                </p>
                <p className="flex items-start gap-1.5 sm:col-span-2">
                  <Flag className="w-3.5 h-3.5 mt-0.5 shrink-0 text-text-tertiary" />
                  <span>
                    {p.status === "DROPPED" ? (
                      <>
                        Dropped at{" "}
                        <span className="font-medium text-text-primary">
                          {p.dropped_stop?.address ?? "—"}
                        </span>{" "}
                        on <span className="font-medium text-text-primary">{when(p.dropped_at)}</span>
                        {p.dropped_by_name && <> · {p.dropped_by_name}</>}
                        {droppedElsewhere && (
                          <span className="ml-1.5 rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-semibold text-[#8A5A14]">
                            different from planned
                          </span>
                        )}
                      </>
                    ) : (
                      <>Not dropped yet</>
                    )}
                  </span>
                </p>
              </div>

              {showOtps && (p.pickup_otp || p.drop_otp) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.pickup_otp && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-blue/20 bg-navy-soft px-2 py-1 text-xs font-mono font-semibold text-brand-blue">
                      Pickup OTP {p.pickup_otp}
                      {p.picked_up_at && <CheckCircle2 className="w-3 h-3 text-success" />}
                    </span>
                  )}
                  {p.drop_otp && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success-soft px-2 py-1 text-xs font-mono font-semibold text-[#17623A]">
                      Drop OTP {p.drop_otp}
                      {p.dropped_at && <CheckCircle2 className="w-3 h-3 text-success" />}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
