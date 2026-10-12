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
  last_trip_at: string | null;
  vehicles_active: number;
  vehicles_on_trip: number;
  vehicles_breakdown: number;
  vehicles_unavailable: number;
  vehicles_no_location: number;
  drivers_available: number;
  drivers_on_trip: number;
  drivers_offline: number;
  drivers_without_login: number;
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
  price_display: string | null;
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
  pax_total: number;
  price_display: string | null;
  vehicles: TripSlot[];
}

export interface TripPage {
  count: number;
  page: number;
  page_size: number;
  status_counts: Record<string, number>;
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
  minutes_to_allot: number | null;
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

export interface CatalogRateCard {
  id: string;
  basis: string;
  basis_label: string;
  rates: { label: string; value: string }[];
  currency: string;
  version: number;
  versions: number;
  valid_from: string;
  valid_to: string | null;
  status: "ACTIVE" | "UPCOMING" | "EXPIRED" | "INACTIVE" | "SUPERSEDED";
  free_cancellation_hours: number;
  min_lead_time_hours: number;
  modifiers: Record<string, unknown>;
}

export interface CatalogVehicleType {
  id: string;
  name: string;
  ac: boolean;
  capacity: number;
  vehicles: number;
  rate_card: CatalogRateCard | null;
  names: { id: string; name: string; vehicles: number }[];
}

export interface CatalogVendor {
  id: string;
  name: string;
  airport_code: string;
  vehicle_types: CatalogVehicleType[];
}

export interface CatalogTenant {
  tenant: TenantRef;
  vendors: CatalogVendor[];
}

export const useCatalog = (tenant?: string, opts?: Opts) =>
  useQuery(insightQuery<{ tenants: CatalogTenant[] }>("catalog", "/catalog/", tenant, opts));

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


// ------------------------------------------------------------------ one vendor's fleet

export interface FleetJob {
  trip_reference: string;
  status: string;
}

export interface VendorVehicle {
  id: string;
  plate: string;
  vehicle_type: string;
  vehicle_name: string | null;
  is_active: boolean;
  airport_code: string;
  has_tracker: boolean;
  location_status: string | null;
  location_updated_at: string | null;
  current_job: FleetJob | null;
  documents_expired: number;
  documents_expiring: number;
  documents: FleetDocument[];
}

export interface FleetDocument {
  doc_type: string;
  expiry_date: string | null;
  days_left: number | null;
}

export interface VendorDriver {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
  airport_code: string;
  has_app_login: boolean;
  phone_masked: string;
  current_job: FleetJob | null;
  documents_expired: number;
  documents_expiring: number;
  documents: FleetDocument[];
}

export interface VendorFleet {
  vendor: { id: string; name: string; tenant: TenantRef; airport_code: string };
  summary: {
    vehicles: number;
    vehicles_active: number;
    vehicles_on_trip: number;
    vehicles_breakdown: number;
    vehicles_no_location: number;
    drivers: number;
    drivers_available: number;
    drivers_on_trip: number;
    drivers_offline: number;
    drivers_without_login: number;
    documents_expired: number;
    documents_expiring: number;
    live_trips: number;
  };
  vehicles: VendorVehicle[];
  drivers: VendorDriver[];
  truncated: boolean;
  warning_days: number;
}

export const useVendorFleet = (id: string) =>
  useQuery({
    queryKey: ["platform", "vendor", id],
    queryFn: () => getJson<VendorFleet>(`/vendors/${id}/`),
    retry: false,
    refetchInterval: 30_000,
  });


// ------------------------------------------------------------------ vendor performance

export interface VendorPerformance {
  window_days: number;
  grace_minutes: number;
  assignments: number;
  completed: number;
  on_time: { measured: number; on_time: number; rate_pct: number | null; avg_minutes_late: number | null };
  time_to_allot: { measured: number; avg_minutes: number | null; median_minutes: number | null };
  utilisation: {
    window_days: number;
    vehicles: number;
    vehicles_used: number;
    used_pct: number | null;
    avg_daily_used: number;
    avg_daily_pct: number | null;
  };
  revenue: { currency: string; amount: string; amount_minor: number }[];
  payouts: {
    year: number;
    month: number;
    status: string;
    gross: string;
    operator_fee: string;
    net: string;
    paid_at: string | null;
  }[];
}

export const useVendorPerformance = (id: string) =>
  useQuery({
    queryKey: ["platform", "vendor-performance", id],
    queryFn: () => getJson<VendorPerformance>(`/vendors/${id}/performance/`),
    retry: false,
  });

// ------------------------------------------------------------------ live map

export interface MapPoint {
  vehicle_id: string;
  plate: string;
  vehicle_type: string;
  vendor: string;
  tenant: TenantRef;
  lat: number;
  lng: number;
  status: string;
  last_updated: string;
  stale: boolean;
  trip_reference: string | null;
}

export const useLiveMap = (tenant?: string) =>
  useQuery({
    queryKey: ["platform", "map", tenant ?? "all"],
    queryFn: () => getJson<{ points: MapPoint[]; truncated: boolean }>("/map/", { tenant }),
    retry: false,
    refetchInterval: 30_000,
  });
