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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-text-primary">{t("partnerAPIConsole", language)}</h1>
        <p className="text-sm text-text-secondary mt-1">{t("integrateWithRIDE", language)}</p>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-border overflow-x-auto custom-scrollbar">
        {API_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`group relative px-4 py-3 -mb-px text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 rounded-t-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${
                activeTab === tab.id
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey, language)}
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${
                  activeTab === tab.id ? "bg-accent-gold" : "bg-transparent group-hover:bg-border"
                }`}
              />
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
