"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguageStore, t, apiClient, keys, QueryBoundary, csrfFetch, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { HealthStrip } from "@/components/configuration/HealthStrip";
import { useToastStore } from "@/stores/toastStore";

type ApiVehicle = components["schemas"]["Vehicle"];
type PatchedVehicle = components["schemas"]["PatchedVehicle"];
type ApiVendor = components["schemas"]["Vendor"];
type ApiVehicleType = components["schemas"]["VehicleType"];

interface VehicleWriteInput {
  vendor: string;
  vehicle_type: string;
  plate: string;
  traccar_device_id?: string;
  is_active?: boolean;
}

interface VehiclesTabProps {
  searchQuery?: string;
}

export const VehiclesTab: React.FC<VehiclesTabProps> = ({ searchQuery = "" }) => {
  const language = useLanguageStore((s) => s.language);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  // Vendor ids to narrow the fleet to. Empty = no filter (show every vendor's vehicles).
  const [vendorFilter, setVendorFilter] = useState<string[]>([]);

  const { data: vehiclesData, isLoading, error } = useQuery({
    // The filter is part of the key, so each vendor combination is cached separately and
    // switching back to a previous selection is instant.
    queryKey: keys.fleet.vehicles.list({ vendor_in: vendorFilter.join(",") }),
    queryFn: async () => {
      // Filtered server-side via ?vendor_in=<id>,<id> rather than in the browser: the list is
      // cursor-paginated, so filtering the current page would only ever search the first 25
      // rows and silently miss the rest.
      const qs = vendorFilter.length ? `?vendor_in=${vendorFilter.join(",")}` : "";
      const resp = await csrfFetch(`/api/v1/fleet/vehicles/${qs}`, { credentials: "include" });
      if (!resp.ok) throw new Error(`Failed to load vehicles (${resp.status})`);
      return (await resp.json()) as { results?: ApiVehicle[] };
    },
    // Always load current rows: a row edited/deactivated in another tab (or before a data change)
    // would otherwise linger and 404 on edit/deactivate with "resource does not exist".
    refetchOnMount: "always",
  });

  // A vehicle can vanish between the list render and the action (deleted in another tab / session).
  // Rather than dead-end on the backend's 404, refresh the list and say so plainly.
  const isMissing = (err: unknown) => isApiError(err) && err.status === 404;
  const refreshVehicles = () =>
    void queryClient.invalidateQueries({ queryKey: keys.fleet.vehicles.list() });

  // Reference data for the create/edit form dropdowns. Agency admins may file a vehicle
  // under any vendor, so we list all vendors and vehicle types.
  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {});
      if (err) throw err;
      return res;
    },
  });
  const { data: vtData } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vehicle-types", {});
      if (err) throw err;
      return res;
    },
  });
  const vendors = (vendorsData?.results ?? []) as ApiVendor[];
  const vehicleTypes = (vtData?.results ?? []) as ApiVehicleType[];

  const vendorFilterOptions = vendors.map((v) => ({ value: v.id, label: v.name }));

  const allVehicles: ApiVehicle[] = (vehiclesData as { results?: ApiVehicle[] } | undefined)?.results ?? (vehiclesData as ApiVehicle[] | undefined) ?? [];

  const vehicles = searchQuery.trim()
    ? allVehicles.filter(
        (v) =>
          v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.vehicle_type_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allVehicles;

  const createMutation = useMutation({
    mutationFn: async (input: VehicleWriteInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/fleet/vehicles", { body: input as unknown as ApiVehicle });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.fleet.vehicles.list() });
      addToast("Vehicle created", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create vehicle", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: VehicleWriteInput }) => {
      const { data: res, error: err } = await apiClient.PATCH("/v1/fleet/vehicles/{id}", {
        params: { path: { id } },
        body: input as unknown as PatchedVehicle,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.fleet.vehicles.list() });
      addToast("Vehicle updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      if (isMissing(err)) {
        refreshVehicles();
        setDrawerOpen(false);
        addToast("This vehicle no longer exists — the list has been refreshed.", "error");
        return;
      }
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to update vehicle", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.DELETE("/v1/fleet/vehicles/{id}", { params: { path: { id } } });
      if (err) throw err;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.fleet.vehicles.list() });
      addToast("Vehicle deactivated", "success");
      setConfirmTarget(null);
    },
    onError: (err: unknown) => {
      setConfirmTarget(null);
      if (isMissing(err)) {
        refreshVehicles();
        addToast("This vehicle no longer exists — the list has been refreshed.", "error");
        return;
      }
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Failed to deactivate vehicle", "error");
    },
  });

  // Deactivation asks for confirmation first (it removes the vehicle from the fleet).
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; label: string } | null>(null);

  const emptyForm: VehicleWriteInput = { vendor: "", vehicle_type: "", plate: "", traccar_device_id: "", is_active: true };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VehicleWriteInput>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (vehicle: ApiVehicle) => {
    setEditingId(vehicle.id);
    setFormData({
      vendor: vehicle.vendor,
      vehicle_type: vehicle.vehicle_type,
      plate: vehicle.plate,
      traccar_device_id: vehicle.traccar_device_id ?? "",
      is_active: vehicle.is_active,
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.vendor || !formData.vehicle_type || !formData.plate.trim()) {
      addToast("Vendor, vehicle type and registration are required", "error");
      return;
    }
    const input: VehicleWriteInput = {
      vendor: formData.vendor,
      vehicle_type: formData.vehicle_type,
      plate: formData.plate.trim(),
      traccar_device_id: formData.traccar_device_id?.trim() || undefined,
      is_active: formData.is_active,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const vendorOptions = [
    { value: "", label: "Select vendor…" },
    ...vendors.map((v) => ({ value: v.id, label: v.name })),
  ];
  const vehicleTypeOptions = [
    { value: "", label: "Select type…" },
    ...vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name })),
  ];

  const columns: Column[] = [
    { key: "plate", header: t("registration", language), sortable: true },
    {
      key: "vehicle_type_name",
      header: t("type", language),
      sortable: true,
      render: (val, row): React.ReactNode => {
        const name = (val as string) || t("dash", language);
        const vt = vehicleTypes.find((v) => v.id === (row as Record<string, unknown>).vehicle_type);
        return vt && typeof vt.luggage_capacity === "number"
          ? `${name} · ${vt.luggage_capacity} bag${vt.luggage_capacity === 1 ? "" : "s"}`
          : name;
      },
    },
    {
      key: "vendor_name",
      header: "Vendor",
      sortable: true,
      render: (val): React.ReactNode => (val as string) || t("dash", language),
    },
    {
      key: "is_active",
      header: t("status", language),
      render: (val): React.ReactNode => (
        <Badge variant={val ? "green" : "red"}>{val ? t("active", language) : t("inactive", language)}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, row): React.ReactNode => {
        const vehicle = row as unknown as ApiVehicle;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(vehicle)}
            >
              {t("edit", language)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-danger/10! hover:text-danger!"
              onClick={() => setConfirmTarget({ id: vehicle.id, label: vehicle.plate })}
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
          {t("vehicles", language)} ({vehicles.length})
        </h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          New Vehicle
        </Button>
      </div>

      <HealthStrip expiredCount={0} expiringCount={0} />

      {/* Narrow the fleet to one or more vendors. Filtering happens server-side, so it spans
          the whole fleet rather than just the rows already fetched. */}
      <div className="w-72">
        <MultiSelectFilter
          options={vendorFilterOptions}
          selected={vendorFilter}
          onChange={setVendorFilter}
          placeholder="All vendors"
          searchPlaceholder="Search vendors…"
        />
      </div>

      <QueryBoundary isLoading={isLoading} error={error} isEmpty={vehicles.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">{t("noVehicles", language)}</p>}>
        <DataTable
          columns={columns}
          data={vehicles as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage={t("noVehicles", language)}
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Vehicle" : "New Vehicle"}
        width="md"
      >
        <div className="space-y-4">
          <FormField label="Vendor" required>
            <Select
              options={vendorOptions}
              value={formData.vendor}
              onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
            />
          </FormField>

          <FormField label="Vehicle Type" required>
            <Select
              options={vehicleTypeOptions}
              value={formData.vehicle_type}
              onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
            />
          </FormField>

          <FormField label={t("registration", language)} required>
            <Input
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
              placeholder="e.g., KA01AB1234"
            />
          </FormField>

          <FormField label="Traccar Device ID">
            <Input
              value={formData.traccar_device_id ?? ""}
              onChange={(e) => setFormData({ ...formData, traccar_device_id: e.target.value })}
              placeholder="Optional — e.g. 1"
              inputMode="numeric"
            />
            <p className="text-xs text-text-secondary mt-1">
              Traccar&apos;s <strong>numeric device id</strong> (the <code>id</code> column in
              Traccar → Devices) — not the IMEI or plate. GPS only reaches this vehicle when this
              matches.
            </p>
          </FormField>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vehicle-active"
              checked={formData.is_active ?? true}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="vehicle-active" className="text-sm text-ops-sidebar">
              Active
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Update" : "Create"}
            </Button>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>

      <Modal
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title="Deactivate vehicle"
      >
        <p className="text-sm text-text-secondary">
          Deactivate{" "}
          <span className="font-medium text-text-primary">{confirmTarget?.label}</span>? It will be
          removed from the fleet.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={deleteMutation.isPending}
            onClick={() => confirmTarget && deleteMutation.mutate(confirmTarget.id)}
          >
            {deleteMutation.isPending ? "Deactivating…" : "Deactivate"}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

VehiclesTab.displayName = "VehiclesTab";
