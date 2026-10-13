import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, keys, formatMoney, isApiError, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import { useToastStore } from "@/stores/toastStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { PassengerRecord, type PassengerRow } from "@/components/trips/PassengerRecord";
import { Plus, Minus, ArrowRight, Clock, Users, MapPin, Plane, TrainFront, Hotel, Building2, Trash2, Car, UserRound } from "lucide-react";

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

/** The create response: just the parts the booked card shows. */
interface BookedTrip {
  id?: string;
  reference?: string;
  vehicles?: { id: string; vehicle_type_name?: string | null; passengers?: PassengerRow[] }[];
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

let uidCounter = 0;
const newUid = (): string => `s${Date.now().toString(36)}${(uidCounter++).toString(36)}`;

interface StopEntry {
  /** Stable identity for this row — a passenger's drop point refers to it, not to a position. */
  uid: string;
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
  /** Which stop this passenger gets off at (a StopEntry.uid). Empty = the trip's final drop. */
  drop_stop_uid: string;
}

interface SlotEntry {
  vehicle_type_id: string;
  slot_ref: string;
  /** Passengers riding in this vehicle. Optional — 0 up to the car type's seat capacity. */
  pax: PaxEntry[];
}

const DEFAULT_STOP: StopEntry = {
  uid: "",
  kind: "PICKUP",
  location_type: "ADDRESS",
  address: "",
  lat: 0,
  lng: 0,
  planned_time: "",
  flight_number: "",
};

const LOCATION_TYPES: {
  value: StopEntry["location_type"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "ADDRESS", label: "Address", icon: MapPin },
  { value: "AIRPORT", label: "Airport", icon: Plane },
  { value: "RAIL", label: "Railway", icon: TrainFront },
  { value: "HOTEL", label: "Hotel", icon: Hotel },
  { value: "CITY", label: "City", icon: Building2 },
];

/** A numbered, titled group of fields — presentation only. */
function FormSection({
  step,
  title,
  hint,
  action,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ops-line bg-white p-4 sm:p-5 space-y-4">
      <header className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-blue text-white text-xs font-semibold shrink-0">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
          {hint && <p className="text-xs text-text-secondary">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

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
    { ...DEFAULT_STOP, uid: newUid(), kind: "PICKUP" },
    { ...DEFAULT_STOP, uid: newUid(), kind: "DROP" },
  ]);
  const [slots, setSlots] = useState<SlotEntry[]>([{ vehicle_type_id: "", slot_ref: "slot-1", pax: [] }]);
  const [bookedTripId, setBookedTripId] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedTrip | null>(null);
  // Total passenger count, entered up front — drives the vehicle-type suggestion below, and
  // seeds that many blank passenger rows on the slot it's applied to.
  const [totalPax, setTotalPax] = useState(1);
  // Mirrors totalPax as free text so the box can go momentarily blank while retyping — a
  // controlled input bound straight to the number can't represent "empty" without snapping
  // back to the last digit on every keystroke.
  const [paxText, setPaxText] = useState("1");

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
      // Single-page GET caps at the backend's default page_size=25 — the system now has
      // more vehicle types than that, so this silently dropped types past the cutoff
      // (alphabetically, e.g. "Sedan 4c"/"Sedan 5c") from this dropdown entirely.
      return { results: await fetchAllPages<VehicleType>("/api/v1/config/vehicle-types/") };
    },
  });

  // Rate cards are the (vendor × vehicle type) versioned price list — customer-independent.
  // The vehicle type dropdown must only offer types that have an active card for the chosen
  // vendor — otherwise Create fails at quote time with "No rate card for this vehicle type".
  //
  // Scoped server-side to the selected vendor (not fetched unfiltered): the system holds one
  // rate card per vendor × vehicle type × version, which multiplies out to thousands of rows
  // tenant-wide. An unfiltered single page — even at max_page_size — only ever returns the
  // most-recently-created slice across ALL vendors, so most vendors' own cards fell outside
  // it entirely (observed: a vendor with 65 cards showing only the 4 that happened to be
  // recent). Filtering by vendor keeps each fetch to one vendor's own set, and fetchAllPages
  // walks every page of that in case it ever exceeds one page.
  const { data: rateCardsData } = useQuery({
    queryKey: keys.config.rateCards.list({ vendor: vendorId }),
    queryFn: async () => ({
      results: await fetchAllPages<RateCard>(
        `/api/v1/config/pricing/rate-cards/?vendor=${encodeURIComponent(vendorId)}`
      ),
    }),
    enabled: !!vendorId,
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

  // Rate-card-covered types (for the selected vendor) that seat at least totalPax, smallest
  // first — "just enough capacity" rather than always pointing at the biggest car.
  const suggestedVehicleTypes = useMemo(() => {
    return visibleVehicleTypes
      .filter((v) => typeof v.capacity === "number" && v.capacity >= totalPax)
      .sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0));
  }, [visibleVehicleTypes, totalPax]);

  // Largest capacity the vendor has any rate card for at all — only meaningful when nothing
  // above fits, to tell the difference between "no vehicle is big enough" and "no vehicle
  // types loaded yet".
  const maxAvailableCapacity = useMemo(() => {
    return visibleVehicleTypes.reduce(
      (max, v) => (typeof v.capacity === "number" && v.capacity > max ? v.capacity : max),
      0
    );
  }, [visibleVehicleTypes]);

  // Keep the free-text box in sync whenever totalPax changes via the +/- buttons or a
  // suggestion click (see applySuggestion), without fighting the user's own typing (below).
  useEffect(() => {
    setPaxText(String(totalPax));
  }, [totalPax]);

  const setPax = (n: number) => setTotalPax(Math.max(1, n));

  /** Free-typed passenger count: digits only, and briefly allowed to sit empty while the user
   * retypes — totalPax (and therefore the suggestions) updates the instant it's a valid
   * positive integer, without forcing the box to snap back mid-edit.
   */
  const onPaxTextChange = (raw: string) => {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setPaxText(raw);
    if (raw === "") return;
    const n = parseInt(raw, 10);
    if (n >= 1) setTotalPax(n);
  };

  const onPaxTextBlur = () => {
    if (paxText === "" || parseInt(paxText, 10) < 1) setPaxText(String(totalPax));
  };

  const resizePax = (pax: PaxEntry[], count: number): PaxEntry[] => {
    if (pax.length === count) return pax;
    if (pax.length > count) return pax.slice(0, count);
    return [...pax, ...Array.from({ length: count - pax.length }, () => ({ name: "", phone: "", drop_stop_uid: "" }))];
  };

  // Fill the first empty slot (or slot 0, if every slot already has a type) with the chosen
  // suggestion, and resize its passenger rows to match totalPax (capped at the car's seats) —
  // extending with blank rows or trimming trailing ones, so clicking a suggestion always
  // reflects the current passenger count, not just the first time a type is picked.
  const applySuggestion = (vt: VehicleType) => {
    setSlots((prev) => {
      const emptyIdx = prev.findIndex((s) => !s.vehicle_type_id);
      const targetIdx = emptyIdx === -1 ? 0 : emptyIdx;
      return prev.map((s, i) => {
        if (i !== targetIdx) return s;
        const seats = typeof vt.capacity === "number" ? vt.capacity : totalPax;
        const paxCount = Math.min(totalPax, seats);
        return { ...s, vehicle_type_id: vt.id, pax: resizePax(s.pax, paxCount) };
      });
    });
  };

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

      // First/last stop, same PICKUP/DROP convention the stops list itself uses. Sent so the
      // backend can estimate a real distance (from these coordinates, or by geocoding the
      // address as a fallback) when distance_km isn't supplied directly — otherwise a PER_KM
      // rate card silently prices the quote at 0.
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];
      const asPlace = (s: StopEntry | undefined) =>
        s ? { address: s.address, lat: s.lat || undefined, lng: s.lng || undefined } : undefined;

      for (const slot of slots) {
        if (!slot.vehicle_type_id) continue;
        const resp = await csrfFetch("/api/v1/pricing/offers/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: customerId,
            vehicle_type: slot.vehicle_type_id,
            when,
            pickup: asPlace(firstStop),
            drop: asPlace(lastStop),
          }),
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
            // Ask the backend for per-passenger drop points and pickup/drop OTPs.
            passenger_otp: true,
            // Blank rows are ignored so an untouched passenger row never books an empty pax.
            pax: slot.pax
              .filter((p) => p.name.trim() || p.phone.trim())
              .map((p) => ({
                name: p.name.trim(),
                phone: p.phone.trim(),
                // Position of this passenger's drop stop in the stops list sent above.
                // Unset (or a stop since removed) falls back to the trip's final drop.
                drop_stop_index: (() => {
                  const at = stops.findIndex((s) => s.uid === p.drop_stop_uid);
                  return at > 0 ? at : stops.length - 1;
                })(),
              })),
          })),
        }),
      });
      const envelope = await resp.json() as { result?: BookedTrip; error?: { message?: string } };
      if (!resp.ok) throw new Error(envelope?.error?.message ?? `Create failed (${resp.status})`);
      return envelope.result;
    },
    onSuccess: (trip) => {
      addToast("Trip created", "success");
      void qc.invalidateQueries({ queryKey: keys.trips.all() });
      setBookedTripId(trip?.id ?? null);
      setBooked(trip ?? null);
      setPhase("booked");
      // The form stays open on the booked card (it carries the passengers' OTPs); the caller is
      // told when the user is finished — see the "Done" button below.
    },
    onError: (err) => {
      addToast(isApiError(err) ? err.message : err instanceof Error ? err.message : "Create failed", "error");
    },
  });

  const updateStop = (idx: number, field: keyof StopEntry, value: string | number) => {
    setStops((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // Free-typing an address invalidates any previously-picked coordinates — they no longer
  // necessarily match what's in the box. Picking a suggestion sets address + lat + lng together
  // (AddressAutocomplete.onSelect), so the coordinates always come from a real matched place.
  const updateStopAddressText = (idx: number, address: string) => {
    setStops((prev) => prev.map((s, i) => i === idx ? { ...s, address, lat: 0, lng: 0 } : s));
  };
  const selectStopAddress = (idx: number, result: { address: string; lat: number; lng: number }) => {
    setStops((prev) => prev.map((s, i) => i === idx ? { ...s, ...result } : s));
  };

  const addStop = () => {
    setStops((prev) => [...prev.slice(0, -1), { ...DEFAULT_STOP, uid: newUid(), kind: "WAYPOINT" }, prev[prev.length - 1]!]);
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
    updateSlotPax(slotIdx, [...slot.pax, { name: "", phone: "", drop_stop_uid: "" }]);
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
    const withPassengers = (booked?.vehicles ?? []).filter((v) => (v.passengers ?? []).length > 0);
    return (
      <div className="space-y-4">
        <Card padding="lg" className="text-center space-y-1.5 py-6">
          <p className="text-2xl">✅</p>
          <p className="font-semibold text-text-primary">Trip booked!</p>
          {(booked?.reference || bookedTripId) && (
            <p className="text-xs font-mono text-text-secondary">{booked?.reference ?? bookedTripId}</p>
          )}
        </Card>

        {withPassengers.length > 0 && (
          <section className="rounded-2xl border border-ops-line bg-white p-4 sm:p-5 space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-text-primary">Passenger OTPs</h4>
              <p className="text-xs text-text-secondary">
                Give each passenger their own pickup and drop codes. The driver will ask for them
                before confirming the pickup and again at the drop.
              </p>
            </div>
            {withPassengers.map((v, i) => (
              <div key={v.id} className="space-y-2">
                {withPassengers.length > 1 && (
                  <p className="text-xs font-medium text-text-secondary">
                    Vehicle {i + 1}
                    {v.vehicle_type_name ? ` · ${v.vehicle_type_name}` : ""}
                  </p>
                )}
                <PassengerRecord passengers={v.passengers ?? []} showOtps />
              </div>
            ))}
          </section>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setPhase("form");
              setBookedTripId(null);
              setBooked(null);
            }}
          >
            Create another
          </Button>
          <Button variant="primary" onClick={() => onDone?.()}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormSection step={1} title="Booking details" hint="Who the trip is for, which vendor serves it, and when it starts">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Customer" required>
            <SearchableSelect
              value={customerId}
              onChange={setCustomerId}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Search customer…"
            />
          </FormField>

          <FormField label="Vendor" required hint="The trip is routed to this vendor">
            <SearchableSelect
              value={vendorId}
              onChange={setVendorId}
              options={vendors.map((v) => ({ value: v.id, label: v.name }))}
              placeholder="Search vendor…"
            />
          </FormField>

          <FormField label="Pickup date & time" required>
            <DateTimePicker mode="datetime" value={pickupAt} disablePast onChange={(val) => setPickupAt(val)} />
          </FormField>

          <FormField label="Reference" hint="Optional: PO number or booking reference">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO / booking ref" />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        step={2}
        title="Route"
        hint="Pickup, any waypoints along the way, and the drop"
        action={
          <Button size="sm" variant="secondary" onClick={addStop}>
            <Plus className="w-3 h-3 mr-1" /> Waypoint
          </Button>
        }
      >
        <ol className="relative">
          {stops.map((stop, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === stops.length - 1;
            const removable = !isFirst && !isLast;
            const tone = isFirst ? "bg-success" : isLast ? "bg-danger" : "bg-alert-amber";
            return (
              <li key={idx} className={`relative pl-10 ${isLast ? "" : "pb-4"}`}>
                {!isLast && <span aria-hidden className="absolute left-[13px] top-8 bottom-0 w-px bg-border" />}
                <span
                  aria-hidden
                  className={`absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white ${tone}`}
                >
                  {isFirst ? "A" : isLast ? "B" : idx}
                </span>

                <div className="rounded-xl border border-ops-line bg-ops-card2/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">
                      {isFirst ? "Pickup" : isLast ? "Drop" : `Waypoint ${idx}`}
                    </span>
                    {removable && (
                      <button
                        type="button"
                        onClick={() => removeStop(idx)}
                        title="Remove waypoint"
                        aria-label={`Remove waypoint ${idx}`}
                        className="p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <AddressAutocomplete
                    placeholder={isFirst ? "Where is the pickup?" : isLast ? "Where is the drop?" : "Waypoint address"}
                    value={stop.address}
                    hasCoordinates={!!stop.lat && !!stop.lng}
                    onTextChange={(text) => updateStopAddressText(idx, text)}
                    onSelect={(result) => selectStopAddress(idx, result)}
                  />

                  <div role="radiogroup" aria-label="Location type" className="flex flex-wrap gap-1.5">
                    {LOCATION_TYPES.map(({ value, label, icon: Icon }) => {
                      const active = stop.location_type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => updateStop(idx, "location_type", value)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/30 ${
                            active
                              ? "border-brand-blue bg-brand-blue text-white"
                              : "border-border bg-white text-text-secondary hover:border-brand-blue/50 hover:text-text-primary"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <DateTimePicker
                      placeholder="Planned time (optional)"
                      disablePast
                      mode="datetime"
                      value={stop.planned_time}
                      onChange={(val) => updateStop(idx, "planned_time", val)}
                    />
                    {stop.location_type === "AIRPORT" && (
                      <Input
                        placeholder="Flight number"
                        value={stop.flight_number}
                        onChange={(e) => updateStop(idx, "flight_number", e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </FormSection>

      <FormSection
        step={3}
        title="Vehicles & passengers"
        hint="How many people are travelling and which car types carry them"
        action={
          <Button size="sm" variant="secondary" onClick={addSlot}>
            <Plus className="w-3 h-3 mr-1" /> Vehicle
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ops-line bg-ops-card2/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">Total passengers</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPax(totalPax - 1)}
              disabled={totalPax <= 1}
              aria-label="Decrease passenger count"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-white text-text-primary disabled:text-text-tertiary disabled:cursor-not-allowed hover:bg-ops-bg"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={paxText}
              onChange={(e) => onPaxTextChange(e.target.value)}
              onBlur={onPaxTextBlur}
              aria-label="Passenger count"
              className="w-14 h-8 px-1 text-center text-sm font-medium bg-white border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setPax(totalPax + 1)}
              aria-label="Increase passenger count"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-white text-text-primary hover:bg-ops-bg"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {vendorId && (
          <div className="text-xs text-text-secondary">
            {suggestedVehicleTypes.length > 0 ? (
              <span className="flex flex-wrap items-center gap-1.5">
                Suggested for {totalPax} passenger{totalPax !== 1 ? "s" : ""}:
                {suggestedVehicleTypes.slice(0, 3).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => applySuggestion(v)}
                    className="px-2.5 py-1 rounded-full border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                  >
                    {v.name} ({v.capacity} seats)
                  </button>
                ))}
              </span>
            ) : (
              <span className="text-warning">
                No rate-card-covered vehicle type for this vendor seats {totalPax}+ passengers
                {maxAvailableCapacity > 0 && ` (largest available: ${maxAvailableCapacity} seats)`}.
                Add more vehicles to split the group, or choose a different vendor.
              </span>
            )}
          </div>
        )}

        {customerId && vendorId && (
          <p className="text-xs text-text-secondary">
            Showing {visibleVehicleTypes.length} vehicle type(s) with an active rate card for
            the selected customer + vendor.
            {visibleVehicleTypes.length === 0 &&
              " Add one under Pricing & Quotes before creating."}
          </p>
        )}

        <div className="space-y-3">
          {slots.map((slot, idx) => {
            const seats = seatsFor(slot.vehicle_type_id);
            const full = seats !== null && slot.pax.length >= seats;
            const fill = seats ? Math.min(100, Math.round((slot.pax.length / seats) * 100)) : 0;
            return (
              <div key={slot.slot_ref} className="rounded-xl border border-ops-line p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ops-card2 text-brand-blue shrink-0">
                    <Car className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-semibold text-text-primary shrink-0">Vehicle {idx + 1}</span>
                  <SearchableSelect
                    value={slot.vehicle_type_id}
                    onChange={(val) =>
                      setSlots((prev) => prev.map((x, i) => (i === idx ? { ...x, vehicle_type_id: val } : x)))
                    }
                    options={visibleVehicleTypes.map((v) => ({
                      value: v.id,
                      label:
                        typeof v.capacity === "number"
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
                    <button
                      type="button"
                      onClick={() => removeSlot(idx)}
                      title="Remove vehicle"
                      aria-label={`Remove vehicle ${idx + 1}`}
                      className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Passengers — optional, from none up to the car type's seat capacity. */}
                {slot.vehicle_type_id && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-secondary flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Passengers
                        <span className="font-medium text-text-primary tabular">
                          {slot.pax.length}
                          {seats !== null ? ` / ${seats}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => addPax(idx)}
                        disabled={full}
                        title={full ? `That car type seats only ${seats}` : "Add a passenger"}
                        className="text-xs font-medium text-brand-blue hover:underline disabled:text-text-tertiary disabled:no-underline disabled:cursor-not-allowed"
                      >
                        + Add passenger
                      </button>
                    </div>

                    {seats !== null && (
                      <div className="h-1.5 rounded-full bg-ops-card2 overflow-hidden" aria-hidden>
                        <div
                          className={`h-full rounded-full transition-all ${full ? "bg-alert-amber" : "bg-brand-blue"}`}
                          style={{ width: `${fill}%` }}
                        />
                      </div>
                    )}

                    {slot.pax.map((p, pi) => {
                      // Where can this passenger get off? Every stop after the pickup.
                      const dropOptions = stops
                        .map((st, si) => ({ st, si }))
                        .filter(({ si }) => si > 0)
                        .map(({ st, si }) => {
                          const isFinal = si === stops.length - 1;
                          const role = isFinal ? "Final drop" : `Waypoint ${si}`;
                          return {
                            uid: st.uid,
                            isFinal,
                            label: `${role} · ${st.address.trim() || "address not entered yet"}`,
                          };
                        });
                      const finalUid = stops[stops.length - 1]?.uid ?? "";
                      const chosen = dropOptions.some((o) => o.uid === p.drop_stop_uid)
                        ? p.drop_stop_uid
                        : finalUid;
                      const chosenIsFinal = chosen === finalUid;
                      return (
                        <div key={pi} className="rounded-xl border border-ops-line bg-ops-card2/30 p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ops-card2 text-text-tertiary shrink-0">
                              <UserRound className="w-4 h-4" />
                            </span>
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
                              type="button"
                              onClick={() => removePax(idx, pi)}
                              title="Remove passenger"
                              aria-label={`Remove passenger ${pi + 1}`}
                              className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 pl-10">
                            <span
                              aria-hidden
                              className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
                                chosenIsFinal ? "bg-danger" : "bg-alert-amber"
                              }`}
                            />
                            <label className="text-xs font-medium text-text-secondary shrink-0">
                              Drops at
                            </label>
                            <select
                              value={chosen}
                              onChange={(e) => updatePax(idx, pi, "drop_stop_uid", e.target.value)}
                              aria-label={`Drop point for passenger ${pi + 1}`}
                              className="flex-1 min-w-0 rounded-lg border border-border bg-white px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
                            >
                              {dropOptions.map((o) => (
                                <option key={o.uid} value={o.uid}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}

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
      </FormSection>

      <div className="sticky -bottom-5 z-10 -mx-4 sm:-mx-6 -mb-5 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur border-t border-ops-line flex items-center justify-between gap-3">
        <p className="text-xs text-text-secondary">
          {stops.length} stops · {Math.max(totalPax, slots.reduce((n, sl) => n + sl.pax.length, 0))} passenger
          {Math.max(totalPax, slots.reduce((n, sl) => n + sl.pax.length, 0)) !== 1 ? "s" : ""} · {slots.length}{" "}
          vehicle{slots.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={() => createMutation.mutate()}
          variant="primary"
          className="min-w-40"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? "Creating…" : "Create"} <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

ManualTripCreation.displayName = "ManualTripCreation";
