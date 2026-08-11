"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, QueryBoundary } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { PII } from "@/components/ui/PII";
import { useToastStore } from "@/stores/toastStore";

type Customer = components["schemas"]["Customer"];
type PatchedCustomer = components["schemas"]["PatchedCustomer"];

interface CustomerWriteInput {
  name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
}

interface CustomersTabProps {
  searchQuery?: string;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ searchQuery = "" }) => {
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.customers.list({ name: searchQuery }),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/customers", {
        params: { query: { name: searchQuery || undefined } },
      });
      if (err) throw err;
      return res;
    },
  });

  const customers = (data?.results ?? []) as Customer[];

  const createMutation = useMutation({
    mutationFn: async (input: CustomerWriteInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/customers", { body: input as unknown as Customer });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.customers.list() });
      addToast("Customer created", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create customer", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: CustomerWriteInput }) => {
      const { data: res, error: err } = await apiClient.PATCH("/v1/config/customers/{id}", {
        params: { path: { id } },
        body: input as unknown as PatchedCustomer,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.customers.list() });
      addToast("Customer updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to update customer", "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.DELETE("/v1/config/customers/{id}", { params: { path: { id } } });
      if (err) throw err;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.customers.list() });
      addToast("Customer deactivated", "success");
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to delete customer", "error");
    },
  });

  const emptyForm: CustomerWriteInput = { name: "", contact_name: "", contact_phone: "", contact_email: "", address: "" };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerWriteInput>(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setFormData({
      name: customer.name,
      contact_name: customer.contact_name ?? "",
      contact_phone: customer.contact_phone ?? "",
      contact_email: customer.contact_email ?? "",
      address: customer.address ?? "",
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      addToast("Name is required", "error");
      return;
    }
    const input: CustomerWriteInput = {
      name: formData.name,
      contact_name: formData.contact_name || undefined,
      contact_phone: formData.contact_phone || undefined,
      contact_email: formData.contact_email || undefined,
      address: formData.address || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const filtered = searchQuery.trim()
    ? customers.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : customers;

  const columns: Column[] = [
    { key: "name", header: "Customer Name", sortable: true },
    {
      key: "contact_name",
      header: "SPOC",
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="name" /> : "-"),
    },
    {
      key: "contact_phone",
      header: "Phone",
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="phone" /> : "-"),
    },
    {
      key: "contact_email",
      header: "Email",
      render: (val): React.ReactNode => (val ? <PII value={val as string} type="email" /> : "-"),
    },
    {
      key: "address",
      header: "Address",
      render: (val): React.ReactNode => (val ? <span className="text-text-secondary">{val as string}</span> : "-"),
    },
    {
      key: "actions",
      header: "Actions",
      render: (_, row): React.ReactNode => {
        const customer = row as unknown as Customer;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(customer)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-danger/10! hover:text-danger!"
              onClick={() => deleteMutation.mutate(customer.id)}
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
        <h3 className="font-semibold text-ops-sidebar">Customers ({filtered.length})</h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          New Customer
        </Button>
      </div>

      <QueryBoundary isLoading={isLoading} error={error} isEmpty={filtered.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">No customers</p>}>
        <DataTable
          columns={columns}
          data={filtered as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage="No customers"
        />
      </QueryBoundary>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "Edit Customer" : "New Customer"}
        width="lg"
      >
        <div className="space-y-4">
          <FormField label="Customer Name" required>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
            />
          </FormField>

          <FormField label="SPOC Name">
            <Input
              value={formData.contact_name ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value || undefined })}
              placeholder="Single Point of Contact"
            />
          </FormField>

          <FormField label="Phone">
            <Input
              value={formData.contact_phone ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value || undefined })}
              placeholder="+91 98765 43210"
            />
          </FormField>

          <FormField label="Email">
            <Input
              type="email"
              value={formData.contact_email ?? ""}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value || undefined })}
              placeholder="spoc@customer.local"
            />
          </FormField>

          <FormField label="Address">
            <Input
              value={formData.address ?? ""}
              onChange={(e) => setFormData({ ...formData, address: e.target.value || undefined })}
              placeholder="123 Main St, City"
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

CustomersTab.displayName = "CustomersTab";
