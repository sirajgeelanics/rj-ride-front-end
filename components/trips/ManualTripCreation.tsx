"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, isApiError, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Plus, Minus, ArrowRight, Clock, Users } from "lucide-react";

type Customer = components["schemas"]["Customer"];
type VehicleType = components["schemas"]["VehicleType"];
type Vendor = components["schemas"]["Vendor"];
type RateCard = components["schemas"]["RateCard"];

type QuoteOffer = {
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
  expires_at: string;
  created_at: string;
};

type Phase = "form" | "booked";

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

interface StopEntry {
  kind: "PICKUP" | "DROP" | "WAYPOINT";
  location_type: "AIRPORT" | "RAIL" | "HOTEL" | "CITY" | "ADDRESS";
  address: string;
  lat: number;
  lng: number;
  planned_time: string;
  flight_number: string;
}

interface PaxEntry {
  name: string;
  phone: string;
}

interface SlotEntry {
  vehicle_type_id: string;
  slot_ref: string;
  /** Passengers riding in this vehicle. Optional — 0 up to the car type's seat capacity. */
  pax: PaxEntry[];
}

const DEFAULT_STOP: StopEntry = {
  kind: "PICKUP",
  location_type: "ADDRESS",
  address: "",
  lat: 0,
  lng: 0,
  planned_time: "",
  flight_number: "",
};

export const ManualTripCreation: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const addToast = useToastStore((s) => s.addToast);
  const qc = useQueryClient();

  const [phase, setPhase] = useState<Phase>("form");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [reference, setReference] = useState("");
  const [pickupAt, setPickupAt] = useState<string>(() => {
    // Default to one hour from now, as a LOCAL "YYYY-MM-DDTHH:mm" — DateTimePicker reads/writes
    // local wall-clock, so slicing toISOString() (UTC) here shifted the shown time by the zone
    // offset (e.g. −5:30 in IST), which could look like it was already in the past.
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [stops, setStops] = useState<StopEntry[]>([
    { ...DEFAULT_STOP, kind: "PICKUP" },
    { ...DEFAULT_STOP, kind: "DROP" },
  ]);
  const [slots, setSlots] = useState<SlotEntry[]>([{ vehicle_type_id: "", slot_ref: "slot-1", pax: [] }]);
  const [bookedTripId, setBookedTripId] = useState<string | null>(null);

  const { data: customersData } = useQuery({
    queryKey: keys.config.customers.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/customers", {});
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

  const { data: vehicleTypesData } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/vehicle-types", {});
      if (err) throw err;
      return res;
    },
  });

  // Rate cards are the (vendor × vehicle type) versioned price list — customer-independent.
  // The vehicle type dropdown must only offer types that have an active card for the chosen
  // vendor — otherwise Create fails at quote time with "No rate card for this vehicle type".
  const { data: rateCardsData } = useQuery({
    queryKey: keys.config.rateCards.list(),
    queryFn: async () => {
      const { data: res, error: err } = await apiClient.GET("/v1/config/pricing/rate-cards", {
        params: { query: { page_size: 100 } },
      });
      if (err) throw err;
      return res;
    },
  });

  const customers = (customersData?.results ?? []) as Customer[];
  const vehicleTypes = (vehicleTypesData?.results ?? []) as VehicleType[];
  const vendors = (vendorsData?.results ?? []) as Vendor[];
  const rateCards = (rateCardsData?.results ?? []) as RateCard[];

  // Vehicle types covered by an ACTIVE, currently-valid rate card for the selected vendor.
  // null while no vendor is chosen — the dropdown stays unfiltered then. Pricing is by
  // vendor × vehicle type, so the customer choice does not affect which cars are available.
  const eligibleVehicleTypeIds = useMemo(() => {
    if (!vendorId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const ids = new Set<string>();
    for (const rc of rateCards) {
      if (rc.vendor !== vendorId) continue;
      if (!rc.is_active) continue;
      // A superseded card is not what the backend quotes from — exclude it so the dropdown
      // exactly matches the offers Create will actually find.
      if (rc.superseded_by) continue;
      if (rc.valid_from && rc.valid_from > today) continue;
      if (rc.valid_to && rc.valid_to < today) continue;
      ids.add(rc.vehicle_type);
    }
    return ids;
  }, [rateCards, vendorId]);

  const visibleVehicleTypes = eligibleVehicleTypeIds
    ? vehicleTypes.filter((v) => eligibleVehicleTypeIds.has(v.id))
    : vehicleTypes;

  // Changing customer/vendor can remove a previously-chosen car type from the rate-card set;
  // clear those slots rather than let Create fail on a stale selection.
  useEffect(() => {
    if (!eligibleVehicleTypeIds) return;
    setSlots((prev) =>
      prev.map((s) =>
        s.vehicle_type_id && !eligibleVehicleTypeIds.has(s.vehicle_type_id)
          ? { ...s, vehicle_type_id: "" }
          : s
      )
    );
  }, [eligibleVehicleTypeIds]);

  // One-click create: for each vehicle slot, fetch the priced offer for the SELECTED vendor
  // (offers are per vendor×customer×vehicle-type via rate cards), then book citing those
  // offers. Booking routes the slot to that vendor, so it appears in the vendor portal.
  const createMutation = useMutation({
    mutationFn: async () => {
      // Validate on click (button stays enabled) so the reason is never a mystery.
      if (!customerId) throw new Error("Select a customer.");
      if (!vendorId) throw new Error("Select a vendor.");
      if (slots.every((s) => !s.vehicle_type_id)) throw new Error("Select at least one vehicle type.");
      if (stops.some((s) => !s.address.trim())) throw new Error("Enter the pickup and drop address for every stop.");

      const when = pickupAt ? new Date(pickupAt).toISOString() : new Date().toISOString();
      const chosen: { slot: SlotEntry; offer: QuoteOffer }[] = [];

      for (const slot of slots) {
        if (!slot.vehicle_type_id) continue;
        const resp = await csrfFetch("/api/v1/pricing/offers/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer: customerId, vehicle_type: slot.vehicle_type_id, when }),
        });
        const envelope = await resp.json() as { result?: QuoteOffer[]; error?: { message?: string } };
        if (!resp.ok) throw new Error(envelope?.error?.message ?? `Pricing failed (${resp.status})`);
        const match = (envelope.result ?? []).find((o) => o.vendor === vendorId);
        if (!match) {
          const vtName = vehicleTypes.find((v) => v.id === slot.vehicle_type_id)?.name ?? "that vehicle type";
          const vName = vendors.find((v) => v.id === vendorId)?.name ?? "the selected vendor";
          throw new Error(`No rate card for ${vName} × ${vtName}. Add one under Pricing & Quotes.`);
        }
        chosen.push({ slot, offer: match });
      }
      if (!chosen.length) throw new Error("Add at least one vehicle type.");

      const resp = await csrfFetch("/api/v1/trips/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": generateIdempotencyKey() },
        body: JSON.stringify({
          customer_id: customerId,
          pickup_at: when,
          reference: reference || undefined,
          stops: stops.map((s, i) => ({
            sequence: i,
            kind: s.kind,
            location_type: s.location_type,
            address: s.address,
            lat: s.lat || undefined,
            lng: s.lng || undefined,
            extra: {
              planned_time: s.planned_time || undefined,
              flight_number: s.flight_number || undefined,
            },
          })),
          vehicles: chosen.map(({ slot, offer }) => ({
            vehicle_type_id: slot.vehicle_type_id,
            offer_id: offer.id,
            // Blank rows are ignored so an untouched passenger row never books an empty pax.
            pax: slot.pax
              .filter((p) => p.name.trim() || p.phone.trim())
              .map((p) => ({ name: p.name.trim(), phone: p.phone.trim() })),
          })),
        }),
      });
      const envelope = await resp.json() as { result?: { id?: string }; error?: { message?: string } };
      if (!resp.ok) throw new Error(envelope?.error?.message ?? `Create failed (${resp.status})`);
      return envelope.result;
    },
    onSuccess: (trip) => {
      addToast("Trip created", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setBookedTripId(trip?.id ?? null);
      setPhase("booked");
      onDone?.();
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Create failed", "error");
    },
  });

  const updateStop = (idx: number, field: keyof StopEntry, value: string | number) => {
    setStops((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addStop = () => {
    setStops((prev) => [...prev.slice(0, -1), { ...DEFAULT_STOP, kind: "WAYPOINT" }, prev[prev.length - 1]!]);
  };

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    setStops((prev) => prev.filter((_, i) => i !== idx));
  };

  const addSlot = () => {
    setSlots((prev) => [...prev, { vehicle_type_id: "", slot_ref: `slot-${prev.length + 1}`, pax: [] }]);
  };

  /** Seats on the chosen car type — the cap on how many passengers this slot can hold. */
  const seatsFor = (vehicleTypeId: string): number | null => {
    const vt = vehicleTypes.find((v) => v.id === vehicleTypeId);
    return typeof vt?.capacity === "number" ? vt.capacity : null;
  };

  const updateSlotPax = (slotIdx: number, pax: PaxEntry[]) =>
    setSlots((prev) => prev.map((s, i) => (i === slotIdx ? { ...s, pax } : s)));

  const addPax = (slotIdx: number) => {
    const slot = slots[slotIdx];
    if (!slot) return;
    const seats = seatsFor(slot.vehicle_type_id);
    if (seats !== null && slot.pax.length >= seats) return; // never exceed the car's seats
    updateSlotPax(slotIdx, [...slot.pax, { name: "", phone: "" }]);
  };

  const removePax = (slotIdx: number, paxIdx: number) => {
    const slot = slots[slotIdx];
    if (!slot) return;
    updateSlotPax(slotIdx, slot.pax.filter((_, i) => i !== paxIdx));
  };

  const updatePax = (slotIdx: number, paxIdx: number, field: keyof PaxEntry, val: string) => {
    const slot = slots[slotIdx];
    if (!slot) return;
    updateSlotPax(slotIdx, slot.pax.map((p, i) => (i === paxIdx ? { ...p, [field]: val } : p)));
  };

  const removeSlot = (idx: number) => {
    if (slots.length <= 1) return;
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  if (phase === "booked") {
    return (
      <Card padding="lg" className="text-center space-y-3 py-8">
        <p className="text-2xl">✅</p>
        <p className="font-semibold text-text-primary">Trip booked!</p>
        {bookedTripId && (
          <p className="text-xs font-mono text-text-secondary">{bookedTripId}</p>
        )}
        <Button onClick={() => { setPhase("form"); setBookedTripId(null); }}>
          Create another
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <FormField label="Customer">
        <SearchableSelect
          value={customerId}
          onChange={setCustomerId}
          options={customers.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Search customer…"
        />
      </FormField>

      <FormField label="Vendor">
        <SearchableSelect
          value={vendorId}
          onChange={setVendorId}
          options={vendors.map((v) => ({ value: v.id, label: v.name }))}
          placeholder="Search vendor…"
        />
      </FormField>

      <FormField label="Reference (optional)">
        <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / booking ref" />
      </FormField>

      <FormField label="Pickup Date & Time">
        <DateTimePicker mode="datetime" value={pickupAt} disablePast
          onChange={(val) => setPickupAt(val)} />
      </FormField>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Stops</h4>
          <Button size="sm" variant="secondary" onClick={addStop}>
            <Plus className="w-3 h-3 mr-1" /> Waypoint
          </Button>
        </div>

        {stops.map((stop, idx) => (
          <Card key={idx} padding="sm" className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                {idx === 0 ? "Pickup" : idx === stops.length - 1 ? "Drop" : `Waypoint ${idx}`}
              </span>
              {idx !== 0 && idx !== stops.length - 1 && (
                <button onClick={() => removeStop(idx)} className="text-danger text-xs">
                  <Minus className="w-3 h-3" />
                </button>
              )}
            </div>
            <Input
              placeholder="Address"
              value={stop.address}
              onChange={(e) => updateStop(idx, "address", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Type</label>
                <select
                  value={stop.location_type}
                  onChange={(e) => updateStop(idx, "location_type", e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-border rounded text-xs text-text-primary"
                >
                  {["ADDRESS", "AIRPORT", "RAIL", "HOTEL", "CITY"].map((lt) => (
                    <option key={lt} value={lt}>{lt}</option>
                  ))}
                </select>
              </div>
              <DateTimePicker placeholder="Time (optional)" disablePast
                mode="datetime" value={stop.planned_time}
                onChange={(val) => updateStop(idx, "planned_time", val)} />
            </div>
            {stop.location_type === "AIRPORT" && (
              <Input
                placeholder="Flight number"
                value={stop.flight_number}
                onChange={(e) => updateStop(idx, "flight_number", e.target.value)}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Vehicle Types</h4>
          <Button size="sm" variant="secondary" onClick={addSlot}>
            <Plus className="w-3 h-3 mr-1" /> Vehicle
          </Button>
        </div>

        {customerId && vendorId && (
          <p className="text-xs text-text-secondary">
            Showing {visibleVehicleTypes.length} vehicle type(s) with an active rate card for
            the selected customer + vendor.
            {visibleVehicleTypes.length === 0 &&
              " Add one under Pricing & Quotes before creating."}
          </p>
        )}

        {slots.map((slot, idx) => {
          const seats = seatsFor(slot.vehicle_type_id);
          const full = seats !== null && slot.pax.length >= seats;
          return (
            <div key={slot.slot_ref} className="rounded-lg border border-border p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <SearchableSelect
                  value={slot.vehicle_type_id}
                  onChange={(val) => setSlots((prev) => prev.map((s, i) => i === idx ? { ...s, vehicle_type_id: val } : s))}
                  options={visibleVehicleTypes.map((v) => ({
                    value: v.id,
                    label: typeof v.capacity === "number"
                      ? `${v.name} (${v.capacity} seats · ${v.luggage_capacity ?? 0} bags)`
                      : v.name,
                  }))}
                  placeholder={
                    customerId && vendorId
                      ? "Search vehicle type (rate-card covered)…"
                      : "Search vehicle type…"
                  }
                  className="flex-1"
                />
                {slots.length > 1 && (
                  <button onClick={() => removeSlot(idx)} className="text-danger" title="Remove vehicle">
                    <Minus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Passengers — optional, from none up to the car type's seat capacity. */}
              {slot.vehicle_type_id && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-secondary flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Passengers{" "}
                      <span className="text-text-tertiary">
                        {slot.pax.length}
                        {seats !== null ? ` / ${seats}` : ""}
                      </span>
                    </span>
                    <button
                      onClick={() => addPax(idx)}
                      disabled={full}
                      title={full ? `That car type seats only ${seats}` : "Add a passenger"}
                      className="text-xs text-brand-blue hover:underline disabled:text-text-tertiary disabled:no-underline disabled:cursor-not-allowed"
                    >
                      + Add passenger
                    </button>
                  </div>

                  {slot.pax.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <Input
                        placeholder={`Passenger ${pi + 1} name`}
                        value={p.name}
                        onChange={(e) => updatePax(idx, pi, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Phone (optional)"
                        value={p.phone}
                        onChange={(e) => updatePax(idx, pi, "phone", e.target.value)}
                        className="w-40"
                      />
                      <button
                        onClick={() => removePax(idx, pi)}
                        className="text-danger"
                        title="Remove passenger"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {full && (
                    <p className="text-[11px] text-text-tertiary">
                      Seat capacity reached — add another vehicle for more passengers.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => createMutation.mutate()}
        variant="primary"
        className="w-full"
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? "Creating…" : "Create"} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
};

ManualTripCreation.displayName = "ManualTripCreation";
