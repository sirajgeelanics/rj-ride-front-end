"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

type Offer = {
  id: string;
  price_id: string;
  vendor: string;
  rate_card: string;
  rate_card_version: number;
  basis: string;
  price_minor: number;
  currency: string;
  free_cancellation_hours: number;
  min_lead_time_hours: number;
  breakdown: unknown;
  expires_at: string;
  created_at: string;
};

interface QuoteSimulatorTabProps {
  searchQuery?: string;
}

export const QuoteSimulatorTab: React.FC<QuoteSimulatorTabProps> = () => {
  const addToast = useToastStore((s) => s.addToast);

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

  const customers = (customersData?.results ?? []) as components["schemas"]["Customer"][];
  const vts = (vehicleTypesData?.results ?? []) as components["schemas"]["VehicleType"][];

  const todayISO = new Date().toISOString().slice(0, 16);

  const [customer_id, setCustomerId] = useState<string>("");
  const [vehicle_type_id, setVehicleTypeId] = useState<string>("");
  const [distance_km, setDistanceKm] = useState<number>(10);
  const [duration_hours, setDurationHours] = useState<number>(1);
  const [when, setWhen] = useState<string>(todayISO);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);

  const handleGetOffers = async () => {
    if (!customer_id || !vehicle_type_id) {
      addToast("Please select customer and vehicle type", "error");
      return;
    }
    setLoading(true);
    try {
      const resp = await csrfFetch("/api/v1/pricing/offers/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customer_id,
          vehicle_type: vehicle_type_id,
          when: when ? new Date(when).toISOString() : new Date().toISOString(),
          distance_km,
          duration_hours,
        }),
      });
      const envelope = await resp.json() as { result?: Offer[]; error?: { message?: string } };
      if (!resp.ok) {
        throw new Error(envelope?.error?.message ?? `Quote failed (${resp.status})`);
      }
      const result = (envelope.result ?? []) as Offer[];
      setOffers(result);
      if (result.length === 0) {
        addToast("No applicable rate card found for the selected combination", "info");
      } else {
        addToast(`Got ${result.length} offer(s)`, "success");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to get offers", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card padding="lg" header={<h3 className="font-semibold">Quote Parameters</h3>}>
        <div className="grid grid-cols-2 gap-4">
          {/* SearchableSelect, not a bare <Select>: a native select with no option matching the
              empty initial value *displays* the first customer while state stays "", so the form
              looked filled in but failed validation. The combobox shows a real placeholder and
              only sets state on an explicit pick, so what you see is what's submitted. */}
          <FormField label="Customer" required>
            <SearchableSelect
              value={customer_id}
              onChange={setCustomerId}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Search customer…"
            />
          </FormField>

          <FormField label="Vehicle Type" required>
            <SearchableSelect
              value={vehicle_type_id}
              onChange={setVehicleTypeId}
              options={vts.map((v) => ({
                value: v.id,
                label: `${v.name} (${v.capacity} seats · ${v.luggage_capacity ?? 0} bags)`,
              }))}
              placeholder="Search vehicle type…"
            />
          </FormField>

          <FormField label="When">
            <DateTimePicker mode="datetime" value={when} onChange={(val) => setWhen(val)} />
          </FormField>

          <FormField label="Distance (KM)">
            <Input
              type="number"
              value={distance_km}
              onChange={(e) => setDistanceKm(parseFloat(e.target.value) || 0)}
            />
          </FormField>

          <FormField label="Duration (Hours)">
            <Input
              type="number"
              value={duration_hours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0)}
              step="0.5"
            />
          </FormField>
        </div>

        <Button
          onClick={() => { void handleGetOffers(); }}
          variant="primary"
          className="mt-4"
          disabled={loading}
        >
          {loading ? "Getting offers…" : "Get Offers"}
        </Button>
      </Card>

      {offers.length > 0 && (
        <Card padding="lg" header={<h3 className="font-semibold">Offers ({offers.length})</h3>}>
          <div className="space-y-3">
            {offers.map((offer) => {
              const expiresAt = new Date(offer.expires_at);
              const validityMins = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
              return (
                <div key={offer.price_id} className="p-4 bg-ops-bg rounded border border-border space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-mono text-sm text-text-secondary">
                        Price ID: {offer.price_id.substring(0, 8)}…
                      </p>
                      <p className="text-2xl font-bold text-text-primary mt-2">
                        {formatMoney(offer.price_minor, offer.currency)}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <Badge variant="blue">v{offer.rate_card_version}</Badge>
                      <div className="text-xs text-text-secondary">
                        <p className={validityMins > 5 ? "text-green-400" : "text-amber-400"}>
                          Valid: {validityMins}m remaining
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-primary pt-2 border-t border-border">
                    <p>
                      <span className="text-text-secondary">Basis:</span> {offer.basis}
                    </p>
                    <p>
                      <span className="text-text-secondary">Free Cancel:</span> {offer.free_cancellation_hours}h
                    </p>
                    <p>
                      <span className="text-text-secondary">Min Lead Time:</span> {offer.min_lead_time_hours}h
                    </p>
                    <p>
                      <span className="text-text-secondary">Currency:</span> {offer.currency}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {offers.length === 0 && !loading && (
        <Card padding="lg" className="text-center text-text-secondary py-8">
          <p>No offers yet. Select parameters and click &quot;Get Offers&quot; to generate a quote.</p>
        </Card>
      )}
    </div>
  );
};

QuoteSimulatorTab.displayName = "QuoteSimulatorTab";
