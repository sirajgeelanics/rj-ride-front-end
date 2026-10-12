import React, { Fragment, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "@/lib/router";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search, X } from "lucide-react";
import { tripExportUrl, useTenants, useTrips, useVendors } from "@/lib/api";
import { TONE, toneOf } from "@/lib/colors";
import { formatDateTime, titleCase } from "@/lib/format";
import { Select } from "@/components/ui/Select";
import { ActionButton } from "@/components/platform/ActionLink";
import { StatusBadge } from "@/components/platform/StatusBadge";
import { TripDrawer } from "@/components/platform/TripDrawer";

const STATUSES = ["DRAFT", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "BILLED", "CANCELLED"];
const PAGE_SIZE = 25;

const dateField =
  "mt-1.5 block h-10 px-3 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue";

function TripsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tenant = params.get("tenant") ?? "";
  const vendor = params.get("vendor") ?? "";
  const status = params.get("status") ?? "";
  const q = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(q);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const tenants = useTenants();
  const vendors = useVendors(tenant || undefined);
  const range = {
    from: from ? `${from}T00:00:00Z` : undefined,
    to: to ? `${to}T23:59:59Z` : undefined,
  };
  const trips = useTrips({
    tenant: tenant || undefined,
    vendor: vendor || undefined,
    status: status || undefined,
    q: q || undefined,
    ...range,
    page,
    page_size: PAGE_SIZE,
  });
  const exportUrl = tripExportUrl({
    tenant: tenant || undefined,
    vendor: vendor || undefined,
    status: status || undefined,
    q: q || undefined,
    ...range,
  });

  const setParam = (next: Record<string, string>) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in next)) sp.delete("page");
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const data = trips.data;
  const counts = data?.status_counts ?? {};
  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPages = data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1;
  const anyFilter = Boolean(from || to || tenant || vendor || status || q);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr] gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ q: search.trim() });
          }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, RITMO ref or customer…"
            className={`w-full h-10 pl-10 pr-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue ${
              q ? "bg-navy-soft border-brand-blue/50 text-brand-blue font-medium" : "bg-white border-border"
            }`}
          />
        </form>
        <Select
          value={tenant}
          onChange={(e) => setParam({ tenant: e.target.value, vendor: "" })}
          options={[{ value: "", label: "All tenants" }, ...(tenants.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
        />
        <Select
          value={vendor}
          onChange={(e) => setParam({ vendor: e.target.value })}
          options={[{ value: "", label: "All vendors" }, ...(vendors.data ?? []).map((v) => ({ value: v.id, label: v.name }))]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam({ status: "" })}
          className={`h-8 px-3 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors ${
            status === "" ? "bg-brand-blue text-white ring-brand-blue" : "bg-white text-text-secondary ring-border hover:bg-ops-card2"
          }`}
        >
          All <span className="ml-1 tabular opacity-80">{totalAll}</span>
        </button>
        {STATUSES.map((s) => {
          const tone = TONE[toneOf(s)];
          const n = counts[s] ?? 0;
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setParam({ status: active ? "" : s })}
              disabled={n === 0 && !active}
              className={`h-8 px-3 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                active ? `${tone.solid} ring-transparent shadow-soft` : `${tone.soft} hover:brightness-95`
              }`}
            >
              {titleCase(s)} <span className="ml-1 tabular opacity-80">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-text-primary">
          Pickup from
          <input type="date" value={from} onChange={(e) => setParam({ from: e.target.value })} className={`${dateField} ${from ? "bg-navy-soft border-brand-blue/50 text-brand-blue" : ""}`} />
        </label>
        <label className="text-xs font-semibold text-text-primary">
          to
          <input type="date" value={to} onChange={(e) => setParam({ to: e.target.value })} className={`${dateField} ${to ? "bg-navy-soft border-brand-blue/50 text-brand-blue" : ""}`} />
        </label>
        {anyFilter && (
          <button
            onClick={() => {
              setSearch("");
              router.replace(pathname);
            }}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-sm font-medium text-danger bg-danger-soft hover:bg-danger hover:text-white transition-colors"
          >
            <X className="w-4 h-4" /> Clear filters
          </button>
        )}
        <a
          href={exportUrl}
          className="ml-auto inline-flex items-center gap-2 h-10 px-4 text-sm font-medium rounded-lg bg-gradient-to-b from-[#0E3F82] to-brand-blue text-white shadow-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110 hover:shadow-lift transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 focus-visible:ring-offset-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary bg-ops-bg/60">
              <th className="px-5 py-3 font-semibold">Trip</th>
              <th className="px-3 py-3 font-semibold">Tenant</th>
              <th className="px-3 py-3 font-semibold">Customer</th>
              <th className="px-3 py-3 font-semibold">Pickup</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-3 py-3 font-semibold">Vendors</th>
              <th className="px-3 py-3 font-semibold text-right">Pax</th>
              <th className="px-3 py-3 font-semibold text-right">Price</th>
              <th className="px-3 py-3 font-semibold">RITMO</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {(data?.results ?? []).map((trip) => {
              const isOpen = open === trip.id;
              const tone = TONE[toneOf(trip.status)];
              const vendorNames = Array.from(
                new Set(trip.vehicles.map((v) => v.vendor?.name).filter((n): n is string => Boolean(n))),
              );
              const unallotted = trip.vehicles.some((v) => !v.vendor) && trip.status !== "CANCELLED";
              return (
                <Fragment key={trip.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : trip.id)}
                    className={`border-t border-ops-line hover:bg-ops-bg/70 transition-colors cursor-pointer ${trip.status === "CANCELLED" ? tone.row : ""}`}
                  >
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2 font-mono text-xs whitespace-nowrap">
                        <ChevronDown className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                        {trip.reference}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-text-primary">{trip.tenant.name}</td>
                    <td className="px-3 py-3 text-text-secondary">{trip.customer ?? "—"}</td>
                    <td className="px-3 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(trip.pickup_at)}</td>
                    <td className="px-3 py-3"><StatusBadge status={trip.status} /></td>
                    <td className="px-3 py-3">
                      {vendorNames.length > 0 ? (
                        <span className="text-text-secondary">{vendorNames.join(", ")}</span>
                      ) : (
                        <span className="text-text-tertiary">Unallotted</span>
                      )}
                      {unallotted && vendorNames.length > 0 && (
                        <span className="ml-2 text-[11px] font-semibold text-[#8A5A14] bg-amber-soft px-1.5 py-0.5 rounded">partly</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular">{trip.pax_total || "—"}</td>
                    <td className="px-3 py-3 text-right tabular whitespace-nowrap text-text-primary">{trip.price_display ?? "—"}</td>
                    <td className="px-3 py-3 font-mono text-xs text-text-secondary">{trip.ritmo_ref ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <ActionButton onClick={(e) => { e.stopPropagation(); setDetail(trip.id); }}>Details</ActionButton>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-ops-bg/50">
                      <td colSpan={10} className="px-5 py-4">
                        <p className="text-xs text-text-secondary mb-3">
                          <span className="font-semibold text-text-primary">{trip.pickup || "—"}</span> → {trip.drop || "—"}
                          {trip.airport_code ? ` · ${trip.airport_code}` : ""}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {trip.vehicles.map((v) => (
                            <div key={v.id} className="bg-white rounded-xl border border-border p-3 text-sm">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-text-primary">{v.vendor?.name ?? "Unallotted"}</span>
                                <StatusBadge status={v.status} />
                              </div>
                              <p className="text-xs text-text-secondary mt-1">
                                {[v.vehicle_type, v.plate, v.driver].filter(Boolean).join(" · ") || "No vehicle yet"}
                              </p>
                              <p className="text-xs text-text-tertiary mt-0.5">
                                {v.pax_count} pax{v.price_display ? ` · ${v.price_display}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!trips.isLoading && (data?.results.length ?? 0) === 0 && (
              <tr><td colSpan={10} className="px-5 py-10 text-center text-text-secondary">No trips match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>{data ? `${data.count} trip${data.count === 1 ? "" : "s"}` : "…"}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-white text-brand-blue disabled:opacity-40 hover:bg-navy-soft hover:border-brand-blue/40 transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="tabular">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-white text-brand-blue disabled:opacity-40 hover:bg-navy-soft hover:border-brand-blue/40 transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <TripDrawer tripId={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export default function TripsPage() {
  return (
    <Suspense fallback={null}>
      <TripsView />
    </Suspense>
  );
}
