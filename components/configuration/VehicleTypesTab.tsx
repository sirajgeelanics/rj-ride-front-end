"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, QueryBoundary, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { useToastStore } from "@/stores/toastStore";

type VehicleType = components["schemas"]["VehicleType"];
type PatchedVehicleType = components["schemas"]["PatchedVehicleType"];

interface VehicleTypeWriteInput {
  name: string;
  ac?: boolean;
  capacity: number;
  luggage_capacity: number;
}

interface VehicleTypesTabProps {
  searchQuery?: string;
}

export const VehicleTypesTab: React.FC<VehicleTypesTabProps> = ({ searchQuery = "" }) => {
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vehicle-types", {});
      if (err) throw err;
      return res;
    },
  });

  const allVts = (data?.results ?? []) as VehicleType[];
  const vts = searchQuery.trim()
    ? allVts.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allVts;

  const createMutation = useMutation({
    mutationFn: async (input: VehicleTypeWriteInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/vehicle-types", { body: input as unknown as VehicleType });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleTypes.list() });
      addToast("Vehicle type created", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create vehicle type", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: VehicleTypeWriteInput }) => {
      const { data: res, error: err } = await apiClient.PATCH("/v1/config/vehicle-types/{id}", {
        params: { path: { id } },
        body: input as unknown as PatchedVehicleType,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleTypes.list() });
      addToast("Vehicle type updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to update vehicle type", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, cascade }: { id: string; cascade?: boolean }) => {
      // `cascade` is opt-in and only ever set after the user confirms the prompt below, so a
      // plain click can never retire a vehicle type's dependents by surprise.
      // csrfFetch, not apiClient: `?cascade=` is not in the committed OpenAPI schema, so the
      // generated types reject the query param. Errors are unwrapped by hand to keep the
      // status code, which is what tells us a 409 is retryable with cascade.
      const qs = cascade ? "?cascade=true" : "";
      const resp = await csrfFetch(`/api/v1/config/vehicle-types/${id}/${qs}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        const failure = new Error(
          body?.error?.message ?? `Failed to retire vehicle type (${resp.status})`,
        ) as Error & { status?: number };
        failure.status = resp.status;
        throw failure;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.vehicleTypes.list() });
      addToast("Vehicle type deactivated", "success");
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
      addToast(err instanceof Error ? err.message : "Failed to delete vehicle type", "error");
    },
  });

  // Set when the server refuses because dependents are still live (409). Holds the id to retry
  // with cascade plus the server's own explanation, which already names the count.
  const [pendingCascade, setPendingCascade] = useState<{ id: string; reason: string } | null>(null);

  const emptyForm: VehicleTypeWriteInput = { name: "", capacity: 4, luggage_capacity: 0, ac: true };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VehicleTypeWriteInput>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (vt: VehicleType) => {
    setEditingId(vt.id);
    setFormData({ name: vt.name, capacity: vt.capacity, luggage_capacity: vt.luggage_capacity ?? 0, ac: vt.ac });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || formData.capacity < 1) {
      addToast("Name and seating capacity are required", "error");
      return;
    }
    const input: VehicleTypeWriteInput = {
      name: formData.name,
      capacity: formData.capacity,
      luggage_capacity: formData.luggage_capacity,
      ac: formData.ac,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const columns: Column[] = [
    { key: "name", header: "Type Name", sortable: true },
    { key: "capacity", header: "Seating", sortable: true },
    {
      key: "luggage_capacity",
      header: "Luggage",
      sortable: true,
      render: (val): React.ReactNode =>
        val == null ? "-" : <span>{`${val as number} bag${val === 1 ? "" : "s"}`}</span>,
    },
    {
      key: "ac",
      header: "AC",
      render: (val): React.ReactNode => (
        <Badge variant={val ? "green" : "red"}>{val ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, row): React.ReactNode => {
        const vt = row as unknown as VehicleType;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(vt)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-danger/10! hover:text-danger!"
              onClick={() => deleteMutation.mutate({ id: vt.id })}
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
        <h3 className="font-semibold text-ops-sidebar">Vehicle Types ({vts.length})</h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          New Type
        </Button>
      </div>

      <QueryBoundary isLoading={isLoading} error={error} isEmpty={vts.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">No vehicle types</p>}>
        <DataTable
          columns={columns}
          data={vts as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage="No vehicle types"
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Vehicle Type" : "New Vehicle Type"}
        width="md"
      >
        <div className="space-y-4">
          <FormField label="Type Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Sedan, SUV"
            />
          </FormField>

          <FormField label="Seating Capacity" required>
            <Input
              type="number"
              min="1"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })
              }
            />
          </FormField>

          <FormField label="Luggage Capacity">
            <Input
              type="number"
              min="0"
              value={formData.luggage_capacity}
              onChange={(e) =>
                setFormData({ ...formData, luggage_capacity: parseInt(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-text-secondary mt-1">Number of luggage bags the type can carry.</p>
          </FormField>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ac"
              checked={formData.ac ?? true}
              onChange={(e) => setFormData({ ...formData, ac: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="ac" className="text-sm text-ops-sidebar">
              Air Conditioned
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

      <ConfirmDialog
        open={pendingCascade !== null}
        title="Retire vehicle type?"
        message={
          pendingCascade
            ? `${pendingCascade.reason} Retire them together with this vehicle type?`
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

VehicleTypesTab.displayName = "VehicleTypesTab";
