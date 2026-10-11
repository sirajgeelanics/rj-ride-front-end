"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTenants } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";

const pct = (v: number | null) => (v === null ? <span className="text-text-tertiary">—</span> : `${v}%`);

export default function TenantsPage() {
  const { data, isLoading, error } = useTenants();
  const [q, setQ] = useState("");
  const rows = useMemo(
    () =>
      (data ?? []).filter((t) =>
        `${t.name} ${t.ritmo_tenant_code} ${t.slug}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [data, q],
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tenants or RITMO code…"
          className="w-full h-10 pl-10 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
        />
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary bg-ops-bg/60">
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className="px-3 py-3 font-semibold">RITMO code</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold text-right">Vendors</th>
              <th className="px-3 py-3 font-semibold text-right">Vehicles</th>
              <th className="px-3 py-3 font-semibold text-right">Drivers</th>
              <th className="px-3 py-3 font-semibold text-right">Trips</th>
              <th className="px-3 py-3 font-semibold text-right">Open</th>
              <th className="px-3 py-3 font-semibold text-right" title="Completed vs cancelled, last 7 days">Completion 7d</th>
              <th className="px-3 py-3 font-semibold text-right" title="Accepted RITMO trips whose status reached RITMO">RITMO sync</th>
              <th className="px-3 py-3 font-semibold text-right">Alerts</th>
              <th className="px-3 py-3 font-semibold text-right" title="Pending slots waiting more than 30 minutes">Waiting</th>
              <th className="px-5 py-3 font-semibold text-right">Last trip</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-ops-line hover:bg-ops-bg/60 transition-colors">
                <td className="px-5 py-3">
                  <Link href={`/tenants/${t.id}`} className="font-medium text-text-primary hover:underline">{t.name}</Link>
                  <p className="text-xs text-text-tertiary">{t.slug}</p>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{t.ritmo_tenant_code || "—"}</td>
                <td className="px-3 py-3">
                  <Badge variant={t.is_active ? "green" : "default"}>{t.is_active ? "Active" : "Inactive"}</Badge>
                </td>
                <td className="px-3 py-3 text-right tabular">{t.vendors}</td>
                <td className="px-3 py-3 text-right tabular">{t.vehicles}</td>
                <td className="px-3 py-3 text-right tabular">{t.drivers}</td>
                <td className="px-3 py-3 text-right tabular">{t.trips}</td>
                <td className="px-3 py-3 text-right tabular font-medium">{t.open_trips}</td>
                <td className="px-3 py-3 text-right tabular">{pct(t.completion_rate)}</td>
                <td className="px-3 py-3 text-right tabular">
                  {t.ritmo_push_ok_rate === null ? <span className="text-text-tertiary">—</span> : (
                    <Badge variant={t.ritmo_push_ok_rate >= 95 ? "green" : t.ritmo_push_ok_rate >= 70 ? "amber" : "red"}>{t.ritmo_push_ok_rate}%</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular">{t.open_alerts ? <Badge variant="red">{t.open_alerts}</Badge> : <span className="text-text-tertiary">0</span>}</td>
                <td className="px-3 py-3 text-right tabular">{t.stale_pending ? <Badge variant="amber">{t.stale_pending}</Badge> : <span className="text-text-tertiary">0</span>}</td>
                <td className="px-5 py-3 text-right text-text-secondary whitespace-nowrap">{formatDateTime(t.last_trip_at)}</td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={12} className="px-5 py-10 text-center text-text-secondary">{error ? "Could not load tenants." : "No tenants match."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
