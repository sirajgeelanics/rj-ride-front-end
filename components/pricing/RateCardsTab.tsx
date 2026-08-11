"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguageStore, t, apiClient, keys, QueryBoundary, formatMoney, toMinor, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { useToastStore } from "@/stores/toastStore";

type RateCard = components["schemas"]["RateCard"];
type BasisEnum = components["schemas"]["BasisEnum"];

type RateCardInput = {
  vendor_id: string;
  customer_id: string;
  vehicle_type_id: string;
  basis: BasisEnum;
  rate_per_km_minor?: number | null;
  rate_per_hour_minor?: number | null;
  currency?: string;
  modifiers?: Record<string, unknown>;
  valid_from: string;
  valid_to?: string | null;
};

interface RateCardsTabProps {
  searchQuery?: string;
}

// The backend RateCardWriteSerializer expects `vendor`/`customer`/`vehicle_type` (not the
// `_id`-suffixed form-state names). Map before sending or the POST 400s ("vendor is required").
function toWire(input: RateCardInput): Record<string, unknown> {
  return {
    vendor: input.vendor_id,
    customer: input.customer_id,
    vehicle_type: input.vehicle_type_id,
    basis: input.basis,
    rate_per_km_minor: input.rate_per_km_minor ?? undefined,
    rate_per_hour_minor: input.rate_per_hour_minor ?? undefined,
    currency: input.currency || undefined,
    modifiers: input.modifiers,
    valid_from: input.valid_from,
    // Explicit null, not undefined: on a PATCH edit an omitted key leaves valid_to unchanged,
    // so clearing an end date has to send null to reset the card back to open-ended. The date
    // picker yields a string or undefined (never ""), so `?? null` gives a date or null.
    valid_to: input.valid_to ?? null,
  };
}

export const RateCardsTab: React.FC<RateCardsTabProps> = ({ searchQuery = "" }) => {
  const language = useLanguageStore((s) => s.language);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  // Local component state — these three only ever narrowed this one table, so a cross-app
  // store bought nothing. Resets when you leave the tab, which is the expected behaviour for
  // a filter row anyway.
  const [rateCardVendorId, setRateCardVendorId] = useState("");
  const [rateCardCustomerId, setRateCardCustomerId] = useState("");
  const [rateCardVehicleTypeId, setRateCardVehicleTypeId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.rateCards.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/pricing/rate-cards", {});
      if (err) throw err;
      return res;
    },
  });

  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {});
      if (err) throw err;
      return res;
    },
  });

  const { data: customersData } = useQuery({
    queryKey: keys.config.customers.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/customers", {});
      if (err) throw err;
      return res;
    },
  });

  const { data: vehicleTypesData } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vehicle-types", {});
      if (err) throw err;
      return res;
    },
  });

  const rateCards = (data?.results ?? []) as RateCard[];
  const vendors = (vendorsData?.results ?? []) as components["schemas"]["Vendor"][];
  const customers = (customersData?.results ?? []) as components["schemas"]["Customer"][];
  const vts = (vehicleTypesData?.results ?? []) as components["schemas"]["VehicleType"][];

  const filteredRateCards = rateCards.filter((r) => {
    if (rateCardVendorId && r.vendor !== rateCardVendorId) return false;
    if (rateCardCustomerId && r.customer !== rateCardCustomerId) return false;
    if (rateCardVehicleTypeId && r.vehicle_type !== rateCardVehicleTypeId) return false;
    if (searchQuery.trim() && !r.basis.toLowerCase().includes(searchQuery.toLowerCase()) && !r.valid_from.includes(searchQuery)) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (input: RateCardInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/pricing/rate-cards", { body: toWire(input) as unknown as RateCard });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast(t("rateCardCreated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create rate card", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RateCardInput }) => {
      // PATCH edits this version in place — the version number does not move. Only the
      // supersede action publishes v+1.
      //
      // csrfFetch, not apiClient: PATCH on this path is not in the committed OpenAPI schema
      // (schema.yaml is stale), so the generated types reject it.
      const resp = await csrfFetch(`/api/v1/config/pricing/rate-cards/${id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toWire(input)),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? `Failed to update rate card (${resp.status})`);
      }
      return (await resp.json()) as unknown;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast("Rate card updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to update rate card", "error");
    },
  });

  const supersedeMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RateCardInput }) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/pricing/rate-cards/{id}/supersede", {
        params: { path: { id } },
        body: toWire(input) as unknown as RateCard,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast(t("newVersionCreated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to supersede rate card", "error");
    },
  });

  const today = new Date().toISOString().split("T")[0] ?? "";
  const emptyForm: RateCardInput = {
    vendor_id: vendors[0]?.id ?? "",
    customer_id: customers[0]?.id ?? "",
    vehicle_type_id: vts[0]?.id ?? "",
    basis: "PER_KM",
    rate_per_km_minor: 2000,
    modifiers: { min_fare_minor: 20000 },
    valid_from: today,
    currency: "USD",
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [supersedingId, setSupersedingId] = useState<string | null>(null);
  // "edit"      -> PATCH the card, version unchanged.
  // "supersede" -> publish version + 1 and close the old one.
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "supersede">("create");
  const [formData, setFormData] = useState<RateCardInput>(emptyForm);

  /**
   * The rate inputs are held as text in *dollars*, not as numbers in the `_minor` fields.
   *
   * Two reasons. First, typing 22 used to be written straight into `rate_per_km_minor`, which
   * the API and the table both read as 22 *cents* — the card came back as $0.22. Second, a
   * number input backed by `minor / 100` cannot be typed into: after "22." parseFloat yields
   * 22, the field snaps back to "22", and the next keystroke gives 225 instead of 22.5.
   * Keeping the raw string until save fixes both.
   */
  const [rateText, setRateText] = useState<{ perKm: string; perHour: string }>({
    perKm: "",
    perHour: "",
  });

  /** Minor units → an editable dollar string. Blank for "not set", so the field starts empty. */
  const minorToDollarText = (minor?: number | null): string =>
    minor == null ? "" : String(minor / 100);

  const openCreate = () => {
    setDrawerMode("create");
    setSupersedingId(null);
    setFormData({ ...emptyForm, vendor_id: vendors[0]?.id ?? "", customer_id: customers[0]?.id ?? "", vehicle_type_id: vts[0]?.id ?? "" });
    setRateText({
      perKm: minorToDollarText(emptyForm.rate_per_km_minor),
      perHour: minorToDollarText(emptyForm.rate_per_hour_minor),
    });
    setDrawerOpen(true);
  };

  const openEdit = (rc: RateCard) => {
    setDrawerMode("edit");
    setSupersedingId(rc.id);
    seedForm(rc);
  };

  const openSupersede = (rc: RateCard) => {
    setDrawerMode("supersede");
    setSupersedingId(rc.id);
    seedForm(rc);
    setFormData((prev) => ({ ...prev, valid_from: today }));
  };

  const seedForm = (rc: RateCard) => {
    setFormData({
      vendor_id: rc.vendor,
      customer_id: rc.customer,
      vehicle_type_id: rc.vehicle_type,
      basis: rc.basis,
      rate_per_km_minor: rc.rate_per_km_minor,
      rate_per_hour_minor: rc.rate_per_hour_minor,
      modifiers: rc.modifiers as Record<string, unknown> | undefined,
      // Edit keeps the card's own start date; a supersede overrides it to today below,
      // because a new version starts when it is published.
      valid_from: rc.valid_from,
      valid_to: rc.valid_to,
      currency: rc.currency,
    });
    setRateText({
      perKm: minorToDollarText(rc.rate_per_km_minor),
      perHour: minorToDollarText(rc.rate_per_hour_minor),
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.vendor_id || !formData.customer_id || !formData.vehicle_type_id) {
      addToast(t("vendorCustomerVehicleRequired", language), "error");
      return;
    }

    const currency = formData.currency ?? "USD";
    // Convert at the boundary: what the operator typed is dollars, what the API stores is cents.
    const toMinorOrUndefined = (text: string): number | undefined => {
      const trimmed = text.trim();
      if (!trimmed) return undefined;
      const value = Number(trimmed);
      if (!Number.isFinite(value) || value < 0) return undefined;
      return toMinor(value, currency);
    };

    const perKm = toMinorOrUndefined(rateText.perKm);
    const perHour = toMinorOrUndefined(rateText.perHour);

    if (formData.basis === "PER_KM" && perKm === undefined) {
      addToast("Enter a per-km rate.", "error");
      return;
    }
    if (formData.basis === "HOURLY" && perHour === undefined) {
      addToast("Enter an hourly rate.", "error");
      return;
    }

    const input: RateCardInput = {
      ...formData,
      rate_per_km_minor: perKm,
      rate_per_hour_minor: perHour,
    };

    if (drawerMode === "edit" && supersedingId) {
      updateMutation.mutate({ id: supersedingId, input });
    } else if (drawerMode === "supersede" && supersedingId) {
      supersedeMutation.mutate({ id: supersedingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const columns: Column[] = [
    {
      key: "basis",
      header: t("basis", language),
      sortable: true,
      render: (val): React.ReactNode => <Badge variant="blue">{val as string}</Badge>,
    },
    {
      key: "vendor_name",
      header: t("vendor", language),
      sortable: true,
      render: (val): React.ReactNode => (val ? (val as string) : t("dash", language)),
    },
    {
      key: "customer_name",
      header: t("customer", language),
      sortable: true,
      render: (val): React.ReactNode => (val ? (val as string) : t("dash", language)),
    },
    {
      key: "vehicle_type_name",
      header: t("vehicleType", language),
      sortable: true,
      render: (val, row): React.ReactNode => {
        const name = val ? (val as string) : t("dash", language);
        const vt = vts.find((v) => v.id === (row as Record<string, unknown>).vehicle_type);
        return vt && typeof vt.luggage_capacity === "number"
          ? `${name} · ${vt.luggage_capacity} bag${vt.luggage_capacity === 1 ? "" : "s"}`
          : name;
      },
    },
    {
      key: "rate_per_km_minor",
      header: t("perKm", language),
      render: (val): React.ReactNode => (val ? formatMoney(val as number, "USD") : t("dash", language)),
    },
    {
      key: "rate_per_hour_minor",
      header: t("hourly", language),
      render: (val): React.ReactNode => (val ? formatMoney(val as number, "USD") : t("dash", language)),
    },
    { key: "valid_from", header: t("validFrom", language), sortable: true },
    {
      key: "valid_to",
      header: t("validTo", language),
      render: (val): React.ReactNode => (val ? (val as string) : "∞"),
    },
    {
      key: "version",
      header: t("version", language),
      sortable: true,
      render: (val): React.ReactNode => <Badge variant="purple">v{val as number}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      // Both actions open the same drawer. Rate cards are copy-on-write in the backend
      // (apps/pricing/services.supersede_rate_card): a card that has priced an Offer is
      // evidence of what someone was quoted, so editing in place would rewrite history and
      // break the price-lock chain. "Edit rates" means "correct the numbers" (PATCH, version
      // unchanged); "New version" publishes v+1 and closes this card. There is no delete —
      // rate cards are never destroyed (versioned, append-only).
      render: (_, row): React.ReactNode => {
        const rc = row as unknown as RateCard;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(rc)}
              title={`Edit v${rc.version} in place — the version number does not change`}
            >
              {t("edit", language)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openSupersede(rc)}
              title={`Publish v${rc.version + 1} based on this card`}
            >
              {t("newVersion", language)}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-ops-sidebar">
          {t("rateCards", language)} ({filteredRateCards.length})
        </h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          {t("newRateCard", language)}
        </Button>
      </div>

      {/* Comboboxes rather than native <select>: these lists grow with the tenant (every vendor,
          every customer), and scrolling a 60-row native dropdown to find one name is the slow
          part of building a rate card. The leading "All …" entry has value "" so the filter can
          be cleared from inside the same list. */}
      <div className="flex gap-3 flex-wrap">
        <SearchableSelect
          className="w-48"
          value={rateCardVendorId}
          onChange={setRateCardVendorId}
          placeholder="Search vendor…"
          options={[
            { value: "", label: "All vendors" },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
        <SearchableSelect
          className="w-48"
          value={rateCardCustomerId}
          onChange={setRateCardCustomerId}
          placeholder="Search customer…"
          options={[
            { value: "", label: "All customers" },
            ...customers.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <SearchableSelect
          className="w-48"
          value={rateCardVehicleTypeId}
          onChange={setRateCardVehicleTypeId}
          placeholder="Search vehicle type…"
          options={[
            { value: "", label: "All types" },
            ...vts.map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
      </div>

      <QueryBoundary isLoading={isLoading} error={error} isEmpty={filteredRateCards.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">{t("noRateCards", language)}</p>}>
        <DataTable
          columns={columns}
          data={filteredRateCards as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage={t("noRateCards", language)}
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          drawerMode === "edit"
            ? "Edit this version (version number unchanged)"
            : drawerMode === "supersede"
              ? t("newVersion", language)
              : t("newRateCard", language)
        }
        width="lg"
      >
        <div className="space-y-4">
          <FormField label={t("vendor", language)} required>
            {supersedingId ? (
              // Locked while superseding: changing these would be a different deal, not a new
              // version of this one, and supersede_rate_card rejects it with a 400.
              <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                {vendors.find((o) => o.id === formData.vendor_id)?.name ?? "—"}
                <span className="ml-2 text-xs text-text-muted">(cannot change in a new version)</span>
              </div>
            ) : (
              <SearchableSelect
                value={formData.vendor_id}
                onChange={(value) => setFormData({ ...formData, vendor_id: value })}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vendor…"
              />
            )}
          </FormField>

          <FormField label={t("customer", language)} required>
            {supersedingId ? (
              // Locked while superseding: changing these would be a different deal, not a new
              // version of this one, and supersede_rate_card rejects it with a 400.
              <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                {customers.find((o) => o.id === formData.customer_id)?.name ?? "—"}
                <span className="ml-2 text-xs text-text-muted">(cannot change in a new version)</span>
              </div>
            ) : (
              <SearchableSelect
                value={formData.customer_id}
                onChange={(value) => setFormData({ ...formData, customer_id: value })}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Search customer…"
              />
            )}
          </FormField>

          <FormField label={t("vehicleType", language)} required>
            {supersedingId ? (
              // Locked while superseding: changing these would be a different deal, not a new
              // version of this one, and supersede_rate_card rejects it with a 400.
              <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                {vts.find((o) => o.id === formData.vehicle_type_id)?.name ?? "—"}
                <span className="ml-2 text-xs text-text-muted">(cannot change in a new version)</span>
              </div>
            ) : (
              <SearchableSelect
                value={formData.vehicle_type_id}
                onChange={(value) => setFormData({ ...formData, vehicle_type_id: value })}
                options={vts.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vehicle type…"
              />
            )}
          </FormField>

          <FormField label={t("basis", language)}>
            <Select
              value={formData.basis}
              onChange={(e) => setFormData({ ...formData, basis: e.target.value as BasisEnum })}
              options={[
                { value: "PER_KM", label: t("perKm", language) },
                { value: "HOURLY", label: t("hourly", language) },
                { value: "PACKAGE", label: t("package", language) },
                { value: "FIXED_LOCATION_PAIR", label: t("fixedPairs", language) },
              ]}
            />
          </FormField>

          {formData.basis === "PER_KM" && (
            <FormField label={`${t("ratePerKm", language)} ($)`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 22.50"
                value={rateText.perKm}
                onChange={(e) => setRateText((prev) => ({ ...prev, perKm: e.target.value }))}
              />
            </FormField>
          )}

          {formData.basis === "HOURLY" && (
            <FormField label={`${t("hourlyRate", language)} ($)`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 450.00"
                value={rateText.perHour}
                onChange={(e) => setRateText((prev) => ({ ...prev, perHour: e.target.value }))}
              />
            </FormField>
          )}

          <FormField label={t("validFrom", language)}>
            <DateTimePicker mode="date" value={formData.valid_from}
              onChange={(val) => setFormData({ ...formData, valid_from: val })} />
          </FormField>

          <FormField label={t("validTo", language)}>
            <DateTimePicker mode="date" value={formData.valid_to ?? ""}
              onChange={(val) => setFormData({ ...formData, valid_to: val || undefined })} />
          </FormField>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={createMutation.isPending || supersedeMutation.isPending || updateMutation.isPending}
            >
              {drawerMode === "edit"
                ? "Save changes"
                : drawerMode === "supersede"
                  ? t("createVersion", language)
                  : t("create", language)}
            </Button>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              {t("cancel", language)}
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

RateCardsTab.displayName = "RateCardsTab";
