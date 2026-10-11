"use client";

import React, { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, Route, Truck, Users } from "lucide-react";
import {
  useActivity,
  useAttention,
  useConfigGaps,
  useFleet,
  useMoney,
  useTenant,
  useTrips,
  type AttentionCategory,
} from "@/lib/api";
import { CATEGORIES } from "@/components/platform/attentionCategories";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/platform/StatCard";
import { StatusBadge } from "@/components/platform/StatusBadge";
import { formatDateTime } from "@/lib/format";

type Tab = "overview" | "vendors" | "trips" | "fleet" | "money" | "alerts";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "vendors", label: "Vendors" },
  { key: "trips", label: "Trips" },
  { key: "fleet", label: "Fleet" },
  { key: "money", label: "Money" },
  { key: "alerts", label: "Needs attention" },
];

const card = "bg-white rounded-2xl border border-border shadow-soft overflow-x-auto";

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<Tab>("overview");
  const tenant = useTenant(id);
  const trips = useTrips({ tenant: id, page_size: 10 });
  const fleet = useFleet(id, { enabled: tab === "fleet" || tab === "overview" });
  const money = useMoney(id, { enabled: tab === "money" });
  const attention = useAttention(id);
  const gaps = useConfigGaps(id, { enabled: tab === "overview" });
  const activity = useActivity(id, { enabled: tab === "overview" });
  const t = tenant.data;

  if (tenant.isLoading) return <p className="text-sm text-text-secondary">Loading…</p>;
  if (!t) return <p className="text-sm text-danger">Tenant not found.</p>;

  const attentionTotal = Object.values(attention.data?.counts ?? {}).reduce((a, b) => a + b, 0);
  const f = fleet.data?.tenants[0];
  const m = money.data?.tenants[0];
  const act = activity.data?.tenants[0];
  const gapTotal = Object.values(gaps.data?.counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tenants" className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary">
          <ArrowLeft className="w-4 h-4" /> All tenants
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h2 className="font-serif text-3xl font-medium text-text-primary">{t.name}</h2>
          <Badge variant={t.is_active ? "green" : "default"}>{t.is_active ? "Active" : "Inactive"}</Badge>
          {t.ritmo_tenant_code && <span className="font-mono text-xs px-2 py-1 rounded-md bg-ops-card2">{t.ritmo_tenant_code}</span>}
          <span className="text-xs text-text-tertiary">Currency {t.currency}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Vendors" value={t.vendors} icon={Truck} />
        <StatCard label="Vehicles" value={t.vehicles} icon={CarFront} />
        <StatCard label="Drivers" value={t.drivers} icon={Users} />
        <StatCard label="Trips" value={t.trips} icon={Route} hint={`${t.open_trips} open`} />
      </div>

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              tab === x.key ? "text-brand-blue" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {x.label}
            {x.key === "alerts" && attentionTotal > 0 && (
              <span className="ml-1.5 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-danger text-white text-[10px] px-1.5">
                {attentionTotal}
              </span>
            )}
            {tab === x.key && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent-gold" />}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className={`${card} p-5`}>
            <h3 className="font-serif text-lg font-medium mb-3">Last 7 days</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-text-secondary">Trips</dt><dd className="tabular font-medium">{t.trips_7d}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Completed</dt><dd className="tabular">{t.completed_7d}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Cancelled</dt><dd className="tabular">{t.cancelled_7d}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Completion</dt><dd className="tabular">{t.completion_rate === null ? "—" : `${t.completion_rate}%`}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">RITMO synced</dt><dd className="tabular">{t.ritmo_push_ok_rate === null ? "—" : `${t.ritmo_push_ok_rate}%`}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Last trip</dt><dd className="text-xs">{formatDateTime(t.last_trip_at)}</dd></div>
            </dl>
          </div>
          <div className={`${card} p-5`}>
            <h3 className="font-serif text-lg font-medium mb-3">People</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-text-secondary">Agency admins</dt><dd className="tabular">{act?.agency_admins ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Vendor managers</dt><dd className="tabular">{act?.vendor_managers ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Drivers</dt><dd className="tabular">{act?.drivers ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Without app login</dt><dd className="tabular">{act?.drivers_without_login ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-secondary">Failed sign-ins (7d)</dt><dd className="tabular">{act?.failed_logins_7d ?? "—"}</dd></div>
            </dl>
          </div>
          <div className={`${card} p-5`}>
            <h3 className="font-serif text-lg font-medium mb-3">Set-up</h3>
            {gaps.data && gapTotal === 0 ? (
              <p className="text-sm text-success font-medium">No configuration gaps.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(gaps.data?.vehicle_types_without_rate_card ?? []).map((g, i) => (
                  <li key={`r${i}`} className="flex items-start gap-2"><Badge variant="amber">No rate card</Badge><span>{g.vehicle_type}</span></li>
                ))}
                {(gaps.data?.unmatched_requests ?? []).map((g, i) => (
                  <li key={`u${i}`} className="flex items-start gap-2"><Badge variant="red">Unmatched type</Badge><span>{g.requested_type} · {g.requests} pending</span></li>
                ))}
                {(gaps.data?.vendor_setup ?? []).map((g, i) => (
                  <li key={`v${i}`} className="flex items-start gap-2"><Badge variant="amber">{g.vendor}</Badge><span>{g.issues.join(", ")}</span></li>
                ))}
                {(gaps.data?.tenant_setup ?? []).map((g, i) => (
                  <li key={`t${i}`} className="flex items-start gap-2"><Badge variant="amber">Tenant</Badge><span>{g.issues.join(", ")}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "vendors" && (
        <section className={card}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary bg-ops-bg/60">
                <th className="px-5 py-3 font-semibold">Vendor</th>
                <th className="px-3 py-3 font-semibold">Airports</th>
                <th className="px-3 py-3 font-semibold text-right">Vehicles</th>
                <th className="px-3 py-3 font-semibold text-right">Drivers</th>
                <th className="px-3 py-3 font-semibold text-right">Trips</th>
                <th className="px-3 py-3 font-semibold text-right">Live</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {t.vendor_list.map((v) => (
                <tr key={v.id} className="border-t border-ops-line hover:bg-ops-bg/60 transition-colors">
                  <td className="px-5 py-3 font-medium text-text-primary">{v.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{v.airport_code || "—"}</td>
                  <td className="px-3 py-3 text-right tabular">{v.vehicles}</td>
                  <td className="px-3 py-3 text-right tabular">{v.drivers}</td>
                  <td className="px-3 py-3 text-right tabular">{v.trips}</td>
                  <td className="px-3 py-3 text-right tabular">{v.live_slots}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/trips?tenant=${t.id}&vendor=${v.id}`} className="text-brand-blue font-medium hover:underline">Trips</Link>
                  </td>
                </tr>
              ))}
              {t.vendor_list.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-text-secondary">No vendors yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "trips" && (
        <section className={card}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-ops-line">
            <h3 className="font-serif text-xl font-medium text-text-primary">Recent trips</h3>
            <Link href={`/trips?tenant=${t.id}`} className="text-sm text-brand-blue font-medium hover:underline">All trips</Link>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(trips.data?.results ?? []).map((trip) => (
                <tr key={trip.id} className="border-t border-ops-line first:border-t-0 hover:bg-ops-bg/60">
                  <td className="px-5 py-3 font-mono text-xs">{trip.reference}</td>
                  <td className="px-3 py-3"><StatusBadge status={trip.status} /></td>
                  <td className="px-3 py-3 text-text-secondary">{formatDateTime(trip.pickup_at)}</td>
                  <td className="px-5 py-3 text-text-secondary truncate max-w-[22rem]">
                    {trip.vehicles.map((v) => v.vendor?.name).filter(Boolean).join(", ") || "Unallotted"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === "fleet" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className={`${card} p-5`}>
            <h3 className="font-serif text-lg font-medium mb-3">Vehicles</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Total", f?.vehicles], ["Active", f?.vehicles_active], ["On trip", f?.vehicles_on_trip],
                ["Breakdown", f?.vehicles_breakdown], ["Unavailable", f?.vehicles_unavailable], ["No location", f?.vehicles_no_location],
              ].map(([label, v]) => (
                <div key={String(label)} className="flex justify-between"><dt className="text-text-secondary">{label}</dt><dd className="tabular">{v ?? "—"}</dd></div>
              ))}
            </dl>
          </div>
          <div className={`${card} p-5`}>
            <h3 className="font-serif text-lg font-medium mb-3">Drivers and documents</h3>
            <dl className="space-y-2 text-sm">
              {[
                ["Drivers", f?.drivers], ["Available", f?.drivers_available], ["On trip", f?.drivers_on_trip],
                ["Offline", f?.drivers_offline], ["Documents expired", f?.documents_expired], ["Documents expiring soon", f?.documents_expiring],
              ].map(([label, v]) => (
                <div key={String(label)} className="flex justify-between"><dt className="text-text-secondary">{label}</dt><dd className="tabular">{v ?? "—"}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {tab === "money" && (
        <section className={`${card} p-5`}>
          <h3 className="font-serif text-lg font-medium mb-3">Billing ({m?.currency ?? t.currency})</h3>
          <dl className="grid sm:grid-cols-3 gap-4 text-sm mb-4">
            <div><dt className="text-text-secondary">Completed, not billed</dt><dd className="font-serif text-2xl tabular">{m?.completed_not_billed ?? "—"}</dd></div>
            <div><dt className="text-text-secondary">Statements draft / final</dt><dd className="font-serif text-2xl tabular">{m ? `${m.statements.DRAFT ?? 0} / ${m.statements.FINAL ?? 0}` : "—"}</dd></div>
            <div><dt className="text-text-secondary">Payouts paid</dt><dd className="font-serif text-2xl tabular">{m?.payouts.PAID?.net_display ?? "—"}</dd></div>
          </dl>
          <table className="w-full max-w-xl text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-1.5 font-semibold">Month</th>
                <th className="py-1.5 font-semibold text-right">Trips</th>
                <th className="py-1.5 font-semibold text-right">Billed</th>
                <th className="py-1.5 font-semibold text-right">Operator fee</th>
              </tr>
            </thead>
            <tbody>
              {(m?.monthly ?? []).map((row) => (
                <tr key={row.month} className="border-t border-ops-line">
                  <td className="py-1.5 font-mono text-xs">{row.month}</td>
                  <td className="py-1.5 text-right tabular">{row.trips}</td>
                  <td className="py-1.5 text-right tabular">{row.total_display}</td>
                  <td className="py-1.5 text-right tabular">{row.fee_display}</td>
                </tr>
              ))}
              {(m?.monthly.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="py-4 text-text-secondary">No billed trips in the last 6 months.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "alerts" && (
        <div className="space-y-4">
          {CATEGORIES.map((c) => {
            const items = attention.data?.items[c.key as AttentionCategory] ?? [];
            const n = attention.data?.counts[c.key] ?? 0;
            return (
              <section key={c.key} className={card}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-ops-line">
                  <h3 className="font-serif text-lg font-medium">{c.label}</h3>
                  <Badge variant={n > 0 ? "red" : "green"}>{n}</Badge>
                </div>
                {items.length > 0 && (
                  <ul className="divide-y divide-ops-line text-sm">
                    {items.slice(0, 8).map((item) => (
                      <li key={item.id} className="px-5 py-2.5 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="font-mono text-xs">{item.trip_reference ?? "—"}</span>
                        <span className="text-text-secondary">
                          {[item.kind, item.severity, item.vendor, item.problem, item.minutes ? `${item.minutes} min` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
