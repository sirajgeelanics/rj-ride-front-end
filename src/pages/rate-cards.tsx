import React, { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { useCatalog, useTenants, type CatalogRateCard } from "@/lib/api";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";

const STATUS_VARIANT: Record<CatalogRateCard["status"], "green" | "blue" | "amber" | "red" | "default"> = {
  ACTIVE: "green",
  UPCOMING: "blue",
  EXPIRED: "amber",
  INACTIVE: "red",
  SUPERSEDED: "default",
};

function Rates({ card }: { card: CatalogRateCard }) {
  return (
    <div className="space-y-0.5">
      {card.rates.map((r) => (
        <div key={r.label} className="flex gap-2">
          <span className="text-text-tertiary">{r.label}</span>
          <span className="tabular font-medium">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function RateCardsPage() {
  const [tenant, setTenant] = useState("");
  const [search, setSearch] = useState("");
  const tenants = useTenants();
  const { data, isLoading, error } = useCatalog(tenant || undefined);
  const needle = search.trim().toLowerCase();

  const groups = useMemo(
    () =>
      (data?.tenants ?? []).map((t) => ({
        ...t,
        vendors: t.vendors.filter(
          (v) =>
            !needle ||
            v.name.toLowerCase().includes(needle) ||
            v.vehicle_types.some(
              (vt) =>
                vt.name.toLowerCase().includes(needle) ||
                vt.names.some((n) => n.name.toLowerCase().includes(needle)),
            ),
        ),
      })),
    [data, needle],
  );

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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendor, vehicle type or car name"
          className="w-full max-w-xs rounded-lg border border-border bg-white px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-danger">Couldn&apos;t load rate cards.</p>}
      {isLoading && <p className="text-sm text-text-secondary">Loading…</p>}

      {groups.map((t) =>
        t.vendors.length === 0 ? null : (
          <div key={t.tenant.id} className="space-y-4">
            <h2 className="font-serif text-2xl font-medium text-text-primary">
              <Link href={`/tenants/${t.tenant.id}`} className="hover:underline">{t.tenant.name}</Link>
            </h2>
            {t.vendors.map((v) => (
              <Section
                key={v.id}
                title={v.name}
                hint={v.airport_code ? `Airport ${v.airport_code}` : undefined}
                action={<Link href={`/vendors/${v.id}`} className="text-xs text-brand-blue hover:underline">Open vendor</Link>}
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className={thHead}>
                      <th className="px-5 py-3 font-semibold">Vehicle type</th>
                      <th className={th}>Rate card</th>
                      <th className={th}>Rates</th>
                      <th className={th}>Valid</th>
                      <th className={th}>Car names</th>
                      <th className={`${th} text-right`}>Vehicles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.vehicle_types.map((vt) => (
                      <tr key={vt.id} className={`${row} align-top`}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-text-primary">{vt.name}</div>
                          <div className="text-xs text-text-tertiary">{vt.ac ? "AC" : "Non-AC"} · {vt.capacity} seats</div>
                        </td>
                        <td className="px-3 py-3">
                          {vt.rate_card ? (
                            <div className="space-y-1">
                              <div>{vt.rate_card.basis_label}</div>
                              <div className="flex items-center gap-1.5">
                                <Badge variant={STATUS_VARIANT[vt.rate_card.status]}>{vt.rate_card.status.toLowerCase()}</Badge>
                                <span className="text-xs text-text-tertiary">
                                  v{vt.rate_card.version}
                                  {vt.rate_card.versions > 1 ? ` of ${vt.rate_card.versions}` : ""}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <Badge variant="amber">No rate card</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3">{vt.rate_card ? <Rates card={vt.rate_card} /> : "—"}</td>
                        <td className="px-3 py-3 tabular text-xs">
                          {vt.rate_card ? (
                            <>
                              {vt.rate_card.valid_from} → {vt.rate_card.valid_to ?? "open"}
                              <div className="text-text-tertiary mt-0.5">
                                Free cancel {vt.rate_card.free_cancellation_hours}h · lead {vt.rate_card.min_lead_time_hours}h
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {vt.names.length === 0 ? (
                            <span className="text-text-tertiary">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {vt.names.map((n) => (
                                <Badge key={n.id} variant={n.vehicles > 0 ? "teal" : "default"}>
                                  {n.name}{n.vehicles > 0 ? ` · ${n.vehicles}` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular">{vt.vehicles}</td>
                      </tr>
                    ))}
                    {v.vehicle_types.length === 0 && <EmptyRow cols={6} text="No vehicle types, vehicles or rate cards for this vendor yet." />}
                  </tbody>
                </table>
              </Section>
            ))}
          </div>
        ),
      )}

      {!isLoading && !error && groups.every((t) => t.vendors.length === 0) && (
        <p className="text-sm text-text-secondary">Nothing matches.</p>
      )}
    </div>
  );
}
