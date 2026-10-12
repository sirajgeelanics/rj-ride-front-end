import React, { useState } from "react";
import type { FleetDocument, FleetJob, VendorDriver, VendorVehicle } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/platform/StatusBadge";
import { EmptyRow, row, th, thHead } from "@/components/platform/Section";

const LOCATION: Record<string, { label: string; variant: "green" | "blue" | "red" | "default" }> = {
  active: { label: "Active", variant: "green" },
  on_trip: { label: "On trip", variant: "blue" },
  breakdown: { label: "Breakdown", variant: "red" },
  not_available: { label: "Unavailable", variant: "default" },
};

const DRIVER: Record<string, { label: string; variant: "green" | "blue" | "default" }> = {
  AVAILABLE: { label: "Available", variant: "green" },
  ON_TRIP: { label: "On trip", variant: "blue" },
  OFFLINE: { label: "Offline", variant: "default" },
};

function Job({ job }: { job: FleetJob | null }) {
  if (!job) return <span className="text-text-tertiary">—</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="font-mono text-xs">{job.trip_reference}</span>
      <StatusBadge status={job.status} />
    </span>
  );
}

function Docs({ expired, expiring }: { expired: number; expiring: number }) {
  if (!expired && !expiring) return <span className="text-text-tertiary">OK</span>;
  return (
    <span className="inline-flex gap-1.5">
      {expired > 0 && <Badge variant="red">{expired} expired</Badge>}
      {expiring > 0 && <Badge variant="amber">{expiring} soon</Badge>}
    </span>
  );
}

const DOC_LABEL: Record<string, string> = {
  REGISTRATION: "Registration",
  PERMIT_NATIONAL: "National permit",
  PERMIT_STATE: "State permit",
  FITNESS: "Fitness",
  PUC: "Pollution (PUC)",
  INSURANCE: "Insurance",
  LICENCE: "Driving licence",
  PSV_BADGE: "PSV badge",
  POLICE_VERIFICATION: "Police verification",
  MEDICAL: "Medical",
  INDUCTION: "Induction",
};

function DocList({ docs }: { docs: FleetDocument[] }) {
  if (docs.length === 0) return <p className="text-xs text-text-secondary">No documents on file.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {docs.map((d, i) => {
        const tone =
          d.days_left === null ? "default" : d.days_left < 0 ? "red" : d.days_left <= 30 ? "amber" : "green";
        const when =
          d.days_left === null
            ? "no expiry"
            : d.days_left < 0
              ? `expired ${-d.days_left}d ago`
              : `${d.expiry_date} · ${d.days_left}d left`;
        return (
          <li key={`${d.doc_type}-${i}`}>
            <Badge variant={tone}>
              {DOC_LABEL[d.doc_type] ?? d.doc_type}: {when}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}

function DocsToggle({
  expired,
  expiring,
  count,
  open,
  onToggle,
}: {
  expired: number;
  expiring: number;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 hover:bg-ops-card2"
    >
      <Docs expired={expired} expiring={expiring} />
      <span className="text-xs text-text-tertiary">
        {count} {open ? "▴" : "▾"}
      </span>
    </button>
  );
}

export function VehicleTable({ vehicles, emptyText }: { vehicles: VendorVehicle[]; emptyText: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={thHead}>
          <th className="px-5 py-3 font-semibold">Plate</th>
          <th className={th}>Type</th>
          <th className={th}>Airport</th>
          <th className={th}>Status</th>
          <th className={th}>Right now</th>
          <th className={th}>Tracker</th>
          <th className={th}>Documents</th>
          <th className="px-5 py-3 font-semibold">Last seen</th>
        </tr>
      </thead>
      <tbody>
        {vehicles.map((v) => {
          const loc = v.location_status ? LOCATION[v.location_status] : undefined;
          return (
            <React.Fragment key={v.id}>
            <tr className={row}>
              <td className="px-5 py-3">
                <span className="font-mono text-xs font-medium text-text-primary">{v.plate}</span>
                {!v.is_active && <span className="ml-2"><Badge variant="default">Inactive</Badge></span>}
              </td>
              <td className="px-3 py-3">
                {v.vehicle_type}
                {v.vehicle_name && <span className="text-text-tertiary"> · {v.vehicle_name}</span>}
              </td>
              <td className="px-3 py-3 font-mono text-xs">{v.airport_code || "—"}</td>
              <td className="px-3 py-3">
                {loc ? <Badge variant={loc.variant}>{loc.label}</Badge> : <Badge variant="amber">No location</Badge>}
              </td>
              <td className="px-3 py-3"><Job job={v.current_job} /></td>
              <td className="px-3 py-3">{v.has_tracker ? <Badge variant="green">Linked</Badge> : <span className="text-text-tertiary">None</span>}</td>
              <td className="px-3 py-3">
                <DocsToggle
                  expired={v.documents_expired}
                  expiring={v.documents_expiring}
                  count={v.documents.length}
                  open={open === v.id}
                  onToggle={() => setOpen(open === v.id ? null : v.id)}
                />
              </td>
              <td className="px-5 py-3 text-text-secondary whitespace-nowrap">{formatDateTime(v.location_updated_at)}</td>
            </tr>
            {open === v.id && (
              <tr className="bg-ops-bg/60">
                <td colSpan={8} className="px-5 py-3">
                  <DocList docs={v.documents} />
                </td>
              </tr>
            )}
            </React.Fragment>
          );
        })}
        {vehicles.length === 0 && <EmptyRow cols={8} text={emptyText} />}
      </tbody>
    </table>
  );
}

export function DriverTable({ drivers, emptyText }: { drivers: VendorDriver[]; emptyText: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={thHead}>
          <th className="px-5 py-3 font-semibold">Driver</th>
          <th className={th}>Status</th>
          <th className={th}>Phone</th>
          <th className={th}>Airport</th>
          <th className={th}>App login</th>
          <th className={th}>Right now</th>
          <th className="px-5 py-3 font-semibold">Documents</th>
        </tr>
      </thead>
      <tbody>
        {drivers.map((d) => {
          const st = DRIVER[d.status];
          return (
            <React.Fragment key={d.id}>
            <tr className={row}>
              <td className="px-5 py-3">
                <span className="font-medium text-text-primary">{d.name}</span>
                {!d.is_active && <span className="ml-2"><Badge variant="default">Inactive</Badge></span>}
              </td>
              <td className="px-3 py-3">{st ? <Badge variant={st.variant}>{st.label}</Badge> : d.status}</td>
              <td className="px-3 py-3 font-mono text-xs text-text-secondary">{d.phone_masked || "—"}</td>
              <td className="px-3 py-3 font-mono text-xs">{d.airport_code || "—"}</td>
              <td className="px-3 py-3">
                {d.has_app_login ? <Badge variant="green">Has login</Badge> : <Badge variant="amber">No login</Badge>}
              </td>
              <td className="px-3 py-3"><Job job={d.current_job} /></td>
              <td className="px-5 py-3">
                <DocsToggle
                  expired={d.documents_expired}
                  expiring={d.documents_expiring}
                  count={d.documents.length}
                  open={open === d.id}
                  onToggle={() => setOpen(open === d.id ? null : d.id)}
                />
              </td>
            </tr>
            {open === d.id && (
              <tr className="bg-ops-bg/60">
                <td colSpan={7} className="px-5 py-3">
                  <DocList docs={d.documents} />
                </td>
              </tr>
            )}
            </React.Fragment>
          );
        })}
        {drivers.length === 0 && <EmptyRow cols={7} text={emptyText} />}
      </tbody>
    </table>
  );
}
