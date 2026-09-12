"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, QueryBoundary } from "@/lib/shared";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import type { components } from "@/lib/shared/api/schema.d";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { useToastStore } from "@/stores/toastStore";

type VehicleName = components["schemas"]["VehicleName"];
type PatchedVehicleName = components["schemas"]["PatchedVehicleName"];
type VehicleType = components["schemas"]["VehicleType"];

interface VehicleNameWriteInput {
  vehicle_type: string;
  name: string;
}

interface VehicleNamesTabProps {
  searchQuery?: string;
}

export const VehicleNamesTab: React.FC<VehicleNamesTabProps> = ({ searchQuery = "" }) => {
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.vehicleNames.list(),
    queryFn: async () => {
      return { results: await fetchAllPages<VehicleName>("/api/v1/config/vehicle-names/") };
    },
  });

  const { data: vtData } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      return { results: await fetchAllPages<VehicleType>("/api/v1/config/vehicle-types/") };
    },
  });

  const allNames = (data?.results ?? []) as VehicleName[];
  const vehicleTypes = (vtData?.results ?? []) as VehicleType[];

  // Vehicle-type ids to narrow the list to. Empty = no filter. Client-side — the whole catalog
  // is already fetched in one go (fetchAllPages), unlike the paginated fleet Vehicles list.
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string[]>([]);
  const vehicleTypeFilterOptions = vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name }));

  const bySearch = searchQuery.trim()
    ? allNames.filter(
        (n) =>
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.vehicle_type_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : allNames;
  const names = vehicleTypeFilter.length
    ? bySearch.filter((n) => vehicleTypeFilter.includes(n.vehicle_type))
    : bySearch;

  const createMutation = useMutation({
    mutationFn: async (input: VehicleNameWriteInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/vehicle-names", {
        body: input as unknown as VehicleName,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleNames.list() });
      addToast("Vehicle name created", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create vehicle name", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: VehicleNameWriteInput }) => {
      const { data: res, error: err } = await apiClient.PATCH("/v1/config/vehicle-names/{id}", {
        params: { path: { id } },
        body: input as unknown as PatchedVehicleName,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleNames.list() });
      addToast("Vehicle name updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to update vehicle name", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.DELETE("/v1/config/vehicle-names/{id}", {
        params: { path: { id } },
      });
      if (err) throw err;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleNames.list() });
      addToast("Vehicle name deactivated", "success");
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to deactivate vehicle name", "error");
    },
  });

  const emptyForm: VehicleNameWriteInput = { vehicle_type: "", name: "" };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VehicleNameWriteInput>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (vn: VehicleName) => {
    setEditingId(vn.id);
    setFormData({ vehicle_type: vn.vehicle_type, name: vn.name });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.vehicle_type || !formData.name.trim()) {
      addToast("Vehicle type and name are required", "error");
      return;
    }
    const input: VehicleNameWriteInput = {
      vehicle_type: formData.vehicle_type,
      name: formData.name.trim(),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const vehicleTypeOptions = [
    { value: "", label: "Select type…" },
    ...vehicleTypes.map((vt) => ({ value: vt.id, label: vt.name })),
  ];

  const columns: Column[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "vehicle_type_name", header: "Vehicle Type", sortable: true },
    {
      key: "actions",
      header: "Actions",
      render: (_, row): React.ReactNode => {
        const vn = row as unknown as VehicleName;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(vn)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-danger/10! hover:text-danger!"
              onClick={() => deleteMutation.mutate(vn.id)}
              disabled={deleteMutation.isPending}
            >
              Deactivate
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-ops-sidebar">Vehicle Names ({names.length})</h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          New Name
        </Button>
      </div>

      {/* Narrow the catalog to one or more vehicle types. */}
      <div className="w-72">
        <MultiSelectFilter
          options={vehicleTypeFilterOptions}
          selected={vehicleTypeFilter}
          onChange={setVehicleTypeFilter}
          placeholder="All vehicle types"
          searchPlaceholder="Search vehicle types…"
        />
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={names.length === 0}
        emptyFallback={<p className="text-sm text-text-secondary py-4">No vehicle names</p>}
      >
        <DataTable
          columns={columns}
          data={names as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage="No vehicle names"
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Vehicle Name" : "New Vehicle Name"}
        width="md"
      >
        <div className="space-y-4">
          <FormField label="Vehicle Type" required>
            <SearchableSelect
              options={vehicleTypeOptions.filter((o) => o.value)}
              value={formData.vehicle_type}
              onChange={(val) => setFormData({ ...formData, vehicle_type: val })}
              placeholder="Search vehicle type…"
            />
          </FormField>

          <FormField label="Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Toyota Fortuner"
            />
          </FormField>

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
    </div>
  );
};

VehicleNamesTab.displayName = "VehicleNamesTab";
