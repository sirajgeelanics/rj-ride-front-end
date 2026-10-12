"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useTenants, useVendors } from "@/lib/api";
import { driverMix, vehicleMix } from "@/lib/mix";
import { DRIVER_MIX, TONE, VEHICLE_MIX } from "@/lib/colors";
import { formatDateTime } from "@/lib/format";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ActionLink } from "@/components/platform/ActionLink";
import { MixBar } from "@/components/platform/MixBar";
import { EmptyRow, row, th, thHead } from "@/components/platform/Section";

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
        <div className="ml-auto hidden lg:flex items-center gap-3 text-[11px] text-text-secondary">
          {VEHICLE_MIX.map((m) => (
            <span key={m.key} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${TONE[m.tone].dot}`} />
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={thHead}>
              <th className="px-5 py-3 font-semibold">Vendor</th>
              <th className={th}>Tenant</th>
              <th className={th}>Airports</th>
              <th className={th}>Vehicles</th>
              <th className={th}>Drivers</th>
              <th className={`${th} text-right`}>Trips</th>
              <th className={`${th} text-right`}>Live</th>
              <th className={th}>Last trip</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className={`${row} ${v.vehicles_breakdown > 0 ? TONE.red.row : ""}`}>
                <td className="px-5 py-3">
                  <Link href={`/vendors/${v.id}`} className="font-medium text-text-primary hover:underline">{v.name}</Link>
                  {v.drivers_without_login > 0 && (
                    <span className="ml-2"><Badge variant="amber">{v.drivers_without_login} no login</Badge></span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Link href={`/tenants/${v.tenant.id}`} className="hover:underline">{v.tenant.name}</Link>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{v.airport_code || "—"}</td>
                <td className="px-3 py-3">
                  <div className="text-xs font-semibold tabular text-text-primary mb-1">{v.vehicles}</div>
                  <MixBar segments={vehicleMix(v)} empty="No vehicles" />
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs font-semibold tabular text-text-primary mb-1">{v.drivers}</div>
                  <MixBar segments={driverMix(v)} empty="No drivers" />
                </td>
                <td className="px-3 py-3 text-right tabular">{v.trips}</td>
                <td className="px-3 py-3 text-right tabular">
                  {v.live_slots ? <Badge variant="blue">{v.live_slots}</Badge> : <span className="text-text-tertiary">0</span>}
                </td>
                <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(v.last_trip_at)}</td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <span className="inline-flex gap-2">
                    <ActionLink href={`/vendors/${v.id}`} tone="navy">Fleet</ActionLink>
                    <ActionLink href={`/trips?tenant=${v.tenant.id}&vendor=${v.id}`} tone="gold">Trips</ActionLink>
                  </span>
                </td>
              </tr>
            ))}
            {!vendors.isLoading && rows.length === 0 && (
              <EmptyRow cols={9} text="No vendors match." />
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
