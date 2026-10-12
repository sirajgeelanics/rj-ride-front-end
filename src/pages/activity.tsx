import React from "react";
import { Link } from "@/lib/router";
import { useActivity } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";
import { formatDateTime } from "@/lib/format";

export default function ActivityPage() {
  const { data, isLoading } = useActivity();

  return (
    <Section
      title="People and sign-ins"
      hint="Active accounts per tenant, drivers who cannot use the app yet, and failed sign-in attempts."
    >
      <table className="w-full text-sm">
        <thead>
          <tr className={thHead}>
            <th className="px-5 py-3 font-semibold">Tenant</th>
            <th className={`${th} text-right`}>Agency admins</th>
            <th className={`${th} text-right`}>Vendor managers</th>
            <th className={`${th} text-right`}>Drivers</th>
            <th className={`${th} text-right`}>Without app login</th>
            <th className={`${th} text-right`}>Failed sign-ins 24h</th>
            <th className={`${th} text-right`}>Failed 7d</th>
            <th className="px-5 py-3 font-semibold text-right">Last sign-in</th>
          </tr>
        </thead>
        <tbody>
          {(data?.tenants ?? []).map((t) => (
            <tr key={t.tenant.id} className={row}>
              <td className="px-5 py-3">
                <Link href={`/tenants/${t.tenant.id}`} className="font-medium text-text-primary hover:underline">{t.tenant.name}</Link>
              </td>
              <td className="px-3 py-3 text-right tabular">{t.agency_admins}</td>
              <td className="px-3 py-3 text-right tabular">{t.vendor_managers}</td>
              <td className="px-3 py-3 text-right tabular">{t.drivers}</td>
              <td className="px-3 py-3 text-right tabular">
                {t.drivers_without_login ? <Badge variant="amber">{t.drivers_without_login}</Badge> : <span className="text-text-tertiary">0</span>}
              </td>
              <td className="px-3 py-3 text-right tabular">
                {t.failed_logins_24h ? <Badge variant="red">{t.failed_logins_24h}</Badge> : <span className="text-text-tertiary">0</span>}
              </td>
              <td className="px-3 py-3 text-right tabular">{t.failed_logins_7d}</td>
              <td className="px-5 py-3 text-right text-text-secondary whitespace-nowrap">{formatDateTime(t.last_login_at)}</td>
            </tr>
          ))}
          {!isLoading && (data?.tenants.length ?? 0) === 0 && <EmptyRow cols={8} text="No tenants." />}
        </tbody>
      </table>
    </Section>
  );
}
