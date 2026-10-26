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
import { RosterUploadCreation } from "@/components/trips/RosterUploadCreation";
import { CloneCreation } from "@/components/trips/CloneCreation";
import { MethodPicker, TripCreationDialog, type CreationMethod } from "@/components/trips/TripCreationMethods";

const TABS = [{ id: "list", labelKey: "tripRequests" as const }];

export default function TripsPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("list");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creationMethod, setCreationMethod] = useState<CreationMethod | null>(null);

  const closeCreate = () => {
    setShowCreateModal(false);
    setCreationMethod(null);
  };
  const handleTripCreated = closeCreate;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <FleetFilterPanel />
        <Button onClick={() => setShowCreateModal(true)} variant="primary">
          {t("newTripRequest", language)}
        </Button>
      </div>

      <Tabs tabs={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey, language) }))} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === "list" && <TripsListTab />}
      </Tabs>

      {/* Step 1 — pick a method in the side drawer. */}
      <Drawer
        open={showCreateModal && !creationMethod}
        onClose={closeCreate}
        title={t("createTripRequest", language)}
        subtitle={t("createTripSubtitle", language)}
        width="2xl"
      >
        {showCreateModal && !creationMethod && <MethodPicker onSelect={setCreationMethod} />}
      </Drawer>

      {/* Step 2 — the chosen method's form, centred on screen. */}
      {showCreateModal && creationMethod && (
        <TripCreationDialog method={creationMethod} onBack={() => setCreationMethod(null)} onClose={closeCreate}>
          {creationMethod === "MANUAL" && <ManualTripCreation onDone={handleTripCreated} />}
          {creationMethod === "BULK_UPLOAD" && <BulkUploadCreation onDone={handleTripCreated} />}
          {creationMethod === "RECURRING" && <RecurringCreation />}
          {creationMethod === "ROSTER" && <RosterUploadCreation onDone={handleTripCreated} />}
          {creationMethod === "CLONE" && <CloneCreation onDone={handleTripCreated} />}
        </TripCreationDialog>
      )}
    </div>
  );
}
