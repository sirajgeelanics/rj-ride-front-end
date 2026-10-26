import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ShieldCheck } from "lucide-react";

// Matches apps.tenants.api.serializers.TenantSettingsSerializer's fields. Not in the generated
// OpenAPI schema (a hand-rolled APIView, not a ModelViewSet) — raw fetch, same pattern already
// used elsewhere in this codebase for endpoints outside the generated client (e.g. the roster
// upload views, /tracking/live/).
type TenantSettings = {
  id: string;
  name: string;
  safety_config: Record<string, number | null>;
  updated_at: string;
};

const TENANT_SETTINGS_KEY = ["tenant-settings"] as const;
const DEFAULT_RADIUS_M = 200;
const DEFAULT_MAX_AGE_MINUTES = 15;

/**
 * Configuration -> Safety: the pickup/drop geofence gate (apps.trips.services._enforce_
 * geofence). Opt-in per tenant, off by default — this is the only place to turn it on; before
 * this tab existed, the only way was editing Tenant.safety_config's raw JSON in Django admin.
 *
 * Only edits the two geofence-related keys inside safety_config and otherwise preserves it
 * byte-for-byte: safety_config is a single flat JSON object that can hold OTHER threshold
 * overrides too (overspeed_kmh, route_corridor_km, ...), and the PATCH endpoint replaces the
 * whole field rather than merging — so saving this form must carry those other keys through
 * unchanged, not silently drop them.
 */
export const SafetyTab: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<TenantSettings>({
    queryKey: TENANT_SETTINGS_KEY,
    queryFn: async () => {
      const resp = await fetch("/api/v1/tenant/", { credentials: "include" });
      if (!resp.ok) throw new Error(`tenant settings failed: ${resp.status}`);
      const envelope = (await resp.json()) as { result: TenantSettings };
      return envelope.result;
    },
  });

  const [enabled, setEnabled] = useState(false);
  const [radiusM, setRadiusM] = useState(String(DEFAULT_RADIUS_M));
  const [maxAgeMinutes, setMaxAgeMinutes] = useState(String(DEFAULT_MAX_AGE_MINUTES));

  // Re-sync the form from the server whenever fresh data loads — never mid-edit (the query
  // only ever refetches after this tab's own successful save, so there is no "someone else
  // changed it under me" case to guard against here).
  useEffect(() => {
    if (!data) return;
    const radius = data.safety_config?.geofence_radius_m;
    setEnabled(radius != null);
    setRadiusM(radius != null ? String(radius) : String(DEFAULT_RADIUS_M));
    const maxAge = data.safety_config?.geofence_position_max_age_minutes;
    setMaxAgeMinutes(maxAge != null ? String(maxAge) : String(DEFAULT_MAX_AGE_MINUTES));
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const merged: Record<string, number | null> = { ...(data?.safety_config ?? {}) };

      if (!enabled) {
        merged.geofence_radius_m = null;
      } else {
        const radius = Number(radiusM);
        if (!Number.isFinite(radius) || radius < 0) {
          throw new Error("Radius must be a non-negative number of metres.");
        }
        merged.geofence_radius_m = radius;

        if (maxAgeMinutes.trim() !== "") {
          const maxAge = Number(maxAgeMinutes);
          if (!Number.isFinite(maxAge) || maxAge < 0) {
            throw new Error("Max position age must be a non-negative number of minutes.");
          }
          merged.geofence_position_max_age_minutes = maxAge;
        }
      }

      const resp = await csrfFetch("/api/v1/tenant/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safety_config: merged }),
      });
      const body = (await resp.json()) as { result?: TenantSettings; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(body?.error?.message ?? `Save failed (${resp.status})`);
      }
      return body.result;
    },
    onSuccess: () => {
      addToast("Geofencing settings saved.", "success");
      void qc.invalidateQueries({ queryKey: TENANT_SETTINGS_KEY });
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to save geofencing settings", "error");
    },
  });

  if (isLoading) {
    return (
      <Card padding="lg" className="text-center text-text-secondary py-10">
        Loading settings…
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card
        padding="md"
        header={
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent-gold" /> Pickup/Drop Geofencing
          </h3>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            When enabled, confirming a passenger's pickup or drop (with or without OTP) is
            blocked unless the vehicle's last known position is within the radius below of that
            stop. Off by default for every tenant until set here.
          </p>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Require the vehicle to be near the stop
          </label>

          {enabled && (
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Radius (metres)"
                hint="0 means the vehicle must be exactly at the stop."
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={radiusM}
                  onChange={(e) => setRadiusM(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </FormField>
              <FormField
                label="Ignore position older than (minutes)"
                hint="A stale position never satisfies the check."
              >
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={maxAgeMinutes}
                  onChange={(e) => setMaxAgeMinutes(e.target.value)}
                  className="w-full h-9 px-3 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
                />
              </FormField>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

SafetyTab.displayName = "SafetyTab";
