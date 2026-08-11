"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, isApiError } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormField } from "@/components/ui/FormField";
import { Drawer } from "@/components/ui/Drawer";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

type RecurringRule = components["schemas"]["RecurringRule"];
type Customer = components["schemas"]["Customer"];
type VehicleType = components["schemas"]["VehicleType"];

type RecurringRuleInput = {
  customer_id: string;
  freq: "DAILY" | "WEEKLY";
  days_of_week?: number[];
  start_date: string;
  end_date?: string;
  time: string;
  vehicle_type_id?: string;
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DEFAULT_INPUT: RecurringRuleInput = {
  customer_id: "",
  freq: "DAILY",
  time: "08:00",
  start_date: new Date().toISOString().split("T")[0] ?? "",
};

export const RecurringCreation: React.FC<{ onDone?: () => void }> = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RecurringRuleInput>(DEFAULT_INPUT);

  const { data: rules, isLoading } = useQuery({
    queryKey: keys.trips.recurringRules.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/trips/recurring-rules", {});
      if (err) throw err;
      return res?.results ?? [];
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

  const customers = (customersData?.results ?? []) as Customer[];
  const vehicleTypes = (vehicleTypesData?.results ?? []) as VehicleType[];

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { data: res, error: err } = await apiClient.PATCH("/v1/trips/recurring-rules/{id}", {
          params: { path: { id: editingId } },
          body: form as unknown as components["schemas"]["PatchedRecurringRule"],
        });
        if (err) throw err;
        return res;
      } else {
        const { data: res, error: err } = await apiClient.POST("/v1/trips/recurring-rules", {
          body: form as unknown as RecurringRule,
        });
        if (err) throw err;
        return res;
      }
    },
    onSuccess: () => {
      addToast(editingId ? "Rule updated" : "Rule created", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.recurringRules.list() });
      setDrawerOpen(false);
      setEditingId(null);
      setForm(DEFAULT_INPUT);
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Save failed", "error");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: err } = await apiClient.POST("/v1/trips/recurring-rules/{id}/deactivate", {
        params: { path: { id } },
        body: {} as unknown as RecurringRule,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      addToast("Rule deactivated", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.recurringRules.list() });
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : "Deactivate failed", "error");
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_INPUT);
    setDrawerOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setEditingId(rule.id);
    setForm({
      customer_id: "",
      freq: rule.freq as "DAILY" | "WEEKLY",
      days_of_week: Array.isArray(rule.days_of_week) ? (rule.days_of_week as number[]) : [],
      start_date: rule.start_date,
      end_date: rule.end_date ?? undefined,
      time: rule.time,
    });
    setDrawerOpen(true);
  };

  const toggleDay = (day: number) => {
    const current = form.days_of_week ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setForm((f) => ({ ...f, days_of_week: next }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Configure auto-recurring trip rules. The scheduler creates trips daily/weekly at the set time.
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-3 h-3 mr-1" /> New Rule
        </Button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-sm text-text-secondary">Loading rules…</div>
      ) : !rules?.length ? (
        <Card padding="lg" className="text-center py-8 text-text-secondary">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recurring rules yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {(rules as RecurringRule[]).map((rule) => (
            <Card key={rule.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {rule.freq} · {rule.time}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {Array.isArray(rule.days_of_week) && (rule.days_of_week as number[]).length > 0
                      ? `${(rule.days_of_week as number[]).map((d) => DAYS_OF_WEEK[d]).join(", ")} — `
                      : ""}
                    {rule.start_date}
                    {rule.end_date ? ` → ${rule.end_date}` : ""}
                    {!rule.is_active ? " (inactive)" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="hover:bg-brand-wine/10! hover:text-brand-wine!"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger/10!"
                    onClick={() => deactivateMutation.mutate(rule.id)}
                    disabled={deactivateMutation.isPending || !rule.is_active}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingId(null); }}
        title={editingId ? "Edit Rule" : "New Recurring Rule"}
      >
        <div className="space-y-4 p-4">
          <FormField label="Customer">
            <SearchableSelect
              value={form.customer_id}
              onChange={(val) => setForm((f) => ({ ...f, customer_id: val }))}
              options={(customers ?? []).map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Search customer…"
            />
          </FormField>

          <FormField label="Frequency">
            <Select
              value={form.freq}
              onChange={(e) => setForm((f) => ({ ...f, freq: e.target.value as "DAILY" | "WEEKLY" }))}
              options={[{ value: "DAILY", label: "Daily" }, { value: "WEEKLY", label: "Weekly" }]}
            />
          </FormField>

          {form.freq === "WEEKLY" && (
            <FormField label="Days of Week">
              <div className="flex gap-1 flex-wrap">
                {DAYS_OF_WEEK.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      form.days_of_week?.includes(i) ? "bg-brand-blue text-white border-brand-blue" : "border-border text-text-secondary"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <FormField label="Time">
            <DateTimePicker mode="time" value={form.time}
              onChange={(val) => setForm((f) => ({ ...f, time: val }))} />
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="Start Date">
              <DateTimePicker mode="date" disablePast value={form.start_date}
                onChange={(val) => setForm((f) => ({ ...f, start_date: val }))} />
            </FormField>
            <FormField label="End Date">
              <DateTimePicker mode="date" disablePast value={form.end_date ?? ""}
                onChange={(val) => setForm((f) => ({ ...f, end_date: val || undefined }))} />
            </FormField>
          </div>

          <FormField label="Vehicle Type">
            <SearchableSelect
              value={form.vehicle_type_id ?? ""}
              onChange={(val) => setForm((f) => ({ ...f, vehicle_type_id: val || undefined }))}
              options={(vehicleTypes ?? []).map((v) => ({
                value: v.id,
                label: `${v.name} (${v.capacity} seats · ${v.luggage_capacity ?? 0} bags)`,
              }))}
              placeholder="Search vehicle type…"
            />
          </FormField>

          <Button
            onClick={() => saveMutation.mutate()}
            variant="primary"
            className="w-full"
            disabled={!form.customer_id || !form.time || !form.start_date || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : editingId ? "Update Rule" : "Create Rule"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
};

RecurringCreation.displayName = "RecurringCreation";
