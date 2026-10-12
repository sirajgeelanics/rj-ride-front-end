"use client";

import React, { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, Clock, Gauge, Route, Search, ShieldAlert, Timer, Users, Wallet } from "lucide-react";
import { useVendorFleet, useVendorPerformance } from "@/lib/api";
import { Section, EmptyRow, row, th, thHead } from "@/components/platform/Section";
import { DriverTable, VehicleTable } from "@/components/platform/FleetTables";
import { ActionLink } from "@/components/platform/ActionLink";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/platform/StatCard";

type Tab = "vehicles" | "drivers";

export default function VendorFleetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useVendorFleet(id);
  const perf = useVendorPerformance(id).data;
  const [tab, setTab] = useState<Tab>("vehicles");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();

  const vehicles = useMemo(
    () =>
      (data?.vehicles ?? []).filter((v) =>
        `${v.plate} ${v.vehicle_type} ${v.vehicle_name ?? ""} ${v.airport_code}`.toLowerCase().includes(needle),
      ),
    [data, needle],
  );
  const drivers = useMemo(
    () =>
      (data?.drivers ?? []).filter((d) => `${d.name} ${d.airport_code}`.toLowerCase().includes(needle)),
    [data, needle],
  );

  if (isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (error || !data) return <p className="text-sm text-danger">Vendor not found.</p>;
  const { vendor, summary } = data;

  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "vehicles", label: "Vehicles", n: summary.vehicles },
    { key: "drivers", label: "Drivers", n: summary.drivers },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/tenants/${vendor.tenant.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4" /> {vendor.tenant.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h2 className="font-serif text-3xl font-medium text-text-primary">{vendor.name}</h2>
          {vendor.airport_code && (
            <span className="font-mono text-xs px-2 py-1 rounded-md bg-ops-card2">{vendor.airport_code}</span>
          )}
          <ActionLink href={`/trips?tenant=${vendor.tenant.id}&vendor=${vendor.id}`} tone="gold">
            View trips
          </ActionLink>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard tone="green" label="Vehicles" value={summary.vehicles} icon={CarFront} hint={`${summary.vehicles_active} active · ${summary.vehicles_on_trip} on trip`} />
        <StatCard tone="blue" label="Drivers" value={summary.drivers} icon={Users} hint={`${summary.drivers_available} available · ${summary.drivers_without_login} no login`} />
        <StatCard tone="navy" label="Live trips" value={summary.live_trips} icon={Route} />
        <StatCard
          tone={summary.documents_expired > 0 ? "red" : summary.documents_expiring > 0 ? "amber" : "green"}
          label="Documents"
          value={summary.documents_expired + summary.documents_expiring}
          icon={ShieldAlert}
          hint={`${summary.documents_expired} expired · ${summary.documents_expiring} within ${data.warning_days} days`}
        />
      </div>

      {perf && <PerformanceBlock perf={perf} />}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === x.key ? "text-brand-blue" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {x.label} <span className="text-text-tertiary tabular">{x.n}</span>
              {tab === x.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent-gold" />}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === "vehicles" ? "Search plate, type or airport…" : "Search driver name…"}
            className="w-full h-10 pl-10 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
        </div>
      </div>

      {data.truncated && (
        <p className="text-xs text-text-secondary">Showing the first 1,000 of this vendor&apos;s records.</p>
      )}

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-x-auto">
        {tab === "vehicles" ? (
          <VehicleTable vehicles={vehicles} emptyText={needle ? "No vehicles match." : "This vendor has no vehicles."} />
        ) : (
          <DriverTable drivers={drivers} emptyText={needle ? "No drivers match." : "This vendor has no drivers."} />
        )}
      </div>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function minutesText(v: number | null): string {
  if (v === null) return "—";
  return v >= 90 ? `${(v / 60).toFixed(1)} h` : `${Math.round(v)} min`;
}

function pctText(v: number | null): string {
  return v === null ? "—" : `${v}%`;
}

function PerformanceBlock({ perf }: { perf: import("@/lib/api").VendorPerformance }) {
  const rate = perf.on_time.rate_pct;
  const revenue = perf.revenue.map((r) => r.amount).join(" · ") || "—";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          tone={rate === null ? "grey" : rate >= 90 ? "green" : rate >= 70 ? "amber" : "red"}
          label="On-time pickups"
          value={pctText(rate)}
          icon={Clock}
          hint={`${perf.on_time.on_time} of ${perf.on_time.measured} within ${perf.grace_minutes} min · ${perf.window_days} days`}
        />
        <StatCard
          tone="blue"
          label="Time to allot"
          value={minutesText(perf.time_to_allot.avg_minutes)}
          icon={Timer}
          hint={`median ${minutesText(perf.time_to_allot.median_minutes)} · ${perf.time_to_allot.measured} requests`}
        />
        <StatCard
          tone="navy"
          label="Fleet used"
          value={pctText(perf.utilisation.used_pct)}
          icon={Gauge}
          hint={`${perf.utilisation.vehicles_used} of ${perf.utilisation.vehicles} vehicles · ${perf.utilisation.window_days} days`}
        />
        <StatCard
          tone="purple"
          label="Completed trip value"
          value={revenue}
          icon={Wallet}
          hint={`${perf.completed} completed · ${perf.window_days} days`}
        />
      </div>
      {perf.payouts.length > 0 && (
        <Section title="Payouts" hint="Latest six monthly payouts for this vendor.">
          <table className="w-full text-sm">
            <thead>
              <tr className={thHead}>
                <th className="px-5 py-3 font-semibold">Month</th>
                <th className={th}>Status</th>
                <th className={th}>Gross</th>
                <th className={th}>Operator fee</th>
                <th className="px-5 py-3 font-semibold">Net</th>
              </tr>
            </thead>
            <tbody>
              {perf.payouts.map((p) => (
                <tr key={`${p.year}-${p.month}`} className={row}>
                  <td className="px-5 py-3 tabular">{MONTHS[p.month - 1]} {p.year}</td>
                  <td className="px-3 py-3"><Badge variant={p.status === "PAID" ? "green" : "amber"}>{p.status}</Badge></td>
                  <td className="px-3 py-3 tabular">{p.gross}</td>
                  <td className="px-3 py-3 tabular">{p.operator_fee}</td>
                  <td className="px-5 py-3 tabular font-medium">{p.net}</td>
                </tr>
              ))}
              {perf.payouts.length === 0 && <EmptyRow cols={5} text="No payouts yet." />}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}
