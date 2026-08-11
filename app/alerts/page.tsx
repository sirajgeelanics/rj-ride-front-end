"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient, csrfFetch, keys, useLanguageStore, t } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Bell, AlertCircle, CheckCircle, Truck, Users, Clock, Inbox } from "lucide-react";

type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

type LocalAlert = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  message: string;
  entityType: "vehicle" | "driver";
  daysRemaining?: number;
};

/** An offer still awaiting this vendor's response. Mirrors the rows on /offers. */
interface OpenOffer {
  id: string;
  reference: string;
  vehicle_type: string;
  pickup: string | null;
  drop: string | null;
  round: number;
  status: "OFFERED" | "ALERTED";
  expires_at: string;
}

/** A recorded in-app notification (GET /api/v1/notifications/). */
interface InAppNotification {
  id: string;
  template_key: string;
  body_rendered: string;
  created_at: string;
  sent_at: string | null;
}

function countdown(iso: string, now: number): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

function relativeTime(iso: string, now: number): string {
  const secs = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** A ticking clock, so countdowns and "5m ago" stay honest without a refetch. */
function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Offers still open. The endpoint only ever returns unresolved offers, so an entry disappears by
 * itself the moment it is accepted, expires or is withdrawn — the list needs no reconciliation.
 * Shares the ["vendor","offers"] key with the Offers screen and the sidebar badge, so the WS
 * invalidation in app/layout.tsx refreshes all three at once.
 */
function useOpenOffers() {
  return useQuery({
    queryKey: ["vendor", "offers"],
    queryFn: async (): Promise<OpenOffer[]> => {
      const resp = await csrfFetch("/api/v1/vendor/offers/", { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load offers (${resp.status})`);
      const body = (await resp.json()) as { results?: OpenOffer[] };
      return body.results ?? [];
    },
    refetchInterval: 15_000,
  });
}

/** The recorded notification history — this is where alerts land and persist. */
function useNotifications() {
  return useQuery({
    queryKey: ["notifications", "mine"],
    queryFn: async (): Promise<InAppNotification[]> => {
      const resp = await csrfFetch("/api/v1/notifications/", { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load notifications (${resp.status})`);
      const body = (await resp.json()) as { results?: InAppNotification[] };
      return body.results ?? [];
    },
    refetchInterval: 30_000,
  });
}

function OpenOffersSection({ offers, now }: { offers: OpenOffer[]; now: number }) {
  if (offers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Awaiting your response</h3>
        <span className="text-xs text-text-muted">
          {offers.length} open offer{offers.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-3">
        {offers.map((o) => {
          const alerted = o.status === "ALERTED";
          const left = countdown(o.expires_at, now);
          return (
            <Link
              key={o.id}
              href="/offers"
              className={`block rounded-xl p-4 border transition-colors hover:border-brand-blue/50 ${
                alerted ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Inbox className={`w-4 h-4 ${alerted ? "text-danger" : "text-warning"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">
                      {alerted ? "Offer alert" : "Trip offer"} · {o.reference}
                    </p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        alerted ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"
                      }`}
                    >
                      {o.status}
                    </span>
                    {o.vehicle_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-medium">
                        {o.vehicle_type}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {alerted
                      ? "The agency has nudged you — this offer is still unanswered."
                      : "Assign a vehicle and driver to accept."}
                    {o.pickup && o.drop && ` · ${o.pickup} → ${o.drop}`}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className={`w-3 h-3 ${left === "expired" ? "text-danger" : "text-text-muted"}`} />
                    <span
                      className={`text-xs font-mono ${left === "expired" ? "text-danger" : "text-text-muted"}`}
                    >
                      {left === "expired" ? "expired" : `${left} left`}
                    </span>
                    <span className="text-xs text-text-muted">· round {o.round}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NotificationsSection({ items, now }: { items: InAppNotification[]; now: number }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted py-4">Nothing yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const isAlert = n.template_key === "vendor_offer_alert";
            return (
              <div
                key={n.id}
                className={`rounded-xl p-3 border ${
                  isAlert ? "border-danger/20 bg-danger/5" : "border-card-border bg-card-bg"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${isAlert ? "text-danger" : "text-text-muted"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{n.body_rendered}</p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {relativeTime(n.sent_at ?? n.created_at, now)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function computeDocAlerts(vehicles: Vehicle[], drivers: Driver[]): LocalAlert[] {
  const alerts: LocalAlert[] = [];
  for (const v of vehicles) {
    if (v.is_active === false) {
      alerts.push({
        id: `vehicle-inactive-${v.id}`,
        severity: "MEDIUM",
        title: "Vehicle inactive",
        message: `${v.plate} is currently marked as inactive`,
        entityType: "vehicle",
      });
    }
  }

  for (const d of drivers) {
    if (d.is_active === false) {
      alerts.push({
        id: `driver-inactive-${d.id}`,
        severity: "LOW",
        title: "Driver inactive",
        message: `${d.name} is currently inactive`,
        entityType: "driver",
      });
    } else if (d.status !== "AVAILABLE") {
      alerts.push({
        id: `driver-unavailable-${d.id}`,
        severity: "LOW",
        title: "Driver unavailable",
        message: `${d.name} is not currently available`,
        entityType: "driver",
      });
    }
  }

  return alerts.sort((a, b) => {
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });
}

function severityStyle(severity: string) {
  if (severity === "HIGH") return "border-danger/30 bg-danger/5";
  if (severity === "MEDIUM") return "border-warning/30 bg-warning/5";
  return "border-border bg-card-bg";
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "HIGH") return <AlertCircle className="w-4 h-4 text-danger" />;
  if (severity === "MEDIUM") return <AlertCircle className="w-4 h-4 text-warning" />;
  return <Bell className="w-4 h-4 text-text-muted" />;
}

export default function AlertsPage() {
  const language = useLanguageStore((s) => s.language);

  const { data: vehicles = [] } = useQuery({
    queryKey: keys.fleet.vehicles.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {});
      if (err) throw err;
      return (res?.results ?? []) as Vehicle[];
    },
  });

  const { data: drivers = [] } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
  });

  const { data: openOffers = [] } = useOpenOffers();
  const { data: notifications = [] } = useNotifications();
  const now = useNow();

  const alerts = computeDocAlerts(vehicles, drivers);

  // An unresolved offer is the most urgent thing a vendor can have, so it counts as HIGH
  // alongside the fleet alerts rather than sitting in a section the counters ignore.
  const highCount = alerts.filter((a) => a.severity === "HIGH").length + openOffers.length;
  const mediumCount = alerts.filter((a) => a.severity === "MEDIUM").length;
  const totalCount = alerts.length + openOffers.length;
  const isPageEmpty = totalCount === 0 && notifications.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{t("alerts", language)}</h2>
        <p className="text-sm text-text-muted mt-1">
          Open offers, notifications and fleet status
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 border ${highCount > 0 ? "bg-danger/5 border-danger/20" : "bg-card-bg border-card-border"}`}>
          <p className="text-xs text-text-muted uppercase tracking-wider">High</p>
          <p className={`text-2xl font-bold mt-1 ${highCount > 0 ? "text-danger" : "text-text-primary"}`}>{highCount}</p>
        </div>
        <div className={`rounded-xl p-4 border ${mediumCount > 0 ? "bg-warning/5 border-warning/20" : "bg-card-bg border-card-border"}`}>
          <p className="text-xs text-text-muted uppercase tracking-wider">Medium</p>
          <p className={`text-2xl font-bold mt-1 ${mediumCount > 0 ? "text-warning" : "text-text-primary"}`}>{mediumCount}</p>
        </div>
        <div className="rounded-xl p-4 border bg-card-bg border-card-border">
          <p className="text-xs text-text-muted uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{totalCount}</p>
        </div>
      </div>

      <OpenOffersSection offers={openOffers} now={now} />

      <NotificationsSection items={notifications} now={now} />

      <h3 className="text-sm font-semibold text-text-primary">Fleet status</h3>

      {alerts.length === 0 ? (
        // The full-height all-clear only when the whole page is genuinely empty; otherwise it
        // dwarfs the offers and notifications above it.
        isPageEmpty ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7 text-success" />
            </div>
            <p className="text-text-muted text-sm">No alerts — you are all caught up</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle className="w-4 h-4 text-success shrink-0" />
            <p className="text-sm text-text-muted">No fleet alerts — your fleet is in good shape</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className={`rounded-xl p-4 border ${severityStyle(alert.severity)}`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <SeverityIcon severity={alert.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">{alert.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      alert.severity === "HIGH" ? "bg-danger/10 text-danger" :
                      alert.severity === "MEDIUM" ? "bg-warning/10 text-warning" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {alert.severity}
                    </span>
                    <div className="flex items-center gap-1">
                      {alert.entityType === "vehicle" ? (
                        <Truck className="w-3 h-3 text-text-muted" />
                      ) : (
                        <Users className="w-3 h-3 text-text-muted" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-text-muted mt-1">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
