"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ListFilterBar, EMPTY_FILTERS, type ListFilters } from "@/components/ui/ListFilterBar";
import { useCursorPagination } from "@/hooks/useCursorPagination";
import { useDebounced } from "@/hooks/useDebounced";
import { BarChart3, FileText, Receipt, CreditCard, ExternalLink, CheckCircle, DollarSign, XCircle, ChevronDown, ChevronUp, Calendar, Building2, Car } from "lucide-react";

type BillableTrip = components["schemas"]["BillableTrip"];
interface FareBreakdownLine {
  code: string;
  description: string;
  amount_minor: number;
}
interface FareBreakdown {
  basis: string;
  currency: string;
  lines: FareBreakdownLine[];
  subtotal_minor: number;
  total_minor: number;
}
// vendor_name/vehicle_type_name/vehicle_plate/pickup_at/distance_km/fare_breakdown aren't in the
// generated schema yet (a new backend addition) — same stale-schema workaround used elsewhere in
// this codebase: intersect them in rather than risk a full schema regen as a side effect.
type BillingLine = components["schemas"]["BillingLine"] & {
  vendor_name: string | null;
  vehicle_type_name: string | null;
  vehicle_plate: string | null;
  pickup_at: string | null;
  distance_km: string | null;
  fare_breakdown: FareBreakdown | null;
};
type Statement = components["schemas"]["Statement"];
type Payout = components["schemas"]["Payout"];

const BILLING_TABS = [
  { id: "invoices", label: "Billable Trips", icon: BarChart3 },
  { id: "statements", label: "Statements", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: CreditCard },
] as const;

type Tab = typeof BILLING_TABS[number]["id"];

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("invoices");

  return (
    <div className="p-6 space-y-6">

      <div className="flex gap-1 border-b border-border pb-px">
        {BILLING_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-t-lg ${
                activeTab === tab.id
                  ? "bg-ops-sidebar text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-ops-bg"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "invoices" && <BillableTripsTab />}
      {activeTab === "statements" && <StatementsTab />}
      {activeTab === "payouts" && <PayoutsTab />}
    </div>
  );
}

/**
 * The arithmetic behind the billing total — deliberately kept small/muted, not hidden: the
 * price ops see at allotment is the vehicle's `locked_price` (frozen from the Offer at booking).
 * Billing then adds the tenant's operator fee, so the number legitimately differs and would
 * otherwise look like an unexplained increase. Adjustments are included because the backend
 * computes total = subtotal + operator_fee + adjustments — leaving them out would print a
 * bracket that does not add up to the total beside it.
 */
function TotalBreakdown({ trip }: { trip: BillableTrip }) {
  if (trip.total_minor == null) return null;
  const currency = trip.lines?.[0]?.currency ?? "USD";
  const subtotal = trip.subtotal_minor ?? 0;
  const fee = trip.operator_fee_minor ?? 0;
  const adjustments = (trip.adjustments ?? []).reduce(
    (sum, a) => sum + ((a as { amount_minor?: number }).amount_minor ?? 0),
    0,
  );
  const bps = (trip.fee_config_snapshot as { bps?: number } | null | undefined)?.bps;
  const feeLabel = typeof bps === "number" ? `fee ${bps / 100}%` : "fee";

  return (
    <span>
      {formatMoney(subtotal, currency)} locked + {formatMoney(fee, currency)} {feeLabel}
      {adjustments !== 0 &&
        ` ${adjustments > 0 ? "+" : "−"} ${formatMoney(Math.abs(adjustments), currency)} adj.`}
    </span>
  );
}

function BillableTripsTab() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  // selectedId drives which trip's detail is fetched/kept in the query cache; openId drives only
  // the visual expand/collapse. Kept separate deliberately: clearing selectedId on close would
  // change the query key to detail("") and null out `detail` in the very same render as the
  // close click, so the CSS collapse below would have no content left to animate away from —
  // it'd just snap shut. Closing only touches openId, so `detail` stays populated through the
  // whole collapse transition (and after, until a different trip is opened).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [voidModal, setVoidModal] = useState<{ tripId: string; lineId: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  // Debounced so typing doesn't fire a request per keystroke.
  const search = useDebounced(filters.search, 300);

  const query = {
    ...(search ? { search } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
  };
  const isFiltered = Object.keys(query).length > 0;

  const { data, isLoading } = useQuery({
    // Cursor and filters are part of the key: without them every page/filter overwrites the same
    // cache entry and React Query serves stale rows while the new request is in flight.
    queryKey: keys.billing.invoices.list({ cursor, ...query }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/billable-trips", {
        params: { query: { ...query, ...(cursor ? { cursor } : {}) } },
      });
      if (err) throw err;
      return res;
    },
    placeholderData: (prev) => prev,
  });

  const page = useCursorPagination((data as { next?: string | null } | undefined)?.next);
  useEffect(() => setCursor(page.cursor), [page.cursor]);

  // Changing a filter must send you back to page 1 — page 3's cursor is meaningless against a
  // different result set.
  const applyFilters = (next: ListFilters) => {
    setFilters(next);
    page.reset();
  };

  const { data: detail } = useQuery<BillableTrip | null>({
    queryKey: keys.billing.invoices.detail(selectedId ?? ""),
    queryFn: async () => {
      if (!selectedId) return null;
      const { data: res, error: err } = await apiClient.GET("/v1/billing/billable-trips/{id}", {
        params: { path: { id: selectedId } },
      });
      if (err) throw err;
      return (res ?? null) as BillableTrip | null;
    },
    enabled: !!selectedId,
  });

  const voidMutation = useMutation({
    mutationFn: async ({ tripId, lineId, reason }: { tripId: string; lineId: string; reason: string }) => {
      const { error: err } = await apiClient.POST("/v1/billing/billable-trips/{id}/lines/{line_pk}/void", {
        params: { path: { id: tripId, line_pk: lineId } },
        body: { reason } as unknown as BillableTrip,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      addToast("Line voided", "success");
      void qc.invalidateQueries({ queryKey: keys.billing.all() });
      setVoidModal(null);
      setVoidReason("");
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Void failed", "error");
    },
  });

  // Derived once for the expanded detail panel's itemised total.
  const detailCurrency = detail?.lines?.[0]?.currency ?? "USD";
  const detailBps = (detail?.fee_config_snapshot as { bps?: number } | null | undefined)?.bps;
  const detailAdjustments = (detail?.adjustments ?? []).reduce(
    (sum, a) => sum + ((a as { amount_minor?: number }).amount_minor ?? 0),
    0,
  );

  const trips = ((data as { results?: BillableTrip[] } | undefined)?.results ?? (data as BillableTrip[] | undefined) ?? []);

  return (
    <div className="space-y-4">
      <ListFilterBar value={filters} onChange={applyFilters} searchPlaceholder="Search by trip reference…" />

      {isLoading ? (
        <p className="text-sm text-text-secondary text-center py-8">Loading billable trips…</p>
      ) : trips.length === 0 ? (
        <Card padding="lg" className="text-center py-8 text-text-secondary">
          {isFiltered ? "No billable trips match these filters." : "No billable trips yet."}
        </Card>
      ) : (
        <div className="space-y-2">
          {trips.map((trip) => {
            const tripLines = (trip.lines as BillingLine[] | undefined) ?? [];
            const vendorNames = [...new Set(tripLines.map((l) => l.vendor_name).filter(Boolean))];
            const cars = tripLines
              .map((l) => [l.vehicle_type_name, l.vehicle_plate].filter(Boolean).join(" · "))
              .filter(Boolean);
            const pickupAt = tripLines.find((l) => l.pickup_at)?.pickup_at;
            const isOpen = openId === trip.id;
            return (
            <Card key={trip.id} padding="md" className="hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-text-primary font-mono">{trip.trip_reference}</span>
                    <span className="text-xs text-text-tertiary">{new Date(trip.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {pickupAt && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                        <Calendar className="w-3 h-3" /> {new Date(pickupAt).toLocaleString()}
                      </span>
                    )}
                    {vendorNames.map((v) => (
                      <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs font-medium">
                        <Building2 className="w-3 h-3" /> {v}
                      </span>
                    ))}
                    {cars.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-mono">
                        <Car className="w-3 h-3 text-accent-gold" /> {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-lg font-semibold text-text-primary whitespace-nowrap">
                    {trip.total_minor != null ? formatMoney(trip.total_minor, trip.lines?.[0]?.currency ?? "USD") : "—"}
                  </span>
                  <span className="text-[11px] text-text-tertiary text-right leading-tight max-w-[240px]">
                    <TotalBreakdown trip={trip} />
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (isOpen) {
                        setOpenId(null);
                      } else {
                        setOpenId(trip.id);
                        setSelectedId(trip.id);
                      }
                    }}
                  >
                    {isOpen ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" /> Hide
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5" /> Details
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* CSS-grid expand trick (0fr -> 1fr) so the box opens/closes smoothly without
                  measuring content height in JS — overflow-hidden clips it mid-transition. */}
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
              <div className="overflow-hidden">
              {selectedId === trip.id && detail && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {(detail.lines as BillingLine[] | undefined)?.map((line, i) => (
                    <div key={line.id ?? i} className="rounded-lg border border-border p-2.5 text-xs bg-white">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {line.voided && <Badge variant="red">Voided</Badge>}
                          <span className="text-sm font-medium text-text-primary">{line.vendor_name ?? "Unassigned"}</span>
                          <span className="text-text-tertiary" title={line.trip_vehicle}>{line.status}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {formatMoney(line.amount_minor, line.currency)}
                          </span>
                          {!line.voided && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger h-auto py-0.5 px-1"
                              onClick={() => setVoidModal({ tripId: trip.id, lineId: line.id })}
                              title="Void this line"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {(line.vehicle_type_name || line.vehicle_plate) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-gold/15 text-text-primary text-xs font-mono">
                            <Car className="w-3 h-3 text-accent-gold" />
                            {[line.vehicle_type_name, line.vehicle_plate].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {line.pickup_at && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                            <Calendar className="w-3 h-3" /> {new Date(line.pickup_at).toLocaleString()}
                          </span>
                        )}
                        {line.distance_km && (
                          <span className="px-2 py-0.5 rounded-full bg-ops-card2 text-text-secondary text-xs">
                            {line.distance_km} km
                          </span>
                        )}
                      </div>
                      {line.fare_breakdown && (
                        <div className="mt-2 p-2 rounded-md bg-ops-card2 space-y-0.5">
                          {line.fare_breakdown.lines.map((fl, fi) => (
                            <div key={fi} className="flex justify-between text-text-secondary">
                              <span>{fl.description}</span>
                              <span>{formatMoney(fl.amount_minor, line.fare_breakdown!.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="pt-1 space-y-1">
                    {/* Itemised so the gap between the allotment price and the billed total is
                        explicit rather than something ops has to work out. */}
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>Locked price (allotment)</span>
                      <span>{formatMoney(detail.subtotal_minor ?? 0, detailCurrency)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span>
                        Operator fee
                        {typeof detailBps === "number" ? ` (${detailBps / 100}%)` : ""}
                      </span>
                      <span>+ {formatMoney(detail.operator_fee_minor ?? 0, detailCurrency)}</span>
                    </div>
                    {detailAdjustments !== 0 && (
                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>Adjustments</span>
                        <span>
                          {detailAdjustments > 0 ? "+" : "−"}{" "}
                          {formatMoney(Math.abs(detailAdjustments), detailCurrency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold pt-1 border-t border-border">
                      <span>Total</span>
                      <span>
                        {detail.total_minor != null
                          ? formatMoney(detail.total_minor, detailCurrency)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {voidModal && (
        <Modal open title="Void Line" onClose={() => { setVoidModal(null); setVoidReason(""); }}>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Provide a reason for voiding this billing line.</p>
            <FormField label="Reason">
              <Input value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate charge" />
            </FormField>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1 text-danger"
                disabled={!voidReason.trim() || voidMutation.isPending}
                onClick={() => voidMutation.mutate({ tripId: voidModal.tripId, lineId: voidModal.lineId, reason: voidReason.trim() })}
              >
                {voidMutation.isPending ? "Voiding…" : "Confirm Void"}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => { setVoidModal(null); setVoidReason(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Pagination page={page} count={trips.length} itemLabel="trip" />
    </div>
  );
}

function StatementsTab() {
  const addToast = useToastStore((s) => s.addToast);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  // Debounced so typing doesn't fire a request per keystroke.
  const search = useDebounced(filters.search, 300);

  const query = {
    ...(search ? { search } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
  };
  const isFiltered = Object.keys(query).length > 0;

  const { data, isLoading } = useQuery({
    // Cursor and filters are part of the key: without them every page/filter overwrites the same
    // cache entry and React Query serves stale rows while the new request is in flight.
    queryKey: keys.billing.statements.list({ cursor, ...query }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/statements", {
        params: { query: { ...query, ...(cursor ? { cursor } : {}) } },
      });
      if (err) throw err;
      return res;
    },
    placeholderData: (prev) => prev,
  });

  const page = useCursorPagination((data as { next?: string | null } | undefined)?.next);
  useEffect(() => setCursor(page.cursor), [page.cursor]);

  // Changing a filter must send you back to page 1 — page 3's cursor is meaningless against a
  // different result set.
  const applyFilters = (next: ListFilters) => {
    setFilters(next);
    page.reset();
  };

  const downloadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/statements/{id}/download", {
        params: { path: { id } },
      });
      if (err) throw err;
      return (res as unknown as { url?: string } | undefined)?.url;
    },
    onSuccess: (url) => {
      if (url) window.open(url, "_blank");
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Download failed", "error");
    },
  });

  const statements = ((data as { results?: Statement[] } | undefined)?.results ?? (data as Statement[] | undefined) ?? []);

  return (
    <div className="space-y-2">
      <ListFilterBar value={filters} onChange={applyFilters} searchPlaceholder="Search by vendor or customer…" />

      {isLoading ? (
        <p className="text-sm text-text-secondary text-center py-8">Loading statements…</p>
      ) : statements.length === 0 ? (
        <Card padding="lg" className="text-center py-8 text-text-secondary">
          {isFiltered ? "No statements match these filters." : "No statements yet."}
        </Card>
      ) : (
        statements.map((stmt) => (
          <Card key={stmt.id} padding="md" className="hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ops-card2 text-text-primary text-sm font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {stmt.period_year}/{String(stmt.period_month).padStart(2, "0")}
                </span>
                {stmt.status && (
                  <Badge variant={stmt.status === "FINAL" ? "green" : "amber"}>{stmt.status}</Badge>
                )}
                {stmt.total_minor != null && stmt.currency && (
                  <span className="text-sm font-semibold text-text-primary">
                    {formatMoney(stmt.total_minor, stmt.currency)}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadMutation.mutate(stmt.id)}
                disabled={downloadMutation.isPending}
              >
                <ExternalLink className="w-3.5 h-3.5" /> Download
              </Button>
            </div>
          </Card>
        ))
      )}

      <Pagination page={page} count={statements.length} itemLabel="statement" />
    </div>
  );
}

function PayoutsTab() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  // Debounced so typing doesn't fire a request per keystroke.
  const search = useDebounced(filters.search, 300);

  const query = {
    ...(search ? { search } : {}),
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
  };
  const isFiltered = Object.keys(query).length > 0;

  const { data, isLoading } = useQuery({
    // Cursor and filters are part of the key: without them every page/filter overwrites the same
    // cache entry and React Query serves stale rows while the new request is in flight.
    queryKey: keys.billing.payouts.list({ cursor, ...query }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/payouts", {
        params: { query: { ...query, ...(cursor ? { cursor } : {}) } },
      });
      if (err) throw err;
      return res;
    },
    placeholderData: (prev) => prev,
  });

  const page = useCursorPagination((data as { next?: string | null } | undefined)?.next);
  useEffect(() => setCursor(page.cursor), [page.cursor]);

  // Changing a filter must send you back to page 1 — page 3's cursor is meaningless against a
  // different result set.
  const applyFilters = (next: ListFilters) => {
    setFilters(next);
    page.reset();
  };

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.POST("/v1/billing/payouts/{id}/approve", {
        params: { path: { id } },
        body: {} as unknown as Payout,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      addToast("Payout approved", "success");
      void qc.invalidateQueries({ queryKey: keys.billing.payouts.list({}) });
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Approve failed", "error");
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.POST("/v1/billing/payouts/{id}/mark-paid", {
        params: { path: { id } },
        body: {} as unknown as Payout,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      addToast("Payout marked as paid", "success");
      void qc.invalidateQueries({ queryKey: keys.billing.payouts.list({}) });
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Mark paid failed", "error");
    },
  });

  const payouts = ((data as { results?: Payout[] } | undefined)?.results ?? (data as Payout[] | undefined) ?? []);

  return (
    <div className="space-y-2">
      <ListFilterBar value={filters} onChange={applyFilters} searchPlaceholder="Search by vendor…" />

      {isLoading ? (
        <p className="text-sm text-text-secondary text-center py-8">Loading payouts…</p>
      ) : payouts.length === 0 ? (
        <Card padding="lg" className="text-center py-8 text-text-secondary">
          {isFiltered ? "No payouts match these filters." : "No payouts yet."}
        </Card>
      ) : (
        payouts.map((payout) => (
          <Card key={payout.id} padding="md" className="hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
                  {payout.net_minor != null && payout.currency
                    ? formatMoney(payout.net_minor, payout.currency)
                    : payout.id}
                </span>
                {payout.status && (
                  <Badge variant={payout.status === "PAID" ? "green" : payout.status === "APPROVED" ? "blue" : "amber"}>
                    {payout.status}
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ops-card2 text-text-secondary text-xs">
                  <Calendar className="w-3 h-3" />
                  {payout.period_year}/{String(payout.period_month).padStart(2, "0")}
                </span>
                {payout.paid_reference && <span className="text-xs text-text-tertiary font-mono">{payout.paid_reference}</span>}
                {payout.paid_at && (
                  <span className="text-xs text-text-tertiary">Paid {new Date(payout.paid_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {payout.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => approveMutation.mutate(payout.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </Button>
                )}
                {payout.status === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => markPaidMutation.mutate(payout.id)}
                    disabled={markPaidMutation.isPending}
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Mark Paid
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))
      )}

      <Pagination page={page} count={payouts.length} itemLabel="payout" />
    </div>
  );
}
