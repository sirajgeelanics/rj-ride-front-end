import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, csrfFetch, isApiError, keys } from "@/lib/shared";
import { uuidv4 } from "@/lib/shared/uuid";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormField } from "@/components/ui/FormField";
import { TripMapView } from "@/components/trips/TripMapView";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Stop as MapStop } from "@/lib/types";
import { Upload, CheckCircle2, XCircle, Users, MapPin, ArrowRight, AlertTriangle, Map as MapIcon, Ban } from "lucide-react";

type Customer = components["schemas"]["Customer"];
type Vendor = components["schemas"]["Vendor"];

// Matches apps.trips.roster.RosterGroup.as_dict() exactly (apps/trips/roster.py).
type OrderedStop = {
  kind: "PICKUP" | "DROP" | "WAYPOINT";
  address: string;
  lat: number | null;
  lng: number | null;
  row_num: number | null;
  employee_name: string | null;
};

type RosterGroup = {
  group_id: string;
  leg: "PICKUP" | "DROP";
  vehicle_type_id: string;
  vehicle_type_name: string;
  target_time: string;
  days_of_week: number[];
  employee_row_nums: number[];
  ordered_stops: OrderedStop[];
  distance_km: number | null;
};

// Matches apps.trips.roster.RosterPreviewResult.as_dict().
type RosterPreviewResult = {
  groups: RosterGroup[];
  row_errors: { row: number; errors: string[] }[];
  upload_token: string;
  employee_count: number;
  group_count: number;
};

type Phase = "upload" | "review" | "done" | "deactivated";

// Matches apps.trips.roster.roster_status()'s return dict.
type RosterStatus = {
  employee_count: number;
  route_count: number;
  last_updated: string | null;
};

// Matches the {trip_vehicle_id, trip_id, trip_reference, reason} shape
// apps.trips.roster._describe_trip_vehicle() returns, under both commit_roster's and
// deactivate_roster's "auto_cancelled_trips"/"trips_needing_review" keys.
type TripActionEntry = {
  trip_vehicle_id: string;
  trip_id: string;
  trip_reference: string;
  reason: string;
};

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

const REQUIRED_COLUMNS_HINT =
  "employee_name, employee_phone, pickup_address, shift_start (HH:MM), shift_end (HH:MM), days_of_week (e.g. \"1,2,3,4,5\")";
const OPTIONAL_COLUMNS_HINT =
  "pickup_lat, pickup_lng, drop_lat, drop_lng (leave blank to geocode), drop_address, round_trip, pickup_enabled, drop_enabled";

function stopsToMapStops(stops: OrderedStop[]): MapStop[] {
  return stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s, i) => ({
      seq: i,
      type: s.kind,
      locationType: "ADDRESS",
      address: s.employee_name ? `${s.address} (${s.employee_name})` : s.address,
      lat: s.lat as number,
      lng: s.lng as number,
    }));
}

// Shown after both a commit (re-upload dropped some employees) and a standalone deactivate —
// surfaces apps.trips.roster's two-tier removal handling: a trip auto-cancelled because the
// departed employee was its only rider needs no action, but a pooled trip is deliberately left
// running and reported here instead, so ops can decide (drop that stop, swap the vehicle, etc.)
// rather than it being silently missed.
const TripActionsReport: React.FC<{
  autoCancelled: TripActionEntry[];
  needsReview: TripActionEntry[];
}> = ({ autoCancelled, needsReview }) => {
  if (autoCancelled.length === 0 && needsReview.length === 0) return null;
  return (
    <div className="space-y-2 text-left">
      {autoCancelled.length > 0 && (
        <div className="p-2.5 rounded-lg border border-border bg-ops-card2 text-xs space-y-1">
          <p className="font-semibold text-text-primary flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5" />
            {autoCancelled.length} already-scheduled trip(s) auto-cancelled
          </p>
          <p className="text-text-tertiary">
            The removed employee was the only rider on each — no other passenger was affected.
          </p>
          <ul className="space-y-0.5 pl-5 list-disc">
            {autoCancelled.map((t) => (
              <li key={t.trip_vehicle_id} className="text-text-secondary">
                {t.trip_reference}
              </li>
            ))}
          </ul>
        </div>
      )}
      {needsReview.length > 0 && (
        <div className="p-2.5 rounded-lg border border-alert-amber/30 bg-amber-soft text-xs space-y-1 text-[#8A5A14]">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {needsReview.length} trip(s) need manual review
          </p>
          <p>
            These were left untouched — either pooled with other active riders, or already in
            progress. Review each one and act manually (drop a stop, reassign, or cancel).
          </p>
          <ul className="space-y-0.5 pl-5 list-disc">
            {needsReview.map((t) => (
              <li key={t.trip_vehicle_id}>
                {t.trip_reference} — {t.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const RosterUploadCreation: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("upload");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [preview, setPreview] = useState<RosterPreviewResult | null>(null);
  const [excludedRows, setExcludedRows] = useState<Set<number>>(new Set());
  // Each group's route map mounts its own Leaflet instance — fine for a handful of groups,
  // but a large roster can produce dozens, so only the ones someone actually asks to see get
  // mounted. Small previews (<= 5 groups, the common case) start expanded for convenience.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroupMap = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    created_employees: number;
    created_rules: number;
    deactivated_prior_rules: number;
    deactivated_prior_employees: number;
    auto_cancelled_trips: TripActionEntry[];
    trips_needing_review: TripActionEntry[];
  } | null>(null);

  const [confirmDeactivateOpen, setConfirmDeactivateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateResult, setDeactivateResult] = useState<{
    deactivated_employees: number;
    deactivated_rules: number;
    auto_cancelled_trips: TripActionEntry[];
    trips_needing_review: TripActionEntry[];
  } | null>(null);

  const { data: customersData } = useQuery({
    queryKey: keys.config.customers.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/customers", {});
      if (err) throw err;
      return res;
    },
  });
  const customers = (customersData?.results ?? []) as Customer[];

  // Optional: left unset, every standing route this roster creates falls back to the
  // existing "first vendor with an applicable rate card" choice at each day's generation
  // (apps.pricing.services.get_offers) — same as before this field existed.
  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {});
      if (err) throw err;
      return res;
    },
  });
  const vendors = (vendorsData?.results ?? []) as Vendor[];

  // Full-replace semantics (apps.trips.roster.commit_roster): a commit always deactivates
  // this customer's entire prior roster-derived schedule first, even if the new upload is
  // only a partial list. Surfaced here both as an upfront "here's what's currently live"
  // and, more importantly, as a pre-commit warning — so an admin never finds out a schedule
  // got wiped only from the success screen's deactivation count, after it already happened.
  const { data: rosterStatus } = useQuery<RosterStatus>({
    queryKey: keys.trips.rosterStatus(customerId || "none"),
    queryFn: async () => {
      const resp = await fetch(
        `/api/v1/trips/roster/status/?customer_ref=${encodeURIComponent(customerId)}`,
        { credentials: "include" },
      );
      if (!resp.ok) throw new Error(`roster/status failed: ${resp.status}`);
      return (await resp.json()) as RosterStatus;
    },
    enabled: !!customerId,
  });
  const hasExistingSchedule = !!rosterStatus && rosterStatus.employee_count > 0;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !customerId) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 2 MB.`, "error");
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("customer_ref", customerId);
      if (vendorId) formData.append("vendor_ref", vendorId);

      const resp = await csrfFetch("/api/v1/trips/roster/preview/", {
        method: "POST",
        body: formData,
      });
      const body = (await resp.json()) as RosterPreviewResult & { error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(body?.error?.message ?? `Preview failed (${resp.status})`);
      }
      setPreview(body);
      setExcludedRows(new Set());
      setExpandedGroups(
        body.groups.length <= 5 ? new Set(body.groups.map((g) => g.group_id)) : new Set(),
      );
      setPhase("review");
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Validation failed",
        "error",
      );
    } finally {
      setValidating(false);
    }
  };

  const toggleEmployee = (rowNum: number) => {
    setExcludedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const resp = await csrfFetch("/api/v1/trips/roster/commit/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
        body: JSON.stringify({
          upload_token: preview.upload_token,
          excluded_row_nums: Array.from(excludedRows),
        }),
      });
      const body = (await resp.json()) as typeof commitResult & { error?: { message?: string } };
      if (!resp.ok) {
        throw new Error((body as { error?: { message?: string } })?.error?.message ?? `Commit failed (${resp.status})`);
      }
      setCommitResult(body);
      addToast(
        `Schedule created: ${body?.created_rules} standing route(s) for ${body?.created_employees} employee(s).`,
        "success",
      );
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setPhase("done");
      onDone?.();
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Commit failed",
        "error",
      );
    } finally {
      setCommitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!customerId) return;
    setDeactivating(true);
    try {
      const resp = await csrfFetch("/api/v1/trips/roster/deactivate/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": uuidv4() },
        body: JSON.stringify({ customer_ref: customerId }),
      });
      const body = (await resp.json()) as typeof deactivateResult & {
        error?: { message?: string };
      };
      if (!resp.ok) {
        throw new Error(
          (body as { error?: { message?: string } })?.error?.message ??
            `Deactivate failed (${resp.status})`,
        );
      }
      setDeactivateResult(body);
      addToast(
        `Schedule deactivated: ${body?.deactivated_employees} employee(s), ${body?.deactivated_rules} route(s) stopped.`,
        "success",
      );
      void qc.invalidateQueries({ queryKey: keys.trips.rosterStatus(customerId) });
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setConfirmDeactivateOpen(false);
      setPhase("deactivated");
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Deactivate failed",
        "error",
      );
    } finally {
      setDeactivating(false);
    }
  };

  const reset = () => {
    setPhase("upload");
    setPreview(null);
    setExcludedRows(new Set());
    setExpandedGroups(new Set());
    setCommitResult(null);
    setDeactivateResult(null);
  };

  if (phase === "done") {
    return (
      <Card padding="lg" className="text-center py-8 space-y-3">
        <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
        <p className="font-semibold text-text-primary">Standing schedule created</p>
        {commitResult && (
          <>
            <p className="text-sm text-text-secondary">
              {commitResult.created_rules} route(s) for {commitResult.created_employees} employee(s).
              {commitResult.deactivated_prior_rules > 0 && (
                <>
                  {" "}
                  Replaced {commitResult.deactivated_prior_rules} previous route(s) for this
                  customer.
                </>
              )}
            </p>
            <TripActionsReport
              autoCancelled={commitResult.auto_cancelled_trips ?? []}
              needsReview={commitResult.trips_needing_review ?? []}
            />
          </>
        )}
        <Button onClick={reset}>Upload another roster</Button>
      </Card>
    );
  }

  if (phase === "deactivated") {
    return (
      <Card padding="lg" className="text-center py-8 space-y-3">
        <Ban className="w-10 h-10 mx-auto text-text-secondary" />
        <p className="font-semibold text-text-primary">Schedule deactivated</p>
        {deactivateResult && (
          <>
            <p className="text-sm text-text-secondary">
              {deactivateResult.deactivated_employees} employee(s) and{" "}
              {deactivateResult.deactivated_rules} route(s) stopped. No new trips will be
              generated for this customer going forward.
            </p>
            <TripActionsReport
              autoCancelled={deactivateResult.auto_cancelled_trips ?? []}
              needsReview={deactivateResult.trips_needing_review ?? []}
            />
          </>
        )}
        <Button onClick={reset}>Back</Button>
      </Card>
    );
  }

  if (phase === "review" && preview) {
    const includedCount = preview.employee_count - excludedRows.size;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Proposed Pickup/Drop Groups</h3>
          <div className="flex gap-2 text-xs text-text-secondary">
            <span className="text-green-400">{includedCount} of {preview.employee_count} included</span>
            {preview.row_errors.length > 0 && (
              <>
                <span>·</span>
                <span className="text-danger">{preview.row_errors.length} row error(s)</span>
              </>
            )}
          </div>
        </div>

        {preview.row_errors.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {preview.row_errors.map((e) => (
              <div key={e.row} className="p-2 rounded border border-danger/30 bg-danger/5 text-xs">
                <XCircle className="w-3.5 h-3.5 inline mr-1 text-danger" />
                Row {e.row}: {e.errors.join("; ")}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 max-h-[28rem] overflow-y-auto">
          {preview.groups.map((g) => (
            <Card key={g.group_id} padding="md" className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                      g.leg === "PICKUP"
                        ? "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {g.leg === "PICKUP" ? "Pickup (home → office)" : "Drop (office → home)"}
                  </span>
                  <span className="text-xs text-text-secondary">{g.target_time}</span>
                  <span className="text-xs text-text-secondary">
                    {g.days_of_week.map((d) => DAY_LABELS[d]).join(", ")}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <Users className="w-3.5 h-3.5" /> {g.vehicle_type_name}
                  {g.distance_km != null && (
                    <>
                      <span>·</span>
                      <MapPin className="w-3.5 h-3.5" /> {g.distance_km} km
                    </>
                  )}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {g.ordered_stops
                  .filter((s) => s.employee_name)
                  .map((s) => (
                    <label
                      key={`${g.group_id}-${s.row_num}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card-bg text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!excludedRows.has(s.row_num as number)}
                        onChange={() => toggleEmployee(s.row_num as number)}
                      />
                      {s.employee_name}
                    </label>
                  ))}
              </div>

              {expandedGroups.has(g.group_id) ? (
                <div className="space-y-1">
                  <TripMapView stops={stopsToMapStops(g.ordered_stops)} />
                  <button
                    onClick={() => toggleGroupMap(g.group_id)}
                    className="text-xs text-text-tertiary hover:text-brand-blue"
                  >
                    Hide route map
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => toggleGroupMap(g.group_id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border text-xs text-text-secondary hover:border-brand-blue/40 hover:text-brand-blue"
                >
                  <MapIcon className="w-3.5 h-3.5" /> Show route map
                </button>
              )}
            </Card>
          ))}
        </div>

        {hasExistingSchedule && rosterStatus && (
          <div className="flex items-start gap-2 p-3 rounded-lg border border-alert-amber/30 bg-amber-soft text-xs text-[#8A5A14]">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              This will replace this customer&apos;s current standing schedule —{" "}
              {rosterStatus.employee_count} employee(s) across {rosterStatus.route_count} route(s)
              — with the {includedCount} employee(s) proposed above. This cannot be undone.
            </span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={reset} variant="secondary">
            Back
          </Button>
          <Button
            onClick={() => {
              void handleCommit();
            }}
            variant="primary"
            disabled={includedCount === 0 || committing}
            className="flex-1"
          >
            {committing
              ? "Creating…"
              : hasExistingSchedule
                ? `Replace schedule (${includedCount} employee(s))`
                : `Create standing schedule (${includedCount} employee(s))`}{" "}
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormField label="Corporate customer">
        <SearchableSelect
          value={customerId}
          onChange={setCustomerId}
          options={customers.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Search customer…"
        />
      </FormField>

      <FormField
        label="Vendor (optional)"
        hint="Every trip this roster generates routes to this one vendor. Leave blank to let the system pick automatically — and, for pooling, to prefer whichever vendor's own fleet has the biggest vehicle available."
      >
        <SearchableSelect
          value={vendorId}
          onChange={setVendorId}
          options={vendors.map((v) => ({ value: v.id, label: v.name }))}
          placeholder="Any vendor (auto-assigned)"
        />
      </FormField>

      {hasExistingSchedule && rosterStatus && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-ops-card2 text-xs text-text-secondary">
          <Users className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">
            This customer currently has a standing schedule: {rosterStatus.employee_count}{" "}
            employee(s) across {rosterStatus.route_count} route(s). Uploading a new roster will
            replace it entirely.
          </span>
          <button
            onClick={() => setConfirmDeactivateOpen(true)}
            className="shrink-0 text-xs font-medium text-danger hover:underline"
          >
            Deactivate instead
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeactivateOpen}
        title="Deactivate roster schedule?"
        message={
          rosterStatus
            ? `This stops all ${rosterStatus.employee_count} employee(s) across ${rosterStatus.route_count} route(s) for this customer — no new trips will be generated going forward, with no replacement roster. Any already-scheduled solo trip for a removed employee is cancelled automatically; a pooled trip is left running and flagged for you to handle manually.`
            : "This stops this customer's standing schedule entirely, with no replacement."
        }
        confirmLabel="Deactivate"
        destructive
        busy={deactivating}
        onConfirm={() => {
          void handleDeactivate();
        }}
        onCancel={() => setConfirmDeactivateOpen(false)}
      />

      <Card padding="lg" className="border-dashed text-center space-y-3 py-8">
        <Upload className="w-8 h-8 mx-auto text-text-secondary" />
        <p className="text-sm text-text-secondary">
          Upload the employee shift roster (max 1000 rows, 2 MB) with columns:
          <br />
          <code className="text-xs">{REQUIRED_COLUMNS_HINT}</code>
          <br />
          <span className="text-xs">Optional: {OPTIONAL_COLUMNS_HINT}</span>
        </p>
        <label className={`cursor-pointer ${!customerId ? "pointer-events-none opacity-50" : ""}`}>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e);
            }}
            disabled={validating || !customerId}
          />
          <span className="inline-flex items-center px-4 py-2 rounded text-sm font-medium border border-border bg-white text-text-primary cursor-pointer hover:bg-ops-card2">
            {validating ? "Validating…" : customerId ? "Choose File" : "Pick a customer first"}
          </span>
        </label>
      </Card>
    </div>
  );
};

RosterUploadCreation.displayName = "RosterUploadCreation";
