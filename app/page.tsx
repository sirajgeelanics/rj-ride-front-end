"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, wsInvalidationMap } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import { useRideEvents } from "@/lib/shared/realtime/ws";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { TrendingUp, Truck, Users, Calendar, AlertCircle, CheckCircle2, Clock, Zap } from "lucide-react";

type BoardCard = components["schemas"]["BoardCard"];
type Driver = components["schemas"]["Driver"];
type Vehicle = components["schemas"]["Vehicle"];

type BoardColumns = {
  PENDING: BoardCard[];
  ASSIGNED: BoardCard[];
  EN_ROUTE_PICKUP: BoardCard[];
  IN_TRANSIT: BoardCard[];
  EXCEPTION: BoardCard[];
  [key: string]: BoardCard[];
};

const EXCEPTION_STATUSES = ["SOS", "BREAKDOWN", "ACCIDENT", "NO_SHOW"];
const ACTIVE_STATUSES = ["ASSIGNED", "EN_ROUTE_PICKUP", "IN_TRANSIT"];

export default function DashboardPage() {
  useRideEvents({ invalidationMap: wsInvalidationMap });

  const { data: boardData, isLoading: boardLoading } = useQuery<{ columns: BoardColumns }>({
    queryKey: keys.dispatch.board(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/dispatch/board", {});
      if (err) throw err;
      return res as unknown as { columns: BoardColumns };
    },
    refetchInterval: 30_000,
  });

  const { data: vehiclesData, isLoading: vehiclesLoading } = useQuery({
    queryKey: keys.fleet.vehicles.list(),
    queryFn: () => fetchAllPages<Vehicle>("/api/v1/fleet/vehicles/"),
    staleTime: 60_000,
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: keys.fleet.drivers.list(),
    queryFn: () => fetchAllPages<Driver>("/api/v1/fleet/drivers/"),
    staleTime: 60_000,
  });

  const columns = boardData?.columns ?? {} as BoardColumns;
  const allCards = ["PENDING", "ASSIGNED", "EN_ROUTE_PICKUP", "IN_TRANSIT", "EXCEPTION"].flatMap(
    (col) => columns[col] ?? []
  );

  const pendingCount = (columns["PENDING"] ?? []).length;
  const activeCount = ACTIVE_STATUSES.flatMap((s) => columns[s] ?? []).length;
  const exceptionCount = allCards.filter((c) => EXCEPTION_STATUSES.includes(c.status)).length;

  const todayStr = new Date().toISOString().split("T")[0] ?? "";
  const todayPickups = allCards.filter((c) => c.pickup_at?.startsWith(todayStr)).length;

  const totalVehicles = vehiclesData?.length ?? 0;
  const activeDrivers = driversData?.filter((d) => d.is_active).length ?? 0;

  const isLoading = boardLoading || vehiclesLoading || driversLoading;

  const kpis = [
    {
      label: "Active Trips",
      value: activeCount,
      icon: TrendingUp,
      color: "bg-brand-blue",
      description: "En route or in transit",
    },
    {
      label: "Pending",
      value: pendingCount,
      icon: Clock,
      color: "bg-[#072D62]",
      description: "Awaiting assignment",
    },
    {
      label: "Fleet Vehicles",
      value: totalVehicles,
      icon: Truck,
      color: "bg-ops-sidebar",
      description: "Registered vehicles",
    },
    {
      label: "Active Drivers",
      value: activeDrivers,
      icon: Users,
      color: "bg-ops-sidebar",
      description: "Available in system",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
      {exceptionCount > 0 && (
        <div role="alert" className="bg-danger-soft border border-danger/25 rounded-2xl p-4 flex items-start gap-3 shadow-soft">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-danger">
              {exceptionCount} active exception{exceptionCount !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-text-secondary mt-0.5">
              SOS / breakdown / no-show events require immediate attention.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white rounded-2xl border border-border shadow-soft p-5 hover-lift">
              <div className="flex items-start justify-between gap-3">
                <p className="eyebrow">{kpi.label}</p>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl surface-navy text-white">
                  <Icon className="w-5 h-5" />
                </span>
              </div>
              <p className="mt-3 text-4xl font-semibold tabular-nums leading-none text-text-primary">
                {isLoading ? <span className="skeleton inline-block h-9 w-14 align-middle" /> : kpi.value}
              </p>
              <p className="mt-2 text-xs text-text-secondary">{kpi.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card padding="lg" header={<h3 className="font-serif text-xl font-medium text-text-primary flex items-center gap-2"><Zap className="w-4 h-4 text-accent-gold" /> Dispatch Board Summary</h3>}>
          {boardLoading ? (
            <div className="space-y-3"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /><div className="skeleton h-4 w-2/3" /></div>
          ) : (
            <div className="space-y-2">
              {[
                { label: "Pending", key: "PENDING", color: "bg-alert-amber" },
                { label: "Assigned", key: "ASSIGNED", color: "bg-brand-blue" },
                { label: "En Route Pickup", key: "EN_ROUTE_PICKUP", color: "bg-[#4F6FA8]" },
                { label: "In Transit", key: "IN_TRANSIT", color: "bg-success" },
                { label: "Exception", key: "EXCEPTION", color: "bg-danger" },
              ].map(({ label, key, color }) => {
                const count = (columns[key] ?? []).length;
                const total = allCards.length || 1;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-32 shrink-0">{label}</span>
                    <div className="flex-1 bg-ops-card2 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${color} h-2 rounded-full transition-all`}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums text-text-primary w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card padding="lg" header={<h3 className="font-serif text-xl font-medium text-text-primary flex items-center gap-2"><Calendar className="w-4 h-4 text-accent-gold" /> Today at a Glance</h3>}>
          {boardLoading ? (
            <div className="space-y-3"><div className="skeleton h-4 w-full" /><div className="skeleton h-4 w-5/6" /><div className="skeleton h-4 w-2/3" /></div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-ops-line">
                <span className="text-sm text-text-secondary">Today&apos;s pickups</span>
                <span className="text-sm font-semibold text-text-primary">{todayPickups}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-ops-line">
                <span className="text-sm text-text-secondary">Active on board</span>
                <span className="text-sm font-semibold text-text-primary">{activeCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-ops-line">
                <span className="text-sm text-text-secondary">Total board cards</span>
                <span className="text-sm font-semibold text-text-primary">{allCards.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-text-secondary">Exceptions</span>
                <span className={`text-sm font-semibold ${exceptionCount > 0 ? "text-danger" : "text-success"}`}>
                  {exceptionCount > 0 ? exceptionCount : <CheckCircle2 className="w-4 h-4 inline" />}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
