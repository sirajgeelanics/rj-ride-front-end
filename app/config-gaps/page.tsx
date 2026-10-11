"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useConfigGaps, useTenants } from "@/lib/api";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";

function TenantLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/tenants/${id}`} className="font-medium text-text-primary hover:underline">
      {name}
    </Link>
  );
}

export default function ConfigGapsPage() {
  const [tenant, setTenant] = useState("");
  const tenants = useTenants();
  const { data, isLoading } = useConfigGaps(tenant || undefined);
  const total = Object.values(data?.counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Select
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            options={[{ value: "", label: "All tenants" }, ...(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          />
        </div>
        {!isLoading && total === 0 && (
          <span className="inline-flex items-center gap-1.5 text-sm text-success font-medium">
            <CheckCircle2 className="w-4 h-4" /> No configuration gaps found
          </span>
        )}
      </div>

      <Section
        title="Vehicle types with no rate card"
        hint="Vehicles exist for these types but nothing can be quoted — bookings for them fail or land unpriced."
      >
        <table className="w-full text-sm">
          <thead><tr className={thHead}><th className="px-5 py-3 font-semibold">Tenant</th><th className={th}>Vehicle type</th><th className={`${th} text-right`}>Vehicles</th></tr></thead>
          <tbody>
            {(data?.vehicle_types_without_rate_card ?? []).map((r, i) => (
              <tr key={i} className={row}>
                <td className="px-5 py-3"><TenantLink {...r.tenant} /></td>
                <td className="px-3 py-3">{r.vehicle_type}</td>
                <td className="px-3 py-3 text-right tabular">{r.vehicles}</td>
              </tr>
            ))}
            {!isLoading && (data?.vehicle_types_without_rate_card.length ?? 0) === 0 && <EmptyRow cols={3} text="None." />}
          </tbody>
        </table>
      </Section>

      <Section
        title="Requests for a vehicle type the tenant does not have"
        hint="Pending slots booked against a type that isn't in the fleet — ops can only allot or split them by hand."
      >
        <table className="w-full text-sm">
          <thead><tr className={thHead}><th className="px-5 py-3 font-semibold">Tenant</th><th className={th}>Requested type</th><th className={`${th} text-right`}>Pending requests</th></tr></thead>
          <tbody>
            {(data?.unmatched_requests ?? []).map((r, i) => (
              <tr key={i} className={row}>
                <td className="px-5 py-3"><TenantLink {...r.tenant} /></td>
                <td className="px-3 py-3">{r.requested_type}</td>
                <td className="px-3 py-3 text-right tabular">{r.requests}</td>
              </tr>
            ))}
            {!isLoading && (data?.unmatched_requests.length ?? 0) === 0 && <EmptyRow cols={3} text="None." />}
          </tbody>
        </table>
      </Section>

      <Section title="Vendors that are not ready" hint="Missing airport, vehicles or drivers — they can't receive work.">
        <table className="w-full text-sm">
          <thead><tr className={thHead}><th className="px-5 py-3 font-semibold">Tenant</th><th className={th}>Vendor</th><th className={th}>Problems</th></tr></thead>
          <tbody>
            {(data?.vendor_setup ?? []).map((r, i) => (
              <tr key={i} className={row}>
                <td className="px-5 py-3"><TenantLink {...r.tenant} /></td>
                <td className="px-3 py-3 font-medium">{r.vendor}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{r.issues.map((x) => <Badge key={x} variant="amber">{x}</Badge>)}</div></td>
              </tr>
            ))}
            {!isLoading && (data?.vendor_setup.length ?? 0) === 0 && <EmptyRow cols={3} text="Every vendor is ready." />}
          </tbody>
        </table>
      </Section>

      <Section title="Tenant set-up" hint="Missing RITMO code, no vendors, or switched off.">
        <table className="w-full text-sm">
          <thead><tr className={thHead}><th className="px-5 py-3 font-semibold">Tenant</th><th className={th}>Problems</th></tr></thead>
          <tbody>
            {(data?.tenant_setup ?? []).map((r) => (
              <tr key={r.tenant.id} className={row}>
                <td className="px-5 py-3"><TenantLink {...r.tenant} /></td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1.5">{r.issues.map((x) => <Badge key={x} variant="amber">{x}</Badge>)}</div></td>
              </tr>
            ))}
            {!isLoading && (data?.tenant_setup.length ?? 0) === 0 && <EmptyRow cols={2} text="Every tenant is set up." />}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
