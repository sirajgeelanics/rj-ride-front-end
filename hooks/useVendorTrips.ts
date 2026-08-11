"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, keys } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";

// The schema exposes a single trip shape (list + detail both return TripRequest).
export type TripSummary = components["schemas"]["TripRequest"];
export type TripDetail = components["schemas"]["TripRequest"];
export type TripVehicle = components["schemas"]["TripVehicle"];

export function useVendorTrips() {
  return useQuery({
    queryKey: keys.trips.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips", {
        params: { query: {} },
      });
      if (err) throw err;
      // List envelope is {next, previous, results}; the client middleware only unwraps
      // {result: …} (detail/action) responses, not lists. So read `results` directly.
      return res?.results ?? [];
    },
    staleTime: 30_000,
  });
}

export function useVendorTripDetail(tripId: string | null) {
  return useQuery({
    queryKey: keys.trips.detail(tripId ?? ""),
    queryFn: async () => {
      if (!tripId) return null;
      const { data: res, error: err } = await apiClient.GET("/v1/trips/{id}", {
        params: { path: { id: tripId } },
      });
      if (err) throw err;
      // Detail responses are {result: …} which the client middleware unwraps, so `res`
      // is already the trip object.
      return (res ?? null) as unknown as TripDetail | null;
    },
    enabled: !!tripId,
  });
}
