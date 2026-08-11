"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, useSession, useLanguageStore, t } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CalendarCheck, Truck, Users, DollarSign, ArrowRight, Clock, Bell, CircleDollarSign } from "lucide-react";

type Trip = components["schemas"]["TripRequest"];
type Vehicle = components["schemas"]["Vehicle"];
type Driver = components["schemas"]["Driver"];

const ACTIVE_STATUSES = new Set([
  "EN_ROUTE_PICKUP", "AT_PICKUP", "PAX_PICKED", "IN_TRANSIT", "AT_DROP",
]);

const NEEDS_ATTENTION_STATUSES = new Set(["ASSIGNED", "DRIVER_ACCEPTED"]);

export default function DashboardPage() {
  const { user } = useSession();
  const language = useLanguageStore((s) => s.language);

  const { data: trips = [] } = useQuery({
    queryKey: keys.trips.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips", {
        params: { query: {} },
      });
      if (err) throw err;
      return (res?.results ?? []) as Trip[];
    },
    staleTime: 30_000,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: keys.fleet.vehicles.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/vehicles", {});
      if (err) throw err;
      return (res?.results ?? []) as Vehicle[];
    },
    staleTime: 60_000,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: keys.fleet.drivers.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/fleet/drivers", {});
      if (err) throw err;
      return (res?.results ?? []) as Driver[];
    },
    staleTime: 60_000,
  });

  const today = new Date().toDateString();
  const tripsToday = trips.filter((t) => new Date(t.created_at).toDateString() === today).length;
  const activeNow = trips.filter((t) => ACTIVE_STATUSES.has(t.status)).length;
  const needingAttention = trips.filter((t) => NEEDS_ATTENTION_STATUSES.has(t.status));
  const activeTrips = trips.filter((t) => ACTIVE_STATUSES.has(t.status));

  const totalDrivers = drivers.length;
  const availableDrivers = drivers.filter((d) => d.is_active !== false && d.status === "AVAILABLE").length;
  const onTripDrivers = drivers.filter((d) => d.status === "ON_TRIP").length;
  const offlineDrivers = drivers.filter((d) => d.is_active === false || d.status === "OFFLINE").length;

  const availablePct = totalDrivers > 0 ? Math.round((availableDrivers / totalDrivers) * 100) : 0;
  const onTripPct = totalDrivers > 0 ? Math.round((onTripDrivers / totalDrivers) * 100) : 0;
  const offlinePct = totalDrivers > 0 ? Math.round((offlineDrivers / totalDrivers) * 100) : 0;

  const displayName = user?.email?.split("@")[0] ?? "Vendor";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">
          {t("welcomeBack", language)}, {displayName}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          {t("realtimeDataShared", language)}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("tripsToday", language)} value={tripsToday} icon={CalendarCheck} accentColor="text-brand-blue" />
        <KpiCard label={t("activeNow", language)} value={activeNow} icon={Truck} accentColor="text-success" />
        <KpiCard label={t("driversOnDuty", language)} value={availableDrivers} icon={Users} accentColor="text-warning" />
        <KpiCard label="Fleet Vehicles" value={vehicles.filter((v) => v.is_active !== false).length} icon={DollarSign} accentColor="text-brand-blue" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/trips?status=ASSIGNED"
          className="flex items-center gap-3 px-4 py-3 bg-card-bg border border-card-border rounded-xl hover:shadow-md hover:border-brand-blue/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{t("pendingTrips", language)}</p>
            <p className="text-xs text-text-muted">{needingAttention.length} {t("awaitingAction", language)}</p>
          </div>
        </Link>

        <Link
          href="/trips"
          className="flex items-center gap-3 px-4 py-3 bg-card-bg border border-card-border rounded-xl hover:shadow-md hover:border-brand-blue/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
            <Truck className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{t("activeTrips", language)}</p>
            <p className="text-xs text-text-muted">{activeTrips.length} {t("inProgress", language)}</p>
          </div>
        </Link>

        <Link
          href="/alerts"
          className="flex items-center gap-3 px-4 py-3 bg-card-bg border border-card-border rounded-xl hover:shadow-md hover:border-brand-blue/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center group-hover:bg-danger/20 transition-colors">
            <Bell className="w-5 h-5 text-danger" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{t("alerts", language)}</p>
            <p className="text-xs text-text-muted">{t("viewAlerts", language)}</p>
          </div>
        </Link>

        <Link
          href="/earnings"
          className="flex items-center gap-3 px-4 py-3 bg-card-bg border border-card-border rounded-xl hover:shadow-md hover:border-brand-blue/30 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center group-hover:bg-brand-blue/20 transition-colors">
            <CircleDollarSign className="w-5 h-5 text-brand-blue" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{t("earnings", language)}</p>
            <p className="text-xs text-text-muted">{t("viewRevenue", language)}</p>
          </div>
        </Link>
      </div>

      {totalDrivers > 0 && (
        <div className="bg-card-bg border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-text-muted" />
              {t("fleetStatus", language)}
            </h3>
            <span className="text-xs text-text-muted">
              {availableDrivers} {t("of", language)} {totalDrivers} {t("drivers", language)} {t("available", language).toLowerCase()}
            </span>
          </div>

          <div className="h-4 w-full rounded-full overflow-hidden flex">
            {availableDrivers > 0 && (
              <div className="bg-success transition-all duration-500" style={{ width: `${availablePct}%` }} />
            )}
            {onTripDrivers > 0 && (
              <div className="bg-warning transition-all duration-500" style={{ width: `${onTripPct}%` }} />
            )}
            {offlineDrivers > 0 && (
              <div className="bg-text-muted transition-all duration-500" style={{ width: `${offlinePct}%` }} />
            )}
          </div>

          <div className="flex items-center gap-5 mt-3 text-xs text-text-muted">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-success" /><span>{t("available", language)} ({availableDrivers})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-warning" /><span>{t("onTrip", language)} ({onTripDrivers})</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-text-muted" /><span>{t("offline", language)} ({offlineDrivers})</span></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card-bg border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              {t("tripsNeedingAttention", language)}
              {needingAttention.length > 0 && (
                <span className="bg-danger text-white text-xs px-1.5 py-0.5 rounded-full">{needingAttention.length}</span>
              )}
            </h3>
            <Link href="/trips" className="text-xs text-brand-blue hover:underline flex items-center gap-1">
              {t("view", language)} {t("all", language)} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {needingAttention.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">{t("noPendingTrips", language)} ✓</p>
          ) : (
            <div className="space-y-2">
              {needingAttention.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between bg-ops-bg p-3 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-text-muted">{trip.id.slice(0, 8)}</span>
                      <StatusBadge status={trip.status} />
                    </div>
                    <p className="text-xs text-text-muted truncate">{trip.stops?.[0]?.address ?? "—"}</p>
                  </div>
                  <Link href="/trips" className="text-xs text-brand-blue hover:underline shrink-0 ml-4">
                    Acknowledge
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card-bg border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Truck className="w-4 h-4 text-success" />
              {t("activeTrips", language)}
            </h3>
            <Link href="/trips" className="text-xs text-brand-blue hover:underline flex items-center gap-1">
              {t("view", language)} {t("all", language)} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {activeTrips.length === 0 ? (
            <p className="text-sm text-text-muted py-4 text-center">{t("noActiveTrips", language)}</p>
          ) : (
            <div className="space-y-2">
              {activeTrips.slice(0, 5).map((trip) => (
                <div key={trip.id} className="flex items-center justify-between bg-ops-bg p-3 rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-text-muted">{trip.id.slice(0, 8)}</span>
                      <StatusBadge status={trip.status} />
                    </div>
                    <p className="text-xs text-text-muted truncate">{trip.stops?.[0]?.address ?? "—"}</p>
                  </div>
                  <Link href="/trips" className="text-xs text-brand-blue hover:underline shrink-0 ml-4">
                    {t("track", language)}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
