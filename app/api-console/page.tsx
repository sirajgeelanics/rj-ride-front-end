"use client";

import React, { useState } from "react";
import { useLanguageStore, t } from "@/lib/shared";
import { WebhookConfig } from "@/components/api-console/WebhookConfig";
import { ApiTester } from "@/components/api-console/ApiTester";
import { WebhookLogs } from "@/components/api-console/WebhookLogs";
import { ApiDocumentation } from "@/components/api-console/ApiDocumentation";
import { QuoteBookConfirmStepper } from "@/components/partner-api/QuoteBookConfirmStepper";
import { BookOpen, Beaker, Webhook, ListChecks, ShoppingCart } from "lucide-react";

const API_TABS = [
  { id: "docs", labelKey: "documentation" as const, icon: BookOpen },
  { id: "stepper", labelKey: "quoteBookConfirm" as const, icon: ShoppingCart },
  { id: "test", labelKey: "apiTester" as const, icon: Beaker },
  { id: "webhooks", labelKey: "webhooks" as const, icon: Webhook },
  { id: "logs", labelKey: "logs" as const, icon: ListChecks },
];

export default function APIConsolePage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("docs");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">{t("partnerAPIConsole", language)}</h1>
        <p className="text-sm text-text-secondary mt-1">{t("integrateWithRIDE", language)}</p>
      </div>

      <div className="flex gap-1 border-b border-border pb-px">
        {API_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2 rounded-t-lg ${
                activeTab === tab.id
                  ? "bg-ops-sidebar text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-ops-bg"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey, language)}
            </button>
          );
        })}
      </div>

      {activeTab === "docs" && <ApiDocumentation />}
      {activeTab === "stepper" && <QuoteBookConfirmStepper />}
      {activeTab === "test" && <ApiTester />}
      {activeTab === "webhooks" && <WebhookConfig />}
      {activeTab === "logs" && <WebhookLogs />}
    </div>
  );
}
