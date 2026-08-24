"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguageStore, t, apiClient, keys, QueryBoundary, csrfFetch } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { PII } from "@/components/ui/PII";
import { useToastStore } from "@/stores/toastStore";

type Vendor = components["schemas"]["Vendor"];
type PatchedVendor = components["schemas"]["PatchedVendor"];

interface VendorWriteInput {
  name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  airport_code?: string;
  address?: string;
  // Vendor-portal login password. Omitted -> unchanged on edit / default on create.
  password?: string;
}

interface VendorsTabProps {
  searchQuery?: string;
}

export const VendorsTab: React.FC<VendorsTabProps> = ({ searchQuery = "" }) => {
  const language = useLanguageStore((s) => s.language);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.vendors.list({ name: searchQuery }),
    queryFn: async () => {
      // Follow every cursor page so all vendors load — not just the first 25.
      const qs = searchQuery ? `?name=${encodeURIComponent(searchQuery)}` : "";
      return { results: await fetchAllPages<Vendor>(`/api/v1/config/vendors/${qs}`) };
    },
  });

  const vendors = (data?.results ?? []) as Vendor[];

  const createMutation = useMutation({
    mutationFn: async (input: VendorWriteInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/vendors", { body: input as unknown as Vendor });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vendors.list() });
      addToast(t("vendorCreated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create vendor";
      addToast(msg, "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: VendorWriteInput }) => {
      const { data: res, error: err } = await apiClient.PATCH("/v1/config/vendors/{id}", {
        params: { path: { id } },
        body: input as unknown as PatchedVendor,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vendors.list() });
      addToast(t("vendorUpdated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update vendor";
      addToast(msg, "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, cascade }: { id: string; cascade?: boolean }) => {
      // `cascade` is opt-in and only ever set after the user confirms the prompt below, so a
      // plain click can never retire a vendor's dependents by surprise.
      // csrfFetch, not apiClient: `?cascade=` is not in the committed OpenAPI schema, so the
      // generated types reject the query param. Errors are unwrapped by hand to keep the
      // status code, which is what tells us a 409 is retryable with cascade.
      const qs = cascade ? "?cascade=true" : "";
      const resp = await csrfFetch(`/api/v1/config/vendors/${id}/${qs}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        const failure = new Error(
          body?.error?.message ?? `Failed to retire vendor (${resp.status})`,
        ) as Error & { status?: number };
        failure.status = resp.status;
        throw failure;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vendors.list() });
      addToast(t("vendorDeactivated", language), "success");
    },
    onError: (err: unknown, variables) => {
      // A 409 is not a failure the user can do nothing about: the record still has live
      // dependents. Offer to retire them in the same action rather than dead-ending on a toast.
      const status = (err as { status?: number } | undefined)?.status;
      const message = err instanceof Error ? err.message : "";
      if (status === 409 && !variables.cascade) {
        setPendingCascade({ id: variables.id, reason: message });
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to delete vendor";
      addToast(msg, "error");
    },
  });

  // Set when the server refuses because dependents are still live (409). Holds the id to retry
  // with cascade plus the server's own explanation, which already names the count.
  const [pendingCascade, setPendingCascade] = useState<{ id: string; reason: string } | null>(null);

  const emptyForm: VendorWriteInput = { name: "", contact_name: "", contact_phone: "", contact_email: "", airport_code: "" };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VendorWriteInput>(emptyForm);
  // True when the vendor already has its own airport code — its legacy address must be left untouched.
  const [preserveAddress, setPreserveAddress] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setPreserveAddress(false);
    setFormData(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (vendor: Vendor) => {
    setEditingId(vendor.id);
    const vendorAirport = (vendor as { airport_code?: string }).airport_code;
    setPreserveAddress(Boolean(vendorAirport));
    setFormData({
      name: vendor.name,
      contact_name: vendor.contact_name ?? "",
      contact_phone: vendor.contact_phone ?? "",
      contact_email: vendor.contact_email ?? "",
      // Legacy rows carry the location inside the address field — show it so editing never wipes it.
      airport_code: vendorAirport || vendor.address || "",
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      addToast(t("vendorNameRequired", language), "error");
      return;
    }
    // Email is required: it becomes the vendor's portal login (auto-provisioned on create).
    const email = (formData.contact_email ?? "").trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      addToast("A valid contact email is required — it becomes the vendor's login.", "error");
      return;
    }
    const airportCode = (formData.airport_code ?? "").trim();
    const input: VendorWriteInput = {
      name: formData.name,
      contact_name: formData.contact_name || undefined,
      contact_phone: formData.contact_phone || undefined,
      contact_email: email,
      airport_code: airportCode || undefined,
      // Sync the legacy address field only on create or when migrating a legacy row (its airport
      // was empty). When editing a vendor that already had an airport code, leave its address
      // untouched so a real street address is never clobbered by a name-only edit.
      address: preserveAddress ? undefined : (airportCode || undefined),
      // Only send a password when one was typed — blank leaves the login unchanged.
      password: formData.password?.trim() ? formData.password : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const filtered = searchQuery.trim()
    ? vendors.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : vendors;

  const columns: Column[] = [
    { key: "name", header: t("vendorName", language), sortable: true },
    {
      key: "contact_name",
      header: t("contact", language),
      sortable: true,
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="name" /> : t("dash", language)),
    },
    {
      key: "contact_phone",
      header: t("phone", language),
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="phone" /> : t("dash", language)),
    },
    {
      key: "contact_email",
      header: t("email", language),
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="email" /> : t("dash", language)),
    },
    {
      key: "airport_code",
      header: "Airport Code",
      sortable: true,
      render: (val): React.ReactNode => (val ? <span className="text-text-secondary">{val as string}</span> : t("dash", language)),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, row): React.ReactNode => {
        const vendor = row as unknown as Vendor;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(vendor)}
            >
              {t("edit", language)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-danger/10! hover:text-danger!"
              onClick={() => deleteMutation.mutate({ id: vendor.id })}
              disabled={deleteMutation.isPending}
            >
              {t("deactivate", language)}
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
          {t("vendors", language)} ({filtered.length})
        </h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          {t("newVendor", language)}
        </Button>
      </div>

      <QueryBoundary isLoading={isLoading} error={error} isEmpty={filtered.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">{t("noVendors", language)}</p>}>
        <DataTable
          columns={columns}
          data={filtered as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage={t("noVendors", language)}
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? t("editVendor", language) : t("newVendor", language)}
        width="lg"
      >
        <div className="space-y-4">
          <FormField label={t("vendorName", language)} required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t("vendorNamePlaceholder", language)}
            />
          </FormField>

          <FormField label={t("contactName", language)}>
            <Input
              value={formData.contact_name ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value || undefined })}
              placeholder={t("contactPerson", language)}
            />
          </FormField>

          <FormField label={t("phone", language)}>
            <Input
              value={formData.contact_phone ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value || undefined })}
              placeholder="+91 98765 43210"
            />
          </FormField>

          <FormField label={t("email", language)} required>
            <Input
              type="email"
              value={formData.contact_email ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value || undefined })}
              placeholder="contact@vendor.local"
            />
            <p className="text-xs text-text-secondary mt-1">Becomes the vendor&apos;s portal login username. Set the password below.</p>
          </FormField>

          <FormField label="Portal Password">
            <Input
              type="password"
              value={formData.password ?? ""}
              onChange={(e) => setFormData({ ...formData, password: e.target.value || undefined })}
              placeholder={editingId ? "Leave blank to keep current password" : "Min 8 characters"}
              autoComplete="new-password"
            />
            <p className="text-xs text-text-secondary mt-1">
              {editingId
                ? "Sets a new vendor-portal login password. Leave blank to keep the current one."
                : "Vendor-portal login password. Leave blank to use the default (Vendor@12345)."}
            </p>
          </FormField>

          <FormField label="Airport Code">
            <Input
              value={formData.airport_code ?? ""}
              onChange={(e) => setFormData({ ...formData, airport_code: e.target.value || undefined })}
              placeholder="e.g., DEL, BLR"
            />
            <p className="text-xs text-text-secondary mt-1">
              Operating airport code — feeds the fleet filter, RITMO auto-dispatch and availability.
            </p>
          </FormField>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} variant="primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? t("update", language) : t("create", language)}
            </Button>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              {t("cancel", language)}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={pendingCascade !== null}
        title="Retire vendor?"
        message={
          pendingCascade
            ? `${pendingCascade.reason} Retire them together with this vendor?`
            : ""
        }
        confirmLabel="Retire all"
        destructive
        busy={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingCascade) deleteMutation.mutate({ id: pendingCascade.id, cascade: true });
          setPendingCascade(null);
        }}
        onCancel={() => setPendingCascade(null)}
      />
    </div>
  );
};

VendorsTab.displayName = "VendorsTab";
