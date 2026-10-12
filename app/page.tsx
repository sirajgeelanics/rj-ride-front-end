"use client";

import React from "react";
import Link from "next/link";
import { Building2, CarFront, Clock3, Route, Truck, Users } from "lucide-react";
import { useAttention, useOverview, useTenants } from "@/lib/api";
import { CATEGORIES } from "@/components/platform/attentionCategories";
import { titleCase } from "@/lib/format";
import { StatCard } from "@/components/platform/StatCard";
import { StatusBadge } from "@/components/platform/StatusBadge";

export default function OverviewPage() {
  const overview = useOverview();
  const tenants = useTenants();
  const attention = useAttention();
  const data = overview.data;
  const byStatus = Object.entries(data?.trips.by_status ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...byStatus.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard tone="navy" label="Tenants" value={data?.tenants ?? "—"} icon={Building2} hint={data ? `${data.active_tenants} active` : undefined} />
        <StatCard tone="blue" label="Vendors" value={data?.vendors ?? "—"} icon={Truck} />
        <StatCard tone="green" label="Vehicles" value={data?.vehicles ?? "—"} icon={CarFront} />
        <StatCard tone="blue" label="Drivers" value={data?.drivers ?? "—"} icon={Users} />
        <StatCard tone="purple" label="Open trips" value={data?.trips.open ?? "—"} icon={Route} hint={data ? `${data.trips.total} total` : undefined} />
        <StatCard tone="amber" label="New in 24h" value={data?.trips.created_last_24h ?? "—"} icon={Clock3} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl font-medium text-text-primary">Needs attention</h2>
          <Link href="/attention" className="text-sm text-brand-blue font-medium hover:underline">See everything</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const n = attention.data?.counts[c.key] ?? 0;
            return (
              <Link
                key={c.key}
                href={`/attention?cat=${c.key}`}
                className={`rounded-2xl border p-4 shadow-soft hover-lift ${n > 0 ? "border-danger/30 bg-danger-soft/40" : "border-border bg-white"}`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${n > 0 ? "bg-danger-soft text-danger" : "bg-ops-card2 text-text-tertiary"}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <p className="font-serif text-3xl mt-2 tabular text-text-primary">{attention.data ? n : "—"}</p>
                <p className="text-xs font-medium text-text-secondary">{c.label}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid xl:grid-cols-[1fr_1.4fr] gap-4">
        <section className="bg-white rounded-2xl border border-border shadow-soft p-5">
          <h2 className="font-serif text-xl font-medium text-text-primary mb-4">Trips by status</h2>
          {byStatus.length === 0 ? (
            <p className="text-sm text-text-secondary">No trips yet.</p>
          ) : (
            <ul className="space-y-3">
              {byStatus.map(([status, n]) => (
                <li key={status}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <Link href={`/trips?status=${status}`} className="hover:underline">
                      <StatusBadge status={status} />
                    </Link>
                    <span className="tabular font-medium text-text-primary">{n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ops-card2 overflow-hidden" aria-label={titleCase(status)}>
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-blue to-[#2F5FA8]" style={{ width: `${(n / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-border shadow-soft overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-ops-line">
            <h2 className="font-serif text-xl font-medium text-text-primary">Tenants</h2>
            <Link href="/tenants" className="text-sm text-brand-blue font-medium hover:underline">View all</Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="px-5 py-2.5 font-semibold">Tenant</th>
                <th className="px-3 py-2.5 font-semibold text-right">Vendors</th>
                <th className="px-3 py-2.5 font-semibold text-right">Trips</th>
                <th className="px-5 py-2.5 font-semibold text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {(tenants.data ?? []).slice(0, 8).map((t) => (
                <tr key={t.id} className="border-t border-ops-line hover:bg-ops-bg/60 transition-colors">
                  <td className="px-5 py-2.5">
                    <Link href={`/tenants/${t.id}`} className="font-medium text-text-primary hover:underline">{t.name}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular">{t.vendors}</td>
                  <td className="px-3 py-2.5 text-right tabular">{t.trips}</td>
                  <td className="px-5 py-2.5 text-right tabular">{t.open_trips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
