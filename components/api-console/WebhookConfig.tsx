"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { csrfFetch, isApiError } from "@/lib/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToastStore } from "@/stores/toastStore";
import { Trash2, Plus, Copy, RefreshCw } from "lucide-react";

/** The catalog the backend validates against (apps/partner_api/public_events.py). */
const AVAILABLE_EVENTS = [
  "trip.created",
  "trip.assigned",
  "trip.vehicle.status_changed",
  "trip.completed",
  "trip.cancelled",
  "billing.created",
  "trip.offer_made",
  "trip.offer_alerted",
  "trip.offer_expired",
  "trip.offer_withdrawn",
];

interface Subscription {
  id: string;
  credential_id: string;
  credential_name: string | null;
  url: string;
  event_types: string[];
  is_active: boolean;
  consecutive_failures: number;
  disabled_until: string | null;
  created_at: string;
  /** Returned exactly once, by the create call. */
  secret?: string;
}

interface Credential {
  id: string;
  name: string;
}

async function readEnvelope<T>(resp: Response, fallback: string): Promise<T> {
  const body = (await resp.json().catch(() => ({}))) as {
    result?: T;
    error?: { message?: string };
  };
  if (!resp.ok) throw new Error(body?.error?.message ?? `${fallback} (${resp.status})`);
  return body.result as T;
}

export const WebhookConfig: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [showDrawer, setShowDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState({ credential_id: "", url: "", events: [] as string[] });

  const { data: endpoints = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["webhooks", "subscriptions"],
    queryFn: async (): Promise<Subscription[]> => {
      const resp = await csrfFetch("/api/v1/webhooks/", { credentials: "include" });
      return readEnvelope<Subscription[]>(resp, "Failed to load webhooks");
    },
  });

  const { data: credentials = [] } = useQuery({
    queryKey: ["partner-credentials", "list"],
    queryFn: async (): Promise<Credential[]> => {
      const resp = await csrfFetch("/api/v1/partner-credentials/", { credentials: "include" });
      const body = (await resp.json().catch(() => ({}))) as {
        results?: Credential[];
        result?: Credential[];
      };
      // The viewset is paginated; fall back to the envelope shape if that ever changes.
      return body.results ?? body.result ?? [];
    },
    staleTime: 60_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["webhooks", "subscriptions"] });

  const handleAddEndpoint = async () => {
    if (!formData.credential_id || !formData.url || formData.events.length === 0) {
      addToast("Pick a credential, a URL, and at least one event.", "error");
      return;
    }
    setSaving(true);
    try {
      const resp = await csrfFetch("/api/v1/webhooks/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential_id: formData.credential_id,
          url: formData.url,
          event_types: formData.events,
        }),
      });
      const created = await readEnvelope<Subscription>(resp, "Create failed");
      addToast("Webhook registered", "success");
      // The signing secret is returned once and never again — surface it immediately.
      setNewSecret(created.secret ?? null);
      setFormData({ credential_id: "", url: "", events: [] });
      setShowDrawer(false);
      void invalidate();
    } catch (err) {
      addToast(
        isApiError(err) ? err.message : err instanceof Error ? err.message : "Create failed",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (sub: Subscription) => {
    try {
      const resp = await csrfFetch(`/api/v1/webhooks/${sub.id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !sub.is_active }),
      });
      await readEnvelope<Subscription>(resp, "Update failed");
      addToast(sub.is_active ? "Webhook paused" : "Webhook activated", "success");
      void invalidate();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const removeEndpoint = async (sub: Subscription) => {
    try {
      const resp = await csrfFetch(`/api/v1/webhooks/${sub.id}/`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok && resp.status !== 204) throw new Error(`Delete failed (${resp.status})`);
      addToast("Webhook removed", "success");
      void invalidate();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const toggleEvent = (event: string) =>
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">🪝 Webhook Endpoints</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            RIDE POSTs events to these URLs. Each endpoint belongs to an API credential.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowDrawer(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Webhook
          </Button>
        </div>
      </div>

      {newSecret && (
        <Card padding="md" className="border-warning/40 bg-warning/5">
          <p className="text-xs font-semibold text-text-primary mb-1">
            Signing secret — shown once, copy it now
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono break-all text-text-primary">{newSecret}</code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(newSecret);
                addToast("Secret copied", "success");
              }}
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading webhooks…</div>
      ) : endpoints.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-8">
          <p>No webhooks registered. Add one to start receiving events.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep) => (
            <Card key={ep.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={ep.is_active ? "green" : "amber"}>
                      {ep.is_active ? "Active" : "Paused"}
                    </Badge>
                    <span className="text-sm font-mono text-text-primary break-all">{ep.url}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Credential: {ep.credential_name ?? "—"}
                    {ep.consecutive_failures > 0 && (
                      <span className="ml-2 text-danger">
                        {ep.consecutive_failures} consecutive failure(s)
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ep.event_types.map((e) => (
                      <span
                        key={e}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue font-mono"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => void toggleActive(ep)}>
                    {ep.is_active ? "Pause" : "Activate"}
                  </Button>
                  <button
                    onClick={() => void removeEndpoint(ep)}
                    className="text-danger hover:text-danger/80 transition-colors"
                    title="Remove endpoint"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        title="Add Webhook Endpoint"
        width="lg"
      >
        <div className="space-y-4">
          <FormField label="API Credential" required>
            <SearchableSelect
              value={formData.credential_id}
              onChange={(val) => setFormData((p) => ({ ...p, credential_id: val }))}
              options={credentials.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Search credential…"
            />
          </FormField>

          <FormField label="Endpoint URL" required>
            <Input
              value={formData.url}
              onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://partner.example.com/hooks/ride"
            />
          </FormField>

          <FormField label="Events" required>
            <div className="grid grid-cols-2 gap-1.5">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex items-center gap-2 text-xs text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.events.includes(event)}
                    onChange={() => toggleEvent(event)}
                  />
                  <span className="font-mono">{event}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => void handleAddEndpoint()} className="flex-1" disabled={saving}>
              {saving ? "Saving…" : "Register Endpoint"}
            </Button>
            <Button variant="secondary" onClick={() => setShowDrawer(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

WebhookConfig.displayName = "WebhookConfig";
