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
import { BarChart3, FileText, Receipt, CreditCard, ExternalLink, CheckCircle, DollarSign, XCircle } from "lucide-react";

type BillableTrip = components["schemas"]["BillableTrip"];
type BillingLine = components["schemas"]["BillingLine"];
type Statement = components["schemas"]["Statement"];
type Payout = components["schemas"]["Payout"];

const BILLING_TABS = [
  { id: "invoices", label: "Billable Trips", icon: BarChart3 },
  { id: "statements", label: "Statements", icon: Receipt },
  { id: "payouts", label: "Payouts", icon: CreditCard },
] as const;

type Tab = typeof BILLING_TABS[number]["id"];

function toMinor(display: string, currency: string): number {
  const n = parseFloat(display);
  if (isNaN(n)) return 0;
  const zeroDp = ["JPY", "KRW", "VND"];
  return zeroDp.includes(currency) ? Math.round(n) : Math.round(n * 100);
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("invoices");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Billing</h1>
        <p className="text-sm text-text-secondary mt-1">Billable trips, statements, and payouts from the live API.</p>
      </div>

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
 * The billing total, with the arithmetic that produced it.
 *
 * The price ops see at allotment is the vehicle's `locked_price` (frozen from the Offer at
 * booking). Billing then adds the tenant's operator fee, so the number legitimately differs and
 * looked like an unexplained increase. Adjustments are included because the backend computes
 * total = subtotal + operator_fee + adjustments — leaving them out would print a bracket that
 * does not add up to the total beside it.
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
  const feeLabel = typeof bps === "number" ? `operator fee ${bps / 100}%` : "operator fee";

  return (
    <>
      <span className="font-medium text-text-primary mr-2">
        {formatMoney(trip.total_minor, currency)}
      </span>
      <span className="text-text-tertiary mr-2">
        ({formatMoney(subtotal, currency)} locked + {formatMoney(fee, currency)} {feeLabel}
        {adjustments !== 0 &&
          ` ${adjustments > 0 ? "+" : "−"} ${formatMoney(Math.abs(adjustments), currency)} adjustments`}
        )
      </span>
    </>
  );
}

function BillableTripsTab() {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voidModal, setVoidModal] = useState<{ tripId: string; lineId: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ id: string; currency: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

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

  const adjustMutation = useMutation({
    mutationFn: async ({ id, amount_minor, currency, reason }: { id: string; amount_minor: number; currency: string; reason: string }) => {
      const { error: err } = await apiClient.POST("/v1/billing/billable-trips/{id}/adjust", {
        params: { path: { id } },
        body: { amount_minor, currency, reason } as unknown as BillableTrip,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      addToast("Adjustment applied", "success");
      void qc.invalidateQueries({ queryKey: keys.billing.all() });
      setAdjustModal(null);
      setAdjustAmount("");
      setAdjustReason("");
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Adjustment failed", "error");
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
          {trips.map((trip) => (
            <Card key={trip.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary font-mono">{trip.trip_reference}</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    <TotalBreakdown trip={trip} />
                    <span>{new Date(trip.created_at).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedId(trip.id === selectedId ? null : trip.id)}>
                    <FileText className="w-3 h-3 mr-1" /> Details
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAdjustModal({ id: trip.id, currency: trip.lines?.[0]?.currency ?? "USD" })}
                  >
                    <DollarSign className="w-3 h-3 mr-1" /> Adjust
                  </Button>
                </div>
              </div>

              {selectedId === trip.id && detail && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {(detail.lines as BillingLine[] | undefined)?.map((line, i) => (
                    <div key={line.id ?? i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {line.voided && <Badge variant="red">Voided</Badge>}
                        <span className="text-text-secondary font-mono">{line.trip_vehicle.substring(0, 8)}…</span>
                        <span className="text-text-secondary">{line.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {formatMoney(line.amount_minor, line.currency)}
                        </span>
                        {!line.voided && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger h-auto py-0.5 px-1 text-xs"
                            onClick={() => setVoidModal({ tripId: trip.id, lineId: line.id })}
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 border-t border-border space-y-1">
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
            </Card>
          ))}
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

      {adjustModal && (
        <Modal open title="Add Adjustment" onClose={() => { setAdjustModal(null); setAdjustAmount(""); setAdjustReason(""); }}>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Enter a signed amount (negative for credit, positive for debit) and reason.</p>
            <FormField label={`Amount (${adjustModal.currency})`}>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="-50.00"
              />
            </FormField>
            <FormField label="Reason">
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Toll correction" />
            </FormField>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                disabled={!adjustAmount || !adjustReason.trim() || adjustMutation.isPending}
                onClick={() =>
                  adjustMutation.mutate({
                    id: adjustModal.id,
                    amount_minor: toMinor(adjustAmount, adjustModal.currency),
                    currency: adjustModal.currency,
                    reason: adjustReason.trim(),
                  })
                }
              >
                {adjustMutation.isPending ? "Applying…" : "Apply Adjustment"}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => { setAdjustModal(null); setAdjustAmount(""); setAdjustReason(""); }}>
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
          <Card key={stmt.id} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {stmt.period_year}/{String(stmt.period_month).padStart(2, "0")}
                  {stmt.status && (
                    <Badge
                      variant={stmt.status === "FINAL" ? "green" : "amber"}
                      className="ml-2"
                    >
                      {stmt.status}
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {stmt.total_minor != null && stmt.currency && formatMoney(stmt.total_minor, stmt.currency)}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => downloadMutation.mutate(stmt.id)}
                disabled={downloadMutation.isPending}
              >
                <ExternalLink className="w-3 h-3 mr-1" /> Download
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
          <Card key={payout.id} padding="md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {payout.net_minor != null && payout.currency
                    ? formatMoney(payout.net_minor, payout.currency)
                    : payout.id}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {payout.status && (
                    <Badge
                      variant={payout.status === "PAID" ? "green" : payout.status === "APPROVED" ? "blue" : "amber"}
                      className="mr-2"
                    >
                      {payout.status}
                    </Badge>
                  )}
                  {payout.paid_reference && <span>{payout.paid_reference}</span>}
                  {payout.paid_at && <span className="ml-2">Paid {new Date(payout.paid_at).toLocaleDateString()}</span>}
                  <span className="ml-2">{payout.period_year}/{String(payout.period_month).padStart(2, "0")}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {payout.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => approveMutation.mutate(payout.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                  </Button>
                )}
                {payout.status === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => markPaidMutation.mutate(payout.id)}
                    disabled={markPaidMutation.isPending}
                  >
                    <DollarSign className="w-3 h-3 mr-1" /> Mark Paid
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
