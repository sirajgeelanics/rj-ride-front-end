"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/components/platform/attentionCategories";
import { useAttention, useTenants, type AttentionCategory, type AttentionItem } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";
import { StatusBadge } from "@/components/platform/StatusBadge";

const SEVERITY: Record<string, "red" | "amber" | "default"> = {
  CRITICAL: "red",
  HIGH: "red",
  MEDIUM: "amber",
};

function Cells({ category, item }: { category: AttentionCategory; item: AttentionItem }) {
  const trip = <td className="px-3 py-3 font-mono text-xs">{item.trip_reference ?? "—"}</td>;
  switch (category) {
    case "safety_alerts":
      return (
        <>
          {trip}
          <td className="px-3 py-3">{item.kind}</td>
          <td className="px-3 py-3"><Badge variant={SEVERITY[item.severity ?? ""] ?? "default"}>{item.severity}</Badge></td>
          <td className="px-3 py-3"><StatusBadge status={item.status ?? ""} /></td>
          <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(item.recorded_at)}</td>
        </>
      );
    case "stuck_assigned":
      return (
        <>
          {trip}
          <td className="px-3 py-3">{item.vendor ?? "—"}</td>
          <td className="px-3 py-3 tabular">{item.minutes} min</td>
        </>
      );
    case "stale_pending":
      return (
        <>
          {trip}
          <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(item.pickup_at)}</td>
          <td className="px-3 py-3 tabular">{item.minutes} min</td>
        </>
      );
    case "ritmo_push_issues":
      return (
        <>
          {trip}
          <td className="px-3 py-3 font-mono text-xs">{item.ritmo_ref ?? "—"}</td>
          <td className="px-3 py-3"><Badge variant={item.problem === "Push failed" ? "red" : "amber"}>{item.problem}</Badge></td>
          <td className="px-3 py-3 text-xs text-text-secondary max-w-[22rem] truncate">{item.error ?? "—"}</td>
        </>
      );
    case "expired_offers":
      return (
        <>
          {trip}
          <td className="px-3 py-3">{item.vendor}</td>
          <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(item.expired_at)}</td>
        </>
      );
    case "pending_changes":
      return (
        <>
          {trip}
          <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(item.requested_pickup_at)}</td>
          <td className="px-3 py-3 tabular">{item.requested_pax_count ?? "—"}</td>
        </>
      );
  }
}

const HEADERS: Record<AttentionCategory, string[]> = {
  safety_alerts: ["Trip", "Kind", "Severity", "Status", "Raised"],
  stuck_assigned: ["Trip", "Vendor", "Waiting"],
  stale_pending: ["Trip", "Pickup", "Waiting"],
  ritmo_push_issues: ["Trip", "RITMO ref", "Problem", "Last error"],
  expired_offers: ["Trip", "Vendor", "Expired"],
  pending_changes: ["Trip", "New pickup", "New pax"],
};

function AttentionView() {
  const params = useSearchParams();
  const initial = (params.get("cat") as AttentionCategory | null) ?? "safety_alerts";
  const [category, setCategory] = useState<AttentionCategory>(initial);
  const [tenant, setTenant] = useState("");
  const tenants = useTenants();
  const { data, isLoading } = useAttention(tenant || undefined);
  const current = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0]!;
  const items = data?.items[category] ?? [];

  return (
    <div className="space-y-5">
      <div className="max-w-xs">
        <Select
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          options={[{ value: "", label: "All tenants" }, ...(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const n = data?.counts[c.key] ?? 0;
          const active = c.key === category;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`text-left rounded-2xl border p-4 transition-all hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${
                active ? "border-brand-blue bg-navy-soft shadow-soft" : "border-border bg-white shadow-soft"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${n > 0 ? "bg-danger-soft text-danger" : "bg-ops-card2 text-text-tertiary"}`}>
                <Icon className="w-[18px] h-[18px]" />
              </span>
              <p className="font-serif text-3xl mt-2 tabular text-text-primary">{isLoading ? "—" : n}</p>
              <p className="text-xs font-medium text-text-secondary">{c.label}</p>
            </button>
          );
        })}
      </div>

      <Section title={current.label} hint={current.hint}>
        <table className="w-full text-sm">
          <thead>
            <tr className={thHead}>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              {HEADERS[category].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={row}>
                <td className="px-5 py-3">
                  <Link href={`/tenants/${item.tenant.id}`} className="font-medium text-text-primary hover:underline">
                    {item.tenant.name}
                  </Link>
                </td>
                <Cells category={category} item={item} />
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <EmptyRow cols={HEADERS[category].length + 1} text="Nothing here — all clear." />
            )}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

export default function AttentionPage() {
  return (
    <Suspense fallback={null}>
      <AttentionView />
    </Suspense>
  );
}
