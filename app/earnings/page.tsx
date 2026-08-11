"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, useLanguageStore, t } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import { DollarSign, FileText, Download, CircleDollarSign } from "lucide-react";

type Payout = components["schemas"]["Payout"];
type Statement = components["schemas"]["Statement"];

const TABS = [
  { id: "payouts", label: "Payouts" },
  { id: "statements", label: "Statements" },
];

function PayoutsTab() {

  const { data, isLoading } = useQuery({
    queryKey: keys.billing.payouts.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/payouts", {
        params: { query: {} },
      });
      if (err) throw err;
      return res?.results ?? [];
    },
  });

  const payouts: Payout[] = data ?? [];

  const totalPending = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.net_minor, 0);
  const totalPaid = payouts.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.net_minor, 0);
  const currency = payouts[0]?.currency ?? "USD";

  if (isLoading) return <div className="text-center py-8 text-text-muted text-sm">Loading payouts…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Pending</p>
          <p className="text-xl font-bold text-warning mt-1">
            {payouts.length > 0 ? formatMoney(totalPending, currency) : "—"}
          </p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Paid Out</p>
          <p className="text-xl font-bold text-success mt-1">
            {payouts.length > 0 ? formatMoney(totalPaid, currency) : "—"}
          </p>
        </div>
        <div className="bg-card-bg border border-card-border rounded-xl p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Total Payouts</p>
          <p className="text-xl font-bold text-text-primary mt-1">{payouts.length}</p>
        </div>
      </div>

      {payouts.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <CircleDollarSign className="w-10 h-10 text-text-muted mx-auto" />
          <p className="text-text-muted text-sm">No payouts yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((payout) => (
            <div key={payout.id} className="bg-card-bg border border-card-border rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-brand-blue/10 rounded-lg flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 text-brand-blue" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-text-primary">
                        {formatMoney(payout.net_minor, payout.currency)}
                      </p>
                      <StatusBadge status={payout.status ?? "PENDING"} />
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      <span>
                        {new Date(payout.period_year, payout.period_month - 1).toLocaleString(undefined, { month: "short", year: "numeric" })}
                      </span>
                      {" · "}
                      <span>
                        Gross {formatMoney(payout.gross_minor, payout.currency)} · Fee {formatMoney(payout.operator_fee_minor, payout.currency)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {payout.paid_at && (
                    <p className="text-xs text-text-muted">
                      Paid {new Date(payout.paid_at).toLocaleDateString()}
                    </p>
                  )}
                  {payout.approved_at && !payout.paid_at && (
                    <p className="text-xs text-text-muted">
                      Approved {new Date(payout.approved_at).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-xs font-mono text-text-muted mt-0.5">{payout.id.substring(0, 8)}…</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatementsTab() {
  const { data, isLoading } = useQuery({
    queryKey: keys.billing.statements.list({}),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/billing/statements", {
        params: { query: {} },
      });
      if (err) throw err;
      return res?.results ?? [];
    },
  });

  const statements: Statement[] = data ?? [];

  const handleDownload = async (id: string) => {
    const { data: res } = await apiClient.GET("/v1/billing/statements/{id}/download", {
      params: { path: { id } },
    });
    const url = (res as unknown as { url?: string } | undefined)?.url;
    if (url) window.open(url, "_blank");
  };

  if (isLoading) return <div className="text-center py-8 text-text-muted text-sm">Loading statements…</div>;

  if (statements.length === 0) return (
    <div className="text-center py-12 space-y-2">
      <FileText className="w-10 h-10 text-text-muted mx-auto" />
      <p className="text-text-muted text-sm">No statements available</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {statements.map((stmt) => (
        <div key={stmt.id} className="bg-card-bg border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-blue/10 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-brand-blue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {formatMoney(stmt.total_minor ?? 0, stmt.currency)}
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  <span>
                    {new Date(stmt.period_year, stmt.period_month - 1).toLocaleString(undefined, { month: "short", year: "numeric" })}
                  </span>
                  <span> · {stmt.lines.length} line(s)</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDownload(stmt.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-blue border border-brand-blue/30 rounded-lg hover:bg-brand-blue/5 transition-colors font-medium"
            >
              <Download className="w-3 h-3" /> Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function EarningsPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("payouts");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-text-primary">{t("earnings", language)}</h2>
        <p className="text-sm text-text-muted mt-1">Your payouts and billing statements</p>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === "payouts" && <PayoutsTab />}
      {activeTab === "statements" && <StatementsTab />}
    </div>
  );
}
