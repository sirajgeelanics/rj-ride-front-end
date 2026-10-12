"use client";

import React, { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMoney } from "@/lib/api";
import { EmptyRow, Section, row, th, thHead } from "@/components/platform/Section";

export default function MoneyPage() {
  const { data, isLoading } = useMoney();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {(data?.totals_by_currency ?? []).map((t) => (
          <div key={t.currency} className="bg-white rounded-2xl border border-border shadow-soft p-4">
            <p className="text-[11px] uppercase tracking-wider font-semibold text-text-tertiary">
              Billed · last {data?.window_months ?? 6} months · {t.currency}
            </p>
            <p className="font-serif text-3xl text-text-primary tabular mt-1">{t.total_display}</p>
            <p className="text-xs text-text-secondary mt-1">
              Operator fee {t.fee_display} · {t.trips} trips
            </p>
          </div>
        ))}
        {!isLoading && (data?.totals_by_currency.length ?? 0) === 0 && (
          <p className="text-sm text-text-secondary">No billed trips in the last 6 months.</p>
        )}
      </div>

      <Section
        title="By tenant"
        hint="Amounts are in each tenant's own currency and are never added across currencies."
      >
        <table className="w-full text-sm">
          <thead>
            <tr className={thHead}>
              <th className="px-5 py-3 font-semibold">Tenant</th>
              <th className={th}>Currency</th>
              <th className={`${th} text-right`}>Completed, not billed</th>
              <th className={`${th} text-right`}>Statements draft / final</th>
              <th className={`${th} text-right`}>Payouts pending</th>
              <th className={`${th} text-right`}>Payouts approved</th>
              <th className="px-5 py-3 font-semibold text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {(data?.tenants ?? []).map((t) => {
              const isOpen = open === t.tenant.id;
              return (
                <Fragment key={t.tenant.id}>
                  <tr className={`${row} cursor-pointer`} onClick={() => setOpen(isOpen ? null : t.tenant.id)}>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                        <ChevronDown className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                        <Link href={`/tenants/${t.tenant.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {t.tenant.name}
                        </Link>
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{t.currency}</td>
                    <td className="px-3 py-3 text-right tabular">{t.completed_not_billed}</td>
                    <td className="px-3 py-3 text-right tabular">{t.statements.DRAFT ?? 0} / {t.statements.FINAL ?? 0}</td>
                    <td className="px-3 py-3 text-right tabular">{t.payouts.PENDING?.net_display ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular">{t.payouts.APPROVED?.net_display ?? "—"}</td>
                    <td className="px-5 py-3 text-right tabular">{t.payouts.PAID?.net_display ?? "—"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-ops-bg/50">
                      <td colSpan={7} className="px-5 py-4">
                        {t.monthly.length === 0 ? (
                          <p className="text-sm text-text-secondary">No billed trips in this window.</p>
                        ) : (
                          <table className="w-full max-w-xl text-sm">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                                <th className="py-1.5 font-semibold">Month</th>
                                <th className="py-1.5 font-semibold text-right">Trips</th>
                                <th className="py-1.5 font-semibold text-right">Billed</th>
                                <th className="py-1.5 font-semibold text-right">Operator fee</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.monthly.map((m) => (
                                <tr key={m.month} className="border-t border-ops-line">
                                  <td className="py-1.5 font-mono text-xs">{m.month}</td>
                                  <td className="py-1.5 text-right tabular">{m.trips}</td>
                                  <td className="py-1.5 text-right tabular">{m.total_display}</td>
                                  <td className="py-1.5 text-right tabular">{m.fee_display}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!isLoading && (data?.tenants.length ?? 0) === 0 && <EmptyRow cols={7} text="No tenants." />}
          </tbody>
        </table>
      </Section>
    </div>
  );
}
