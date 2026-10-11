import { useQuery } from "@tanstack/react-query";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string | number | undefined | null>;

async function getJson<T>(path: string, params?: Params): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  const res = await fetch(`/api/v1/platform${path}${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status})`);
  }
  return ((await res.json()) as { result: T }).result;
}

export interface Overview {
  tenants: number;
  active_tenants: number;
  vendors: number;
  vehicles: number;
  drivers: number;
  trips: {
    total: number;
    open: number;
    created_last_24h: number;
    by_status: Record<string, number>;
  };
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  ritmo_tenant_code: string;
  is_active: boolean;
  created_at: string;
  vendors: number;
  vehicles: number;
  drivers: number;
  trips: number;
  open_trips: number;
  trips_7d: number;
  completed_7d: number;
  cancelled_7d: number;
  completion_rate: number | null;
  ritmo_trips: number;
  ritmo_push_ok_rate: number | null;
  open_alerts: number;
  stale_pending: number;
  last_trip_at: string | null;
}

export interface VendorRow {
  id: string;
  name: string;
  tenant: { id: string; name: string };
  airport_code: string;
  is_active: boolean;
  vehicles: number;
  drivers: number;
  trips: number;
  live_slots: number;
}

export interface TenantDetail extends TenantRow {
  currency: string;
  trips_by_status: Record<string, number>;
  vendor_list: VendorRow[];
}

export interface TripSlot {
  id: string;
  status: string;
  vendor: { id: string; name: string } | null;
  plate: string | null;
  driver: string | null;
  vehicle_type: string | null;
  pax_count: number;
}

export interface TripRow {
  id: string;
  reference: string;
  status: string;
  tenant: { id: string; name: string };
  customer: string | null;
  pickup_at: string | null;
  pickup: string;
  drop: string;
  airport_code: string;
  ritmo_ref: string | null;
  created_via: string;
  created_at: string;
  vehicles: TripSlot[];
}

export interface TripPage {
  count: number;
  page: number;
  page_size: number;
  results: TripRow[];
}

export interface TripFilters {
  tenant?: string;
  vendor?: string;
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

const live = { refetchInterval: 30_000, retry: false } as const;

export const useOverview = () =>
  useQuery({ queryKey: ["platform", "overview"], queryFn: () => getJson<Overview>("/overview/"), ...live });

export const useTenants = () =>
  useQuery({ queryKey: ["platform", "tenants"], queryFn: () => getJson<TenantRow[]>("/tenants/"), retry: false });

export const useTenant = (id: string) =>
  useQuery({
    queryKey: ["platform", "tenant", id],
    queryFn: () => getJson<TenantDetail>(`/tenants/${id}/`),
    retry: false,
  });

export const useVendors = (tenant?: string) =>
  useQuery({
    queryKey: ["platform", "vendors", tenant ?? "all"],
    queryFn: () => getJson<VendorRow[]>("/vendors/", { tenant }),
    retry: false,
  });

export const useTrips = (filters: TripFilters) =>
  useQuery({
    queryKey: ["platform", "trips", filters],
    queryFn: () => getJson<TripPage>("/trips/", { ...filters }),
    retry: false,
    placeholderData: (previous) => previous,
  });


// ------------------------------------------------------------------ insights

export interface TenantRef {
  id: string;
  name: string;
}

export type AttentionCategory =
  | "safety_alerts"
  | "stuck_assigned"
  | "stale_pending"
  | "ritmo_push_issues"
  | "expired_offers"
  | "pending_changes";

export interface AttentionItem {
  id: string;
  tenant: TenantRef;
  trip_reference?: string | null;
  kind?: string;
  severity?: string;
  status?: string;
  recorded_at?: string;
  vendor?: string | null;
  minutes?: number;
  pickup_at?: string | null;
  ritmo_ref?: string | null;
  problem?: string;
  error?: string | null;
  last_attempt_at?: string | null;
  expired_at?: string | null;
  requested_pickup_at?: string | null;
  requested_pax_count?: number | null;
  expires_at?: string | null;
}

export interface Attention {
  counts: Record<AttentionCategory, number>;
  items: Record<AttentionCategory, AttentionItem[]>;
  generated_at: string;
  stale_after_minutes: number;
}

export interface ConfigGaps {
  counts: Record<string, number>;
  vehicle_types_without_rate_card: { tenant: TenantRef; vehicle_type: string; vehicles: number }[];
  unmatched_requests: { tenant: TenantRef; requested_type: string; requests: number }[];
  vendor_setup: { tenant: TenantRef; vendor: string; issues: string[] }[];
  tenant_setup: { tenant: TenantRef; issues: string[] }[];
}

export interface MoneyTenant {
  tenant: TenantRef;
  currency: string;
  completed_not_billed: number;
  statements: Record<string, number>;
  payouts: Record<string, { count: number; net_minor: number; net_display: string }>;
  monthly: {
    month: string;
    trips: number;
    total_minor: number;
    total_display: string;
    fee_minor: number;
    fee_display: string;
  }[];
}

export interface Money {
  tenants: MoneyTenant[];
  totals_by_currency: { currency: string; total_display: string; fee_display: string; trips: number }[];
  window_months: number;
}

export interface FleetTenant {
  tenant: TenantRef;
  vehicles: number;
  vehicles_active: number;
  vehicles_on_trip: number;
  vehicles_breakdown: number;
  vehicles_unavailable: number;
  vehicles_no_location: number;
  drivers: number;
  drivers_available: number;
  drivers_on_trip: number;
  drivers_offline: number;
  documents_expired: number;
  documents_expiring: number;
}

export interface Fleet {
  tenants: FleetTenant[];
  expiring_documents: {
    tenant: TenantRef;
    entity_type: string;
    entity: string;
    doc_type: string;
    expiry_date: string;
    days_left: number;
  }[];
  warning_days: number;
}

export interface ActivityTenant {
  tenant: TenantRef;
  agency_admins: number;
  vendor_managers: number;
  driver_logins: number;
  drivers: number;
  drivers_without_login: number;
  failed_logins_24h: number;
  failed_logins_7d: number;
  last_login_at: string | null;
}

export interface TripDetail extends TripRow {
  stops: { sequence: number; kind: string; address: string; location_type: string }[];
  timeline: Record<string, { status: string; at: string }[]>;
}

interface Opts {
  enabled?: boolean;
}

const insightQuery = <T,>(key: string, path: string, tenant?: string, opts?: Opts) => ({
  queryKey: ["platform", key, tenant ?? "all"],
  queryFn: () => getJson<T>(path, { tenant }),
  retry: false,
  enabled: opts?.enabled ?? true,
});

export const useAttention = (tenant?: string, opts?: Opts) =>
  useQuery({ ...insightQuery<Attention>("attention", "/attention/", tenant, opts), refetchInterval: 30_000 });

export const useConfigGaps = (tenant?: string, opts?: Opts) =>
  useQuery(insightQuery<ConfigGaps>("config-gaps", "/config-gaps/", tenant, opts));

export const useMoney = (tenant?: string, opts?: Opts) =>
  useQuery(insightQuery<Money>("money", "/money/", tenant, opts));

export const useFleet = (tenant?: string, opts?: Opts) =>
  useQuery(insightQuery<Fleet>("fleet", "/fleet/", tenant, opts));

export const useActivity = (tenant?: string, opts?: { enabled?: boolean }) =>
  useQuery(insightQuery<{ tenants: ActivityTenant[] }>("activity", "/activity/", tenant, opts));

export const useTripDetail = (id: string | null) =>
  useQuery({
    queryKey: ["platform", "trip", id],
    queryFn: () => getJson<TripDetail>(`/trips/${id}/`),
    enabled: id !== null,
    retry: false,
  });

export function tripExportUrl(filters: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) search.set(k, v);
  const qs = search.toString();
  return `/api/v1/platform/trips/export/${qs ? `?${qs}` : ""}`;
}
