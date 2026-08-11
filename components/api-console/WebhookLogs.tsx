"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { csrfFetch } from "@/lib/shared";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Clock, CheckCircle, AlertCircle, TrendingUp, RefreshCw } from "lucide-react";

interface Subscription {
  id: string;
  url: string;
  credential_name: string | null;
}

/** One delivery attempt. Every retry is its own row, so the whole history is visible. */
interface Delivery {
  id: string;
  subscription_id: string;
  outbox_event_id: string;
  attempt: number;
  status: string; // PENDING | SUCCESS | FAILED | ...
  status_code: number | null;
  response_snippet: string;
  duration_ms: number | null;
  requested_at: string | null;
  created_at: string;
}

async function envelope<T>(resp: Response, fallback: string): Promise<T> {
  const body = (await resp.json().catch(() => ({}))) as {
    result?: T;
    error?: { message?: string };
  };
  if (!resp.ok) throw new Error(body?.error?.message ?? `${fallback} (${resp.status})`);
  return body.result as T;
}

export const WebhookLogs: React.FC = () => {
  const [selectedWebhookId, setSelectedWebhookId] = useState<string>("");

  const { data: endpoints = [] } = useQuery({
    queryKey: ["webhooks", "subscriptions"],
    queryFn: async (): Promise<Subscription[]> => {
      const resp = await csrfFetch("/api/v1/webhooks/", { credentials: "include" });
      return envelope<Subscription[]>(resp, "Failed to load webhooks");
    },
  });

  // Deliveries are per-subscription on the backend; with none picked we merge across all of them.
  const {
    data: logs = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["webhooks", "deliveries", selectedWebhookId, endpoints.map((e) => e.id).join(",")],
    enabled: endpoints.length > 0,
    queryFn: async (): Promise<Delivery[]> => {
      const targets = selectedWebhookId
        ? endpoints.filter((e) => e.id === selectedWebhookId)
        : endpoints;
      const batches = await Promise.all(
        targets.map(async (e) => {
          const resp = await csrfFetch(`/api/v1/webhooks/${e.id}/deliveries/`, {
            credentials: "include",
          });
          return envelope<Delivery[]>(resp, "Failed to load deliveries");
        }),
      );
      return batches
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    refetchInterval: 30_000,
  });

  const stats = useMemo(() => {
    const is = (s: string) => (d: Delivery) => d.status.toUpperCase() === s;
    return {
      total: logs.length,
      success: logs.filter(is("SUCCESS")).length,
      failed: logs.filter(is("FAILED")).length,
      pending: logs.filter(is("PENDING")).length,
    };
  }, [logs]);

  const badgeFor = (status: string) => {
    const s = status.toUpperCase();
    if (s === "SUCCESS") return "green";
    if (s === "FAILED") return "red";
    return "amber";
  };

  const urlFor = (id: string) => endpoints.find((e) => e.id === id)?.url ?? "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: TrendingUp },
          { label: "Success", value: stats.success, icon: CheckCircle },
          { label: "Failed", value: stats.failed, icon: AlertCircle },
          { label: "Pending", value: stats.pending, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} padding="md" className="bg-ops-bg border border-border">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-text-secondary" />
              <div>
                <p className="text-xs text-text-secondary">{label}</p>
                <p className="text-lg font-semibold text-text-primary">{value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Endpoint</label>
          <SearchableSelect
            value={selectedWebhookId}
            onChange={setSelectedWebhookId}
            options={endpoints.map((e) => ({ value: e.id, label: e.url }))}
            placeholder="All endpoints"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {endpoints.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-8">
          <p>No webhook endpoints yet — register one under the Webhooks tab first.</p>
        </Card>
      ) : isLoading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading deliveries…</div>
      ) : logs.length === 0 ? (
        <Card padding="lg" className="text-center text-text-secondary py-8">
          <p>No delivery attempts recorded yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badgeFor(log.status)}>{log.status}</Badge>
                    {log.status_code != null && (
                      <span className="text-xs font-mono text-text-secondary">
                        HTTP {log.status_code}
                      </span>
                    )}
                    <span className="text-xs text-text-tertiary">attempt {log.attempt}</span>
                    {log.duration_ms != null && (
                      <span className="text-xs text-text-tertiary">{log.duration_ms} ms</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-text-secondary mt-1 break-all">
                    {urlFor(log.subscription_id)}
                  </p>
                  {log.response_snippet && (
                    <p className="text-xs text-text-tertiary mt-1 break-all">
                      {log.response_snippet}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-tertiary shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

WebhookLogs.displayName = "WebhookLogs";
