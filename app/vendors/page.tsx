"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTenants, useVendors } from "@/lib/api";
import { Select } from "@/components/ui/Select";

function VendorsView() {
  const [tenant, setTenant] = useState("");
  const [q, setQ] = useState("");
  const tenants = useTenants();
  const vendors = useVendors(tenant || undefined);
  const rows = useMemo(
    () =>
      (vendors.data ?? []).filter((v) =>
        `${v.name} ${v.tenant.name} ${v.airport_code}`.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [vendors.data, q],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors or airport…"
            className="w-full h-10 pl-10 pr-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            options={[{ value: "", label: "All tenants" }, ...(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary bg-ops-bg/60">
              <th className="px-5 py-3 font-semibold">Vendor</th>
              <th className="px-3 py-3 font-semibold">Tenant</th>
              <th className="px-3 py-3 font-semibold">Airports</th>
              <th className="px-3 py-3 font-semibold text-right">Vehicles</th>
              <th className="px-3 py-3 font-semibold text-right">Drivers</th>
              <th className="px-3 py-3 font-semibold text-right">Trips</th>
              <th className="px-3 py-3 font-semibold text-right">Live</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-ops-line hover:bg-ops-bg/60 transition-colors">
                <td className="px-5 py-3 font-medium text-text-primary">{v.name}</td>
                <td className="px-3 py-3">
                  <Link href={`/tenants/${v.tenant.id}`} className="hover:underline">{v.tenant.name}</Link>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{v.airport_code || "—"}</td>
                <td className="px-3 py-3 text-right tabular">{v.vehicles}</td>
                <td className="px-3 py-3 text-right tabular">{v.drivers}</td>
                <td className="px-3 py-3 text-right tabular">{v.trips}</td>
                <td className="px-3 py-3 text-right tabular">{v.live_slots}</td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/trips?tenant=${v.tenant.id}&vendor=${v.id}`} className="text-brand-blue font-medium hover:underline">Trips</Link>
                </td>
              </tr>
            ))}
            {!vendors.isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-text-secondary">No vendors match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={null}>
      <VendorsView />
    </Suspense>
  );
}
