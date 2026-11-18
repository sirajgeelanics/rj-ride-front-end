import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status < 500) return false;
          return failureCount < 3;
        },
      },
    },
  });
}

type FiltersShape = Record<string, string | number | boolean | undefined | null>;

export const keys = {
  me: () => ["me"] as const,

  config: {
    all: () => ["config"] as const,
    vendors: {
      list: (filters?: FiltersShape) =>
        ["config", "vendors", "list", filters ?? {}] as const,
      detail: (id: string) => ["config", "vendors", "detail", id] as const,
    },
    customers: {
      list: (filters?: FiltersShape) =>
        ["config", "customers", "list", filters ?? {}] as const,
      detail: (id: string) => ["config", "customers", "detail", id] as const,
    },
    vehicleTypes: {
      list: (filters?: FiltersShape) =>
        ["config", "vehicle-types", "list", filters ?? {}] as const,
      detail: (id: string) =>
        ["config", "vehicle-types", "detail", id] as const,
    },
    rateCards: {
      list: (filters?: FiltersShape) =>
        ["config", "pricing", "rate-cards", "list", filters ?? {}] as const,
      detail: (id: string) =>
        ["config", "pricing", "rate-cards", "detail", id] as const,
    },
  },

  trips: {
    all: () => ["trips"] as const,
    list: (filters?: FiltersShape) =>
      ["trips", "list", filters ?? {}] as const,
    detail: (id: string) => ["trips", "detail", id] as const,
    recurringRules: {
      list: () => ["trips", "recurring-rules", "list"] as const,
      detail: (id: string) =>
        ["trips", "recurring-rules", "detail", id] as const,
    },
  },

  fleet: {
    all: () => ["fleet"] as const,
    vehicles: {
      list: (filters?: FiltersShape) =>
        ["fleet", "vehicles", "list", filters ?? {}] as const,
      detail: (id: string) => ["fleet", "vehicles", "detail", id] as const,
    },
    drivers: {
      list: (filters?: FiltersShape) =>
        ["fleet", "drivers", "list", filters ?? {}] as const,
      detail: (id: string) => ["fleet", "drivers", "detail", id] as const,
    },
  },

  pricing: {
    all: () => ["pricing"] as const,
    rateCards: {
      list: (filters?: FiltersShape) =>
        ["pricing", "rate-cards", "list", filters ?? {}] as const,
      detail: (id: string) => ["pricing", "rate-cards", "detail", id] as const,
    },
  },

  billing: {
    all: () => ["billing"] as const,
    invoices: {
      list: (filters?: FiltersShape) =>
        ["billing", "invoices", "list", filters ?? {}] as const,
      detail: (id: string) => ["billing", "invoices", "detail", id] as const,
    },
    statements: {
      list: (filters?: FiltersShape) =>
        ["billing", "statements", "list", filters ?? {}] as const,
    },
    payouts: {
      list: (filters?: FiltersShape) =>
        ["billing", "payouts", "list", filters ?? {}] as const,
      detail: (id: string) => ["billing", "payouts", "detail", id] as const,
    },
  },

  dispatch: {
    all: () => ["dispatch"] as const,
    board: () => ["dispatch", "board"] as const,
    assignments: {
      list: (filters?: FiltersShape) =>
        ["dispatch", "assignments", "list", filters ?? {}] as const,
      detail: (id: string) =>
        ["dispatch", "assignments", "detail", id] as const,
    },
    // Incoming API-sourced trip requests awaiting allocation (BE-18 / FE-6).
    incoming: {
      list: (filters?: FiltersShape) =>
        ["dispatch", "incoming", "list", filters ?? {}] as const,
      detail: (id: string) =>
        ["dispatch", "incoming", "detail", id] as const,
    },
  },

  // Vendor allocation offers (BE-18 / FE-6): the vendor-portal offers inbox.
  offers: {
    all: () => ["offers"] as const,
    list: (filters?: FiltersShape) =>
      ["offers", "list", filters ?? {}] as const,
    detail: (id: string) => ["offers", "detail", id] as const,
  },

  tracking: {
    all: () => ["tracking"] as const,
    live: () => ["tracking", "live"] as const,
    track: (tripVehicleId: string) =>
      ["tracking", "track", tripVehicleId] as const,
  },

  safety: {
    all: () => ["safety"] as const,
    sos: {
      list: (filters?: FiltersShape) =>
        ["safety", "sos", "list", filters ?? {}] as const,
      detail: (id: string) => ["safety", "sos", "detail", id] as const,
    },
  },
} as const;

export const wsInvalidationMap = {
  "trip.created": keys.trips.all(),
  "trip.updated": keys.trips.all(),
  "trip.cancelled": keys.trips.all(),
  "trip.completed": keys.trips.all(),
  "trip.assigned": keys.dispatch.board(),
  // Offer-cycle events touch the incoming queue and the board; keys.dispatch.all() is a
  // prefix that invalidates both. Portals that also show the offers inbox pass a custom
  // invalidationMap for keys.offers.
  "trip.offer_made": keys.dispatch.all(),
  "trip.offer_alerted": keys.dispatch.all(),
  "trip.offer_expired": keys.dispatch.all(),
  "trip.offer_withdrawn": keys.dispatch.all(),
  "billing.invoice_created": keys.billing.all(),
  "billing.invoice_updated": keys.billing.all(),
} as const;
