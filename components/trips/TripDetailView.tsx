"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, formatMoney } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PII } from "@/components/ui/PII";
import { StateTransitionManager } from "@/components/trips/StateTransitionManager";
import { MapPin, Clock, Users, CreditCard, Activity } from "lucide-react";

type TripRequest = components["schemas"]["TripRequest"];
type TripVehicle = components["schemas"]["TripVehicle"];
type Stop = components["schemas"]["Stop"];

interface TripDetailViewProps {
  tripId: string;
}

const STOP_TYPE_ICON: Record<string, string> = {
  PICKUP: "🟢",
  DROP: "🔴",
  WAYPOINT: "🔵",
};

const LOCATION_TYPE_BADGE: Record<string, string> = {
  AIRPORT: "✈",
  RAIL: "🚂",
  HOTEL: "🏨",
  CITY: "🏙",
  ADDRESS: "📍",
};

export const TripDetailView: React.FC<TripDetailViewProps> = ({ tripId }) => {
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={trip.status} />
            <span className="text-xs text-text-secondary font-mono">{trip.id}</span>
            {trip.reference && <span className="text-xs text-text-secondary">ref: {trip.reference}</span>}
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Created {new Date(trip.created_at).toLocaleString()}
            {trip.created_via && ` via ${trip.created_via}`}
          </p>
        </div>
      </div>

      <Card padding="md" header={
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Stops
        </h3>
      }>
        <ol className="space-y-2">
          {(trip.stops as Stop[]).map((stop) => (
            <li key={stop.sequence} className="flex items-start gap-3">
              <span className="text-lg leading-none pt-0.5">{STOP_TYPE_ICON[stop.kind] ?? "•"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{stop.address}</p>
                  <span className="text-xs">{LOCATION_TYPE_BADGE[stop.location_type]}</span>
                </div>
                <div className="text-xs text-text-secondary flex flex-wrap gap-2 mt-0.5">
                  {(stopExtra(stop).flight_number as string | undefined) && (
                    <span>✈ {stopExtra(stop).flight_number as string}</span>
                  )}
                  {(stopExtra(stop).train_number as string | undefined) && (
                    <span>🚂 {stopExtra(stop).train_number as string}</span>
                  )}
                </div>
              </div>
              <Badge variant="default" className="text-xs shrink-0">{stop.kind}</Badge>
            </li>
          ))}
        </ol>
      </Card>

      <Card padding="md" header={
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Vehicles
        </h3>
      }>
        <div className="space-y-3">
          {(trip.vehicles as TripVehicle[]).map((v) => (
            <div key={v.id} className="p-3 rounded border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-mono text-xs text-text-secondary">{v.id.substring(0, 8)}…</span>
                  <span className="ml-2 text-text-secondary">vt: {v.vehicle_type_name}</span>
                </div>
                <StatusBadge status={v.status} />
              </div>

              {v.locked_price != null && v.currency && (
                <p className="text-sm font-semibold text-brand-blue">
                  {formatMoney(v.locked_price, v.currency)}
                  {v.locked_rate_card_version != null && (
                    <span className="ml-1 text-xs font-normal text-text-secondary">v{v.locked_rate_card_version}</span>
                  )}
                </p>
              )}

              {v.driver_name && (
                <p className="text-xs text-text-secondary">
                  <PII value={v.driver_name} type="name" />
                </p>
              )}

              <StateTransitionManager tripId={trip.id} vehicleId={v.id} currentStatus={v.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

TripDetailView.displayName = "TripDetailView";
