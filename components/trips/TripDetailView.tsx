"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, formatMoney } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PII } from "@/components/ui/PII";
import { StateTransitionManager } from "@/components/trips/StateTransitionManager";
import { VehicleAssignmentModal } from "@/components/trips/VehicleAssignmentModal";
import { Car, Building2, MapPin, Clock } from "lucide-react";

type TripRequest = components["schemas"]["TripRequest"];
type TripVehicle = components["schemas"]["TripVehicle"];
type Stop = components["schemas"]["Stop"];

// Only these statuses accept a vehicle/driver swap — apps.trips.services.reassign_vehicle's
// own allowed_for_reassign set. Showing the button outside these would just 409.
const REASSIGNABLE_STATUSES = new Set(["ASSIGNED", "DRIVER_ACCEPTED", "BREAKDOWN"]);

function paxCountOf(v: TripVehicle): number {
  return Array.isArray(v.pax) ? v.pax.length : 0;
}

interface TripDetailViewProps {
  tripId: string;
}

export const TripDetailView: React.FC<TripDetailViewProps> = ({ tripId }) => {
  const [assignmentModal, setAssignmentModal] = useState<{
    tripVehicleId: string;
    mode: "assign" | "reassign";
    paxCount: number;
  } | null>(null);

  const { data: trip, isLoading, error } = useQuery<TripRequest>({
    queryKey: keys.trips.detail(tripId),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips/{id}", {
        params: { path: { id: tripId } },
      });
      if (err) throw err;
      return res as unknown as TripRequest;
    },
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-text-secondary">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
        Loading trip…
      </div>
    );
  }

  if (error || !trip) {
    return (
      <Card padding="lg" className="text-center text-danger py-8">
        <p>Failed to load trip details.</p>
      </Card>
    );
  }

  const stopExtra = (stop: Stop) => {
    const extra = stop.extra as Record<string, unknown> | null | undefined;
    return extra ?? {};
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={trip.status} />
            {trip.reference && (
              <span className="font-mono text-base font-semibold text-text-primary">{trip.reference}</span>
            )}
            <span className="text-xs text-text-tertiary font-mono" title={trip.id}>
              {trip.id.substring(0, 8)}…
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-text-tertiary" />
            Created {new Date(trip.created_at).toLocaleString()}
            {trip.created_via && ` · ${trip.created_via}`}
          </p>
        </div>
      </div>

      <Card padding="md" header={<h3 className="text-sm font-semibold">Stops</h3>}>
        <ol className="space-y-3">
          {(trip.stops as Stop[]).map((stop) => (
            <li key={stop.sequence} className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-text-tertiary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{stop.address}</p>
                <div className="text-xs text-text-secondary flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {(stopExtra(stop).flight_number as string | undefined) && (
                    <span>Flight {stopExtra(stop).flight_number as string}</span>
                  )}
                  {(stopExtra(stop).train_number as string | undefined) && (
                    <span>Train {stopExtra(stop).train_number as string}</span>
                  )}
                </div>
              </div>
              <Badge variant="default" className="text-xs shrink-0">{stop.kind}</Badge>
            </li>
          ))}
        </ol>
      </Card>

      <Card padding="md" header={<h3 className="text-sm font-semibold">Vehicles</h3>}>
        <div className="space-y-3">
          {(trip.vehicles as TripVehicle[]).map((v) => (
            <div key={v.id} className="p-3 rounded-lg border border-border bg-white space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-mono">
                  <Car className="w-3 h-3 text-accent-gold" /> {v.vehicle_type_name}
                </span>
                <StatusBadge status={v.status} />
              </div>

              {v.locked_price != null && v.currency && (
                <p className="text-lg font-semibold text-brand-blue">
                  {formatMoney(v.locked_price, v.currency)}
                  {v.locked_rate_card_version != null && (
                    <span className="ml-1.5 text-xs font-normal text-text-tertiary">rate v{v.locked_rate_card_version}</span>
                  )}
                </p>
              )}

              {(v.vendor_name || v.vehicle_plate || v.driver_name) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {v.vendor_name && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium">
                      <Building2 className="w-3 h-3" /> {v.vendor_name}
                    </span>
                  )}
                  {v.vehicle_plate && (
                    <span className="px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs font-mono">
                      {v.vehicle_plate}
                    </span>
                  )}
                  {v.driver_name && (
                    <span className="text-xs text-text-secondary">
                      <PII value={v.driver_name} type="name" />
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {!v.vehicle && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setAssignmentModal({
                        tripVehicleId: v.id,
                        mode: "assign",
                        paxCount: paxCountOf(v),
                      })
                    }
                  >
                    Assign vehicle &amp; driver
                  </Button>
                )}
                {!!v.vehicle && REASSIGNABLE_STATUSES.has(v.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setAssignmentModal({
                        tripVehicleId: v.id,
                        mode: "reassign",
                        paxCount: paxCountOf(v),
                      })
                    }
                  >
                    Reassign vehicle &amp; driver
                  </Button>
                )}
              </div>

              <StateTransitionManager tripId={trip.id} vehicleId={v.id} currentStatus={v.status} />
            </div>
          ))}
        </div>
      </Card>

      {assignmentModal && (
        <VehicleAssignmentModal
          tripId={trip.id}
          tripVehicleId={assignmentModal.tripVehicleId}
          mode={assignmentModal.mode}
          paxCount={assignmentModal.paxCount}
          onClose={() => setAssignmentModal(null)}
        />
      )}
    </div>
  );
};

TripDetailView.displayName = "TripDetailView";
