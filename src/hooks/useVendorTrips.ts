import { useQuery } from "@tanstack/react-query";
import { apiClient, keys } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";

// The schema exposes a single trip shape (list + detail both return TripRequest).
export type TripSummary = components["schemas"]["TripRequest"];
export type TripDetail = components["schemas"]["TripRequest"];
export type TripVehicle = components["schemas"]["TripVehicle"];

// The server returns one page (25) at a time. Searching and filtering happen in the browser, so
// the list must hold EVERY trip the vendor can see — otherwise a trip on page 2+ can never be
// found. A hard page cap stops a misbehaving server from looping forever.
const TRIPS_PAGE_SIZE = 100;
const MAX_TRIP_PAGES = 30;

async function fetchAllTrips(): Promise<TripSummary[]> {
  const all: TripSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_TRIP_PAGES; page++) {
    const { data: res, error: err } = await apiClient.GET("/v1/trips", {
      params: {
        query: { page_size: TRIPS_PAGE_SIZE, ...(cursor ? { cursor } : {}) } as never,
      },
    });
    if (err) throw err;
    // List envelope is {next, previous, results}; the client middleware only unwraps
    // {result: …} (detail/action) responses, not lists. So read `results` directly.
    all.push(...((res?.results ?? []) as TripSummary[]));

    const next = (res as { next?: string | null } | undefined)?.next;
    if (!next) break;
    cursor = new URL(next, window.location.origin).searchParams.get("cursor") ?? undefined;
    if (!cursor) break;
  }
  return all;
}

export function useVendorTrips() {
  return useQuery({
    queryKey: keys.trips.list({}),
    queryFn: fetchAllTrips,
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
