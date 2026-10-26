import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/shared";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Mail } from "lucide-react";

// Matches apps.tenants.api.serializers.TenantSettingsSerializer's fields — a hand-rolled
// endpoint, not in the generated OpenAPI client (same raw-fetch pattern already used elsewhere
// for endpoints outside the generated client, e.g. the roster upload views).
type TenantSettings = {
  id: string;
  name: string;
  admin_notification_email: string;
  updated_at: string;
};

const TENANT_SETTINGS_KEY = ["tenant-settings"] as const;

/**
 * Configuration -> Notifications: where to email "a trip was allocated to a vendor" alerts
 * (apps.notifications.routing.resolve_admin_assigned_email). Fires for every allocation path —
 * manual assign, roster/bulk upload, a vendor accepting an offer, RITMO auto/manual dispatch —
 * since they all converge on trips.services.transition_vehicle(..., ASSIGNED). Blank = no email
 * sent, which is the default for every tenant until set here.
 *
 * The vendor side of the same alert needs no field here: it already reuses each vendor's own
 * Notification Email from the Vendors tab.
 */
export const NotificationsTab: React.FC = () => {
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

  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setEmail(data.admin_notification_email ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const resp = await csrfFetch("/api/v1/tenant/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notification_email: email.trim() }),
      });
      const body = (await resp.json()) as { result?: TenantSettings; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(body?.error?.message ?? `Save failed (${resp.status})`);
      }
      return body.result;
    },
    onSuccess: () => {
      addToast("Notification settings saved.", "success");
      void qc.invalidateQueries({ queryKey: TENANT_SETTINGS_KEY });
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to save notification settings", "error");
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
            <Mail className="w-4 h-4 text-accent-gold" /> Trip Allocation Alerts
          </h3>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            When a trip is allocated to a vendor — whether booked manually, via roster/bulk
            upload, or through RITMO — RIDE emails this address. Leave blank to turn these alerts
            off. (The vendor itself is emailed separately, at its own Notification Email set under
            the Vendors tab.)
          </p>

          <FormField label="Admin notification email" hint="Leave blank to disable these alerts.">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops@yourcompany.com"
              className="w-full h-9 px-3 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
            />
          </FormField>

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

NotificationsTab.displayName = "NotificationsTab";
