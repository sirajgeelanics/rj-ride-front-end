"use client";

import React from "react";
import Link from "next/link";
import { useFleet } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";
import { MixBar } from "@/components/platform/MixBar";
import { driverMix, vehicleMix } from "@/lib/mix";
import { formatDateTime } from "@/lib/format";

const n = (v: number) => <span className={v === 0 ? "text-text-tertiary" : ""}>{v}</span>;

export default function FleetPage() {
  const { data, isLoading } = useFleet();

  return (
    <div className="space-y-5">
      <Section title="Fleet readiness by tenant" hint="Vehicle availability from the latest location status; drivers by their status.">
        <table className="w-full text-sm">
          <thead>
            <tr className={thHead}>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className={`${th} text-right`}>Vehicles</th>
              <th className={th}>Vehicle mix</th>
              <th className={`${th} text-right`}>Active</th>
              <th className={`${th} text-right`}>On trip</th>
              <th className={`${th} text-right`}>Breakdown</th>
              <th className={`${th} text-right`}>Unavailable</th>
              <th className={`${th} text-right`}>No location</th>
              <th className={`${th} text-right`}>Drivers</th>
              <th className={th}>Driver mix</th>
              <th className={`${th} text-right`}>Available</th>
              <th className={`${th} text-right`}>Expired docs</th>
              <th className="px-5 py-3 font-semibold text-right">Expiring</th>
            </tr>
          </thead>
          <tbody>
            {(data?.tenants ?? []).map((t) => (
              <tr key={t.tenant.id} className={row}>
                <td className="px-5 py-3">
                  <Link href={`/tenants/${t.tenant.id}`} className="font-medium text-text-primary hover:underline">{t.tenant.name}</Link>
                </td>
                <td className="px-3 py-3 text-right tabular font-medium">{t.vehicles}</td>
                <td className="px-3 py-3"><MixBar segments={vehicleMix(t)} empty="—" /></td>
                <td className="px-3 py-3 text-right tabular">{n(t.vehicles_active)}</td>
                <td className="px-3 py-3 text-right tabular">{n(t.vehicles_on_trip)}</td>
                <td className="px-3 py-3 text-right tabular">{t.vehicles_breakdown ? <Badge variant="red">{t.vehicles_breakdown}</Badge> : n(0)}</td>
                <td className="px-3 py-3 text-right tabular">{n(t.vehicles_unavailable)}</td>
                <td className="px-3 py-3 text-right tabular">{n(t.vehicles_no_location)}</td>
                <td className="px-3 py-3 text-right tabular font-medium">{t.drivers}</td>
                <td className="px-3 py-3"><MixBar segments={driverMix(t)} empty="—" /></td>
                <td className="px-3 py-3 text-right tabular">{n(t.drivers_available)}</td>
                <td className="px-3 py-3 text-right tabular">{t.documents_expired ? <Badge variant="red">{t.documents_expired}</Badge> : n(0)}</td>
                <td className="px-5 py-3 text-right tabular">{t.documents_expiring ? <Badge variant="amber">{t.documents_expiring}</Badge> : n(0)}</td>
              </tr>
            ))}
            {!isLoading && (data?.tenants.length ?? 0) === 0 && <EmptyRow cols={13} text="No tenants." />}
          </tbody>
        </table>
      </Section>

      <Section
        title="Documents expired or expiring"
        hint={`Registration, insurance, permits, licences and similar — due within ${data?.warning_days ?? 30} days.`}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className={thHead}>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className={th}>Belongs to</th>
              <th className={th}>Document</th>
              <th className={th}>Expires</th>
              <th className="px-5 py-3 font-semibold text-right">Days left</th>
            </tr>
          </thead>
          <tbody>
            {(data?.expiring_documents ?? []).map((d, i) => (
              <tr key={i} className={row}>
                <td className="px-5 py-3">
                  <Link href={`/tenants/${d.tenant.id}`} className="font-medium text-text-primary hover:underline">{d.tenant.name}</Link>
                </td>
                <td className="px-3 py-3">{d.entity} <span className="text-xs text-text-tertiary">({d.entity_type.toLowerCase()})</span></td>
                <td className="px-3 py-3">{d.doc_type.replace(/_/g, " ").toLowerCase()}</td>
                <td className="px-3 py-3 text-text-secondary">{formatDateTime(d.expiry_date).split(",").slice(0, 2).join(",")}</td>
                <td className="px-5 py-3 text-right">
                  <Badge variant={d.days_left < 0 ? "red" : d.days_left <= 7 ? "amber" : "default"}>
                    {d.days_left < 0 ? `${-d.days_left}d overdue` : `${d.days_left}d`}
                  </Badge>
                </td>
              </tr>
            ))}
            {!isLoading && (data?.expiring_documents.length ?? 0) === 0 && <EmptyRow cols={5} text="Nothing is expiring." />}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
