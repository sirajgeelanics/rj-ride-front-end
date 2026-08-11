"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { FormField } from "@/components/ui/FormField";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { useToastStore } from "@/stores/toastStore";
import { Check, ArrowRight, RotateCcw } from "lucide-react";

type Customer = components["schemas"]["Customer"];
type VehicleType = components["schemas"]["VehicleType"];
type Vendor = components["schemas"]["Vendor"];

/** A priced offer as returned by POST /api/v1/pricing/offers. */
interface QuoteOffer {
  id: string;
  vendor: string;
  rate_card_version: number;
  basis: string;
  price_minor: number;
  currency: string;
  free_cancellation_hours: number;
  min_lead_time_hours: number;
  expires_at: string;
}

interface BookedTrip {
  id: string;
  reference: string;
  status: string;
}

function idempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const STEPS = ["Quote", "Check", "Book"] as const;

export const QuoteBookConfirmStepper: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [vehicleTypeId, setVehicleTypeId] = useState("");
  const [pickupAt, setPickupAt] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [pickupAddress, setPickupAddress] = useState("Kempegowda International Airport, Bangalore");
  const [dropAddress, setDropAddress] = useState("MG Road, Bangalore");
  // Per-km rate cards price at zero without a distance, so quote with one.
  const [distanceKm, setDistanceKm] = useState("35");

  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [booked, setBooked] = useState<BookedTrip | null>(null);

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
  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vendors", {});
      if (err) throw err;
      return res;
    },
  });

  const customers = (customersData?.results ?? []) as Customer[];
  const vehicleTypes = (vehicleTypesData?.results ?? []) as VehicleType[];
  const vendors = (vendorsData?.results ?? []) as Vendor[];
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? id.slice(0, 8);

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedOfferId) ?? null,
    [offers, selectedOfferId],
  );

  /** Real lead-time verdict, computed from the offer's own min_lead_time_hours. */
  const leadTime = useMemo(() => {
    if (!selectedOffer) return null;
    const hours = (new Date(pickupAt).getTime() - Date.now()) / 3_600_000;
    return {
      hours,
      required: selectedOffer.min_lead_time_hours,
      ok: hours >= selectedOffer.min_lead_time_hours,
      expired: new Date(selectedOffer.expires_at).getTime() <= Date.now(),
    };
  }, [selectedOffer, pickupAt]);

  const reset = () => {
    setStep(1);
    setOffers([]);
    setSelectedOfferId("");
    setBooked(null);
  };

  // Step 1 — real quote
  const handleGetOffers = async () => {
    if (!customerId || !vehicleTypeId) {
      addToast("Pick a customer and a vehicle type.", "error");
      return;
    }
    setBusy(true);
    try {
      const resp = await csrfFetch("/api/v1/pricing/offers/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: customerId,
          vehicle_type: vehicleTypeId,
          when: new Date(pickupAt).toISOString(),
          distance_km: distanceKm || "0",
        }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: QuoteOffer[];
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Quote failed (${resp.status})`);
      const list = body.result ?? [];
      if (list.length === 0) {
        addToast("No rate card matches that customer × vehicle type.", "error");
        return;
      }
      setOffers(list);
      setSelectedOfferId(list[0]!.id);
      setStep(2);
      addToast(`${list.length} offer(s) returned`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Quote failed", "error");
    } finally {
      setBusy(false);
    }
  };

  // Step 3 — real booking against the chosen offer
  const handleBook = async () => {
    if (!selectedOffer) return;
    setBusy(true);
    try {
      const resp = await csrfFetch("/api/v1/trips/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey() },
        body: JSON.stringify({
          customer_id: customerId,
          pickup_at: new Date(pickupAt).toISOString(),
          stops: [
            { sequence: 0, kind: "PICKUP", location_type: "AIRPORT", address: pickupAddress },
            { sequence: 1, kind: "DROP", location_type: "ADDRESS", address: dropAddress },
          ],
          vehicles: [{ vehicle_type_id: vehicleTypeId, offer_id: selectedOffer.id }],
        }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        result?: BookedTrip;
        error?: { message?: string };
      };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Booking failed (${resp.status})`);
      setBooked(body.result ?? null);
      setStep(3);
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      addToast(`Trip ${body.result?.reference ?? ""} booked`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Booking failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Step rail */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n || (n === 3 && booked !== null);
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    done
                      ? "bg-success text-white"
                      : step === n
                        ? "bg-brand-blue text-white"
                        : "bg-ops-bg text-text-tertiary border border-border"
                  }`}
                >
                  {done ? <Check className="w-3 h-3" /> : n}
                </div>
                <span
                  className={`text-sm ${
                    step === n ? "font-semibold text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
            </React.Fragment>
          );
        })}
      </div>

      <Card padding="md">
        <p className="text-xs text-text-secondary">
          Runs the real quote → book flow against{" "}
          <code className="font-mono text-brand-blue">/api/v1/pricing/offers</code> and{" "}
          <code className="font-mono text-brand-blue">/api/v1/trips</code>. Booking creates a real
          trip and locks the price from the offer you pick.
        </p>
      </Card>

      {/* Step 1 — quote inputs */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Customer" required>
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Search customer…"
              />
            </FormField>
            <FormField label="Vehicle Type" required>
              <SearchableSelect
                value={vehicleTypeId}
                onChange={setVehicleTypeId}
                options={vehicleTypes.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vehicle type…"
              />
            </FormField>
            <FormField label="Pickup date & time">
              <DateTimePicker mode="datetime" value={pickupAt} onChange={setPickupAt} />
            </FormField>
            <FormField label="Distance (km)">
              <Input value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
            </FormField>
            <FormField label="Pickup address">
              <Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
            </FormField>
            <FormField label="Drop address">
              <Input value={dropAddress} onChange={(e) => setDropAddress(e.target.value)} />
            </FormField>
          </div>
          <Button onClick={() => void handleGetOffers()} loading={busy} className="w-full">
            Get Offers <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Step 2 — pick an offer, see the real terms */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-text-primary">
            {offers.length} offer(s) — pick one
          </p>
          <div className="space-y-2">
            {offers.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelectedOfferId(o.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  o.id === selectedOfferId
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-border hover:bg-brand-blue/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{vendorName(o.vendor)}</p>
                    <p className="text-xs text-text-secondary">
                      {o.basis} · rate card v{o.rate_card_version} · free cancel{" "}
                      {o.free_cancellation_hours}h · min lead {o.min_lead_time_hours}h
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-brand-blue">
                    {formatMoney(o.price_minor, o.currency)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {leadTime && (
            <Card padding="md" className={leadTime.ok ? "" : "border-danger/40 bg-danger/5"}>
              <div className="flex items-center gap-2">
                <Badge variant={leadTime.ok ? "green" : "red"}>
                  {leadTime.ok ? "Lead time OK" : "Too soon"}
                </Badge>
                <span className="text-xs text-text-secondary">
                  Pickup is {leadTime.hours.toFixed(1)}h away; this offer needs {leadTime.required}h.
                </span>
              </div>
              {leadTime.expired && (
                <p className="text-xs text-danger mt-1">
                  This offer has expired — re-quote to get a fresh price.
                </p>
              )}
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">
              <RotateCcw className="w-4 h-4 mr-1" /> Start over
            </Button>
            <Button
              onClick={() => void handleBook()}
              loading={busy}
              disabled={!selectedOffer || !leadTime?.ok || leadTime?.expired}
              className="flex-1"
            >
              Book this offer <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — booked */}
      {step === 3 && booked && (
        <Card padding="lg" className="text-center space-y-2">
          <Check className="w-8 h-8 mx-auto text-success" />
          <p className="text-sm text-text-primary">
            Trip <span className="font-mono font-semibold">{booked.reference}</span> booked
          </p>
          <Badge variant="green">{booked.status}</Badge>
          {selectedOffer && (
            <p className="text-xs text-text-secondary">
              Locked at {formatMoney(selectedOffer.price_minor, selectedOffer.currency)} with{" "}
              {vendorName(selectedOffer.vendor)}
            </p>
          )}
          <Button variant="secondary" onClick={reset} className="mt-2">
            <RotateCcw className="w-4 h-4 mr-1" /> Run another
          </Button>
        </Card>
      )}
    </div>
  );
};

QuoteBookConfirmStepper.displayName = "QuoteBookConfirmStepper";
