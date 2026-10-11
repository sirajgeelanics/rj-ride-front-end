"use client";

import React, { useEffect } from "react";
import { Loader2, X } from "lucide-react";
import { useTripDetail } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/platform/StatusBadge";

interface TripDrawerProps {
  tripId: string | null;
  onClose: () => void;
}

export function TripDrawer({ tripId, onClose }: TripDrawerProps) {
  const { data: trip, isLoading, error } = useTripDetail(tripId);

  useEffect(() => {
    if (!tripId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tripId, onClose]);

  if (!tripId) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#04204A]/40 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Trip details"
        className="absolute right-0 inset-y-0 w-full max-w-md bg-white shadow-modal border-l border-border overflow-y-auto animate-slide-in-right"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur flex items-center justify-between px-5 py-4 border-b border-ops-line">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-serif text-2xl font-medium text-text-primary truncate">
              {trip?.reference ?? "Trip"}
            </h3>
            {trip && <StatusBadge status={trip.status} />}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-text-secondary hover:bg-ops-card2 hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-brand-blue" /></div>
        )}
        {error && <p className="p-5 text-sm text-danger">Could not load this trip.</p>}

        {trip && (
          <div className="p-5 space-y-6">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">Tenant</dt><dd className="font-medium">{trip.tenant.name}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">Customer</dt><dd>{trip.customer ?? "—"}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">Pickup</dt><dd>{formatDateTime(trip.pickup_at)}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">Airport</dt><dd className="font-mono text-xs">{trip.airport_code || "—"}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">RITMO ref</dt><dd className="font-mono text-xs">{trip.ritmo_ref ?? "—"}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wider text-text-tertiary">Created via</dt><dd>{trip.created_via}</dd></div>
            </dl>

            <section>
              <h4 className="font-serif text-lg font-medium mb-2">Route</h4>
              <ol className="relative border-l border-border ml-2 space-y-3">
                {trip.stops.map((s) => (
                  <li key={s.sequence} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-blue ring-2 ring-white" />
                    <p className="text-[11px] uppercase tracking-wider text-text-tertiary">
                      {s.kind.toLowerCase()} · {s.location_type.toLowerCase()}
                    </p>
                    <p className="text-sm">{s.address}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h4 className="font-serif text-lg font-medium mb-2">Vehicles</h4>
              <div className="space-y-3">
                {trip.vehicles.map((v) => (
                  <div key={v.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{v.vendor?.name ?? "Unallotted"}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {[v.vehicle_type, v.plate, v.driver].filter(Boolean).join(" · ") || "No vehicle yet"} · {v.pax_count} pax
                    </p>
                    {(trip.timeline[v.id] ?? []).length > 0 && (
                      <ol className="mt-3 space-y-1.5 border-t border-ops-line pt-2">
                        {(trip.timeline[v.id] ?? []).map((e, i) => (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <StatusBadge status={e.status} />
                            <span className="text-text-secondary tabular">{formatDateTime(e.at)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
