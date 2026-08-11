"use client";

import React, { useState } from "react";
import { useLanguageStore, t } from "@/lib/shared";
import { Search } from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { VendorsTab } from "@/components/configuration/VendorsTab";
import { CustomersTab } from "@/components/configuration/CustomersTab";
import { VehicleTypesTab } from "@/components/configuration/VehicleTypesTab";
import { VehiclesTab } from "@/components/configuration/VehiclesTab";
import { DriversTab } from "@/components/configuration/DriversTab";

const TABS = [
  { id: "vendors", labelKey: "vendors" as const },
  { id: "customers", labelKey: "customers" as const },
  { id: "vehicle-types", labelKey: "vehicleTypes" as const },
  { id: "vehicles", labelKey: "vehiclesTab" as const },
  { id: "drivers", labelKey: "driversTab" as const },
];

export default function ConfigurationPage() {
  const language = useLanguageStore((s) => s.language);
  const [activeTab, setActiveTab] = useState("vendors");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">{t("configuration", language)}</h1>
        <p className="text-sm text-text-secondary mt-1">{t("manageVendorsCustomersFleet", language)}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder={t("searchThisModule", language)}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-3 py-2 bg-white border border-border rounded-lg text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
        />
      </div>

      <Tabs tabs={TABS.map((tab) => ({ id: tab.id, label: t(tab.labelKey, language) }))} activeTab={activeTab} onChange={setActiveTab}>
        {activeTab === "vendors" && <VendorsTab searchQuery={searchQuery} />}
        {activeTab === "customers" && <CustomersTab searchQuery={searchQuery} />}
        {activeTab === "vehicle-types" && <VehicleTypesTab searchQuery={searchQuery} />}
        {activeTab === "vehicles" && <VehiclesTab searchQuery={searchQuery} />}
        {activeTab === "drivers" && <DriversTab searchQuery={searchQuery} />}
      </Tabs>
    </div>
  );
}
