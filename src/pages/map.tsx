import React, { useMemo, useState } from "react";
import { dynamic } from "@/lib/router";
import { useLiveMap, useTenants } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";

// Leaflet touches `window`, so the map is client-only.
const FleetMap = dynamic(() => import("@/components/platform/FleetMap"), {
  ssr: false,
  loading: () => <div className="h-[560px] rounded-2xl border border-border bg-ops-card2" />,
});

const STATES: { key: string; label: string; variant: "green" | "blue" | "red" | "default" }[] = [
  { key: "active", label: "Active", variant: "green" },
  { key: "on_trip", label: "On trip", variant: "blue" },
  { key: "breakdown", label: "Breakdown", variant: "red" },
  { key: "not_available", label: "Unavailable", variant: "default" },
];

export default function LiveMapPage() {
  const [tenant, setTenant] = useState("");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const tenants = useTenants().data;
  const { data, isLoading, error } = useLiveMap(tenant || undefined);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of data?.points ?? []) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [data]);
  const visible = useMemo(() => (data?.points ?? []).filter((p) => !hidden.has(p.status)), [data, hidden]);
  const stale = (data?.points ?? []).filter((p) => p.stale).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="h-10 px-3 text-sm bg-white border border-border rounded-lg"
        >
          <option value="">All tenants</option>
          {(tenants ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {STATES.map((s) => (
          <button
            key={s.key}
            onClick={() =>
              setHidden((h) => {
                const next = new Set(h);
                if (next.has(s.key)) next.delete(s.key);
                else next.add(s.key);
                return next;
              })
            }
            className={hidden.has(s.key) ? "opacity-40" : ""}
            aria-pressed={!hidden.has(s.key)}
          >
            <Badge variant={s.variant}>
              {s.label} {counts[s.key] ?? 0}
            </Badge>
          </button>
        ))}
        <span className="text-xs text-text-secondary">
          {data ? `${visible.length} shown` : ""}
          {stale > 0 ? ` · ${stale} not heard from in 30+ min (hollow)` : ""}
        </span>
      </div>
      {error && <p className="text-sm text-danger">Could not load positions.</p>}
      {data?.truncated && <p className="text-xs text-text-secondary">Showing the 2,000 most recent positions.</p>}
      {isLoading ? <div className="h-[560px] rounded-2xl border border-border bg-ops-card2" /> : <FleetMap points={visible} />}
      {data && data.points.length === 0 && (
        <p className="text-sm text-text-secondary">No vehicle has reported a position yet.</p>
      )}
    </div>
  );
}
