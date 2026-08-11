"use client";

import React, { useState } from "react";
import { useLanguageStore, t } from "@/lib/shared";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { TripsListTab } from "@/components/trips/TripsListTab";
import { FleetFilterPanel } from "@/components/trips/FleetFilterPanel";
import { ManualTripCreation } from "@/components/trips/ManualTripCreation";
import { BulkUploadCreation } from "@/components/trips/BulkUploadCreation";
import { RecurringCreation } from "@/components/trips/RecurringCreation";
import { CloneCreation } from "@/components/trips/CloneCreation";

const TABS = [{ id: "list", labelKey: "tripRequests" as const }];

export default function TripsPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationMethod, setCreationMethod] = useState<"MANUAL" | "BULK_UPLOAD" | "RECURRING" | "CLONE" | null>(null);

  const handleTripCreated = () => {
    setShowCreateModal(false);
    setCreationMethod(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">{t("tripRequests", language)}</h1>
          <p className="text-sm text-text-secondary mt-1">{t("manageConvoyBasedRequests", language)}</p>
        </div>
        <div className="flex items-center gap-3">
          <FleetFilterPanel />
          <Button onClick={() => setShowCreateModal(true)} variant="primary">
            {t("newTripRequest", language)}
          </Button>
        </div>
      </div>

      <Card padding="md" className="bg-brand-blue/5 border-brand-blue/20">
        <p className="text-xs text-text-tertiary">
          <span className="font-semibold text-brand-blue">{t("convoyModel", language)}:</span> {t("convoyModelDescription", language)}
        </p>
      </Card>

      <Tabs tabs={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey, language) }))} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === "list" && <TripsListTab />}
      </Tabs>

      <Drawer open={showCreateModal} onClose={() => setShowCreateModal(false)} title={t("createTripRequest", language)} width="2xl">
        {!creationMethod ? (
          <div className="flex flex-col justify-center h-full space-y-4 px-2">
            <p className="text-sm text-text-secondary text-center mb-2">{t("chooseCreationMethod", language)}:</p>
            <Button onClick={() => setCreationMethod("MANUAL")} variant="primary" className="w-full justify-start py-3">
              {t("manualEntry", language)}
            </Button>
            <Button onClick={() => setCreationMethod("BULK_UPLOAD")} variant="secondary" className="w-full justify-start py-3">
              {t("bulkUploadCSV", language)}
            </Button>
            <Button onClick={() => setCreationMethod("RECURRING")} variant="secondary" className="w-full justify-start py-3">
              {t("recurringGenerator", language)}
            </Button>
            <Button onClick={() => setCreationMethod("CLONE")} variant="secondary" className="w-full justify-start py-3">
              {t("cloneExistingTrip", language)}
            </Button>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <button
              onClick={() => setCreationMethod(null)}
              className="text-sm text-brand-blue hover:text-brand-blue/80 mb-4 self-start"
            >
              ← {t("backToMethods", language)}
            </button>
            <div className="flex-1 overflow-y-auto -mx-4 px-4">
              {creationMethod === "MANUAL" && <ManualTripCreation onDone={handleTripCreated} />}
              {creationMethod === "BULK_UPLOAD" && <BulkUploadCreation onDone={handleTripCreated} />}
              {creationMethod === "RECURRING" && <RecurringCreation />}
              {creationMethod === "CLONE" && <CloneCreation onDone={handleTripCreated} />}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
