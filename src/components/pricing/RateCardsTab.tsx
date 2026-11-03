import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguageStore, t, apiClient, keys, QueryBoundary, formatMoney, toMinor, csrfFetch } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { fetchAllPages } from "@/hooks/useCursorPagination";
import { splitAirportCodes } from "@/lib/airportCodes";
import { Button } from "@/components/ui/Button";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { useToastStore } from "@/stores/toastStore";

type RateCard = components["schemas"]["RateCard"];
type BasisEnum = components["schemas"]["BasisEnum"];
// "Hotel Rate" is not a real RateCard.Basis value on the backend — it is a UI-only choice in
// this same Basis dropdown that routes to a wholly separate model/endpoint
// (apps.pricing.models.HotelRate), because a vendor+vehicle-type can only ever have ONE live
// RateCard at a time, and a hotel rate needs many (one per hotel). Per explicit instruction:
// this lives in the existing Basis dropdown, not a separate tab.
type BasisChoice = BasisEnum | "HOTEL_RATE";

type ApiVendor = components["schemas"]["Vendor"] & { airport_code?: string | null };

// Matches apps.pricing.api.serializers.HotelRateSerializer/HotelSearchResultSerializer — a
// hand-rolled endpoint, not in the generated OpenAPI client (same raw-fetch pattern already
// used elsewhere for endpoints outside the generated schema, e.g. the roster upload views).
interface HotelRate {
  id: string;
  vendor: string;
  vendor_name: string;
  vehicle_type: string;
  vehicle_type_name: string;
  airport_code: string;
  rich_hotel_id: number;
  mapping_id: string;
  hotel_name: string;
  hotel_address: string;
  pickup_price_minor: number;
  drop_price_minor: number;
  currency: string;
  // Versioning (same idea as rate cards): a price change is a new version with a start date.
  version: number;
  version_count: number;
  valid_from: string;
  valid_to: string | null;
  status: "ACTIVE" | "UPCOMING" | "EXPIRED";
}

interface HotelSearchResult {
  id: number;
  // RICH's own stable external-reference string for the hotel (e.g. "HT00110") — the id a
  // partner system (RITMO) names a hotel by on a booking. Snapshotted onto the saved
  // HotelRate alongside hotel_name/hotel_address, same as rich_hotel_id.
  mapping_id: string;
  name: string;
  address: string;
  city: string;
  // Fetched from RICH but deliberately not surfaced in this picker — per explicit feedback,
  // a star-rating badge next to each hotel name wasn't reading well here. Kept on the type
  // since the API still returns it; just unused for display.
  star_category: string | null;
}

type RateCardInput = {
  vendor_id: string;
  vehicle_type_id: string;
  basis: BasisChoice;
  rate_per_km_minor?: number | null;
  rate_per_hour_minor?: number | null;
  currency?: string;
  modifiers?: Record<string, unknown>;
  valid_from: string;
  valid_to?: string | null;
};

interface RateCardsTabProps {
  searchQuery?: string;
}

// One row shape for the table, whichever of the two backends it came from — keeps a single
// DataTable/columns definition instead of two near-duplicate tables side by side.
interface DisplayRow {
  _kind: "rate_card" | "hotel_rate";
  id: string;
  basis: string;
  vendor_name: string;
  vehicle_type_name: string;
  vehicle_type: string;
  hotel_name?: string;
  rate_per_km_minor?: number | null;
  rate_per_hour_minor?: number | null;
  pickup_price_minor?: number;
  drop_price_minor?: number;
  currency: string;
  valid_from?: string;
  valid_to?: string | null;
  version?: number;
  status?: "ACTIVE" | "UPCOMING" | "EXPIRED";
}

// Symbols for the currencies actually in use across tenants today (core.money.DEFAULT_CURRENCY
// is "USD" platform-wide, but individual tenants price in their own real currency — JBM, kaif,
// chaudhary, and delhi vendor are all INR; Hubballi is USD; Gulf Express is AED). Only used for
// the rate-input label here; formatMoney (table display) already derives the correct symbol via
// Intl.NumberFormat from the row's own currency, no map needed there.
const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", INR: "₹", AED: "AED" };

// The backend RateCardWriteSerializer expects `vendor`/`vehicle_type` (not the `_id`-suffixed
// form-state names). Rate cards are keyed by vendor x vehicle type — no customer. Map before
// sending or the POST 400s ("vendor is required").
function toWire(input: RateCardInput): Record<string, unknown> {
  return {
    vendor: input.vendor_id,
    vehicle_type: input.vehicle_type_id,
    basis: input.basis,
    rate_per_km_minor: input.rate_per_km_minor ?? undefined,
    rate_per_hour_minor: input.rate_per_hour_minor ?? undefined,
    currency: input.currency || undefined,
    modifiers: input.modifiers,
    valid_from: input.valid_from,
    // Explicit null, not undefined: on a PATCH edit an omitted key leaves valid_to unchanged,
    // so clearing an end date has to send null to reset the card back to open-ended. The date
    // picker yields a string or undefined (never ""), so `?? null` gives a date or null.
    valid_to: input.valid_to ?? null,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) throw new Error(`${url} failed: ${resp.status}`);
  const envelope = (await resp.json()) as { result: T };
  return envelope.result;
}

export const RateCardsTab: React.FC<RateCardsTabProps> = ({ searchQuery = "" }) => {
  const language = useLanguageStore((s) => s.language);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  // Local component state — these three only ever narrowed this one table, so a cross-app
  // store bought nothing. Resets when you leave the tab, which is the expected behaviour for
  // a filter row anyway.
  const [rateCardVendorId, setRateCardVendorId] = useState("");
  const [rateCardVehicleTypeId, setRateCardVehicleTypeId] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: keys.config.rateCards.list(),
    queryFn: async () => {
      // Follow every cursor page so all rate cards load (and the count is correct) — not just 25.
      return { results: await fetchAllPages<RateCard>("/api/v1/config/pricing/rate-cards/") };
    },
  });

  const { data: hotelRatesData, isLoading: hotelRatesLoading, error: hotelRatesError } = useQuery({
    queryKey: keys.config.hotelRates.list(),
    queryFn: async () => {
      return { results: await fetchAllPages<HotelRate>("/api/v1/config/pricing/hotel-rates/") };
    },
  });

  const { data: vendorsData } = useQuery({
    queryKey: keys.config.vendors.list(),
    queryFn: async () => {
      return { results: await fetchAllPages<ApiVendor>("/api/v1/config/vendors/") };
    },
  });

  const { data: vehicleTypesData } = useQuery({
    queryKey: keys.config.vehicleTypes.list(),
    queryFn: async () => {
      // Single-page GET caps at the backend's default page_size=25 — the system now has
      // more vehicle types than that, so this silently dropped types past the cutoff
      // (alphabetically, e.g. "Sedan 4c"/"Sedan 5c") from the search and rate-card list.
      return { results: await fetchAllPages<components["schemas"]["VehicleType"]>("/api/v1/config/vehicle-types/") };
    },
  });

  const rateCards = (data?.results ?? []) as RateCard[];
  const hotelRates = hotelRatesData?.results ?? [];
  const vendors = (vendorsData?.results ?? []) as ApiVendor[];
  const vts = (vehicleTypesData?.results ?? []) as components["schemas"]["VehicleType"][];

  const displayRows: DisplayRow[] = [
    ...rateCards.map((r): DisplayRow => ({
      _kind: "rate_card",
      id: r.id,
      basis: r.basis,
      vendor_name: r.vendor_name,
      vehicle_type_name: r.vehicle_type_name,
      vehicle_type: r.vehicle_type,
      rate_per_km_minor: r.rate_per_km_minor,
      rate_per_hour_minor: r.rate_per_hour_minor,
      currency: r.currency,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      version: r.version,
    })),
    ...hotelRates.map((h): DisplayRow => ({
      _kind: "hotel_rate",
      id: h.id,
      basis: "HOTEL_RATE",
      vendor_name: h.vendor_name,
      vehicle_type_name: h.vehicle_type_name,
      vehicle_type: h.vehicle_type,
      hotel_name: h.hotel_name,
      pickup_price_minor: h.pickup_price_minor,
      drop_price_minor: h.drop_price_minor,
      currency: h.currency,
      valid_from: h.valid_from,
      valid_to: h.valid_to,
      version: h.version,
      status: h.status,
    })),
  ];

  const filteredRows = displayRows.filter((row) => {
    if (rateCardVendorId) {
      const source = row._kind === "rate_card" ? rateCards.find((r) => r.id === row.id) : hotelRates.find((h) => h.id === row.id);
      const vendorId = row._kind === "rate_card" ? (source as RateCard | undefined)?.vendor : (source as HotelRate | undefined)?.vendor;
      if (vendorId !== rateCardVendorId) return false;
    }
    if (rateCardVehicleTypeId && row.vehicle_type !== rateCardVehicleTypeId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        row.basis.toLowerCase().includes(q) ||
        (row.valid_from ?? "").includes(searchQuery) ||
        (row.hotel_name ?? "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async (input: RateCardInput) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/pricing/rate-cards", { body: toWire(input) as unknown as RateCard });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast(t("rateCardCreated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to create rate card", "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RateCardInput }) => {
      // PATCH edits this version in place — the version number does not move. Only the
      // supersede action publishes v+1.
      //
      // csrfFetch, not apiClient: PATCH on this path is not in the committed OpenAPI schema
      // (schema.yaml is stale), so the generated types reject it.
      const resp = await csrfFetch(`/api/v1/config/pricing/rate-cards/${id}/`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toWire(input)),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(body?.error?.message ?? `Failed to update rate card (${resp.status})`);
      }
      return (await resp.json()) as unknown;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast("Rate card updated", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to update rate card", "error");
    },
  });

  const supersedeMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: RateCardInput }) => {
      const { data: res, error: err } = await apiClient.POST("/v1/config/pricing/rate-cards/{id}/supersede", {
        params: { path: { id } },
        body: toWire(input) as unknown as RateCard,
      });
      if (err) throw err;
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.rateCards.list() });
      addToast(t("newVersionCreated", language), "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      addToast(err instanceof Error ? err.message : "Failed to supersede rate card", "error");
    },
  });

  // ------------------------------------------------------------ hotel-rate mutations
  // Separate model/endpoint (apps.pricing.models.HotelRate) — see BasisChoice's comment above
  // for why: RateCard allows only one live row per (vendor, vehicle type), a hotel rate needs
  // many (one per hotel), so this can never be a RateCard row no matter what the dropdown says.

  const createHotelRateMutation = useMutation({
    mutationFn: async (input: {
      vendor: string;
      vehicle_type: string;
      airport_code: string;
      rich_hotel_id: number;
      mapping_id?: string;
      hotel_name: string;
      hotel_address?: string;
      pickup_price_minor: number;
      drop_price_minor: number;
      currency?: string;
      valid_from?: string;
      valid_to?: string | null;
    }) => {
      const resp = await csrfFetch("/api/v1/config/pricing/hotel-rates/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = (await resp.json()) as { result?: HotelRate; error?: { message?: string } };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Create failed (${resp.status})`);
      return body.result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.hotelRates.list() });
      addToast("Hotel rate created.", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => addToast(err instanceof Error ? err.message : "Failed to create hotel rate", "error"),
  });

  const updateHotelRateMutation = useMutation({
    mutationFn: async ({ id, pickup, drop, valid_to }: { id: string; pickup: number; drop: number; valid_to: string | null }) => {
      const resp = await csrfFetch(`/api/v1/config/pricing/hotel-rates/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup_price_minor: pickup, drop_price_minor: drop, valid_to }),
      });
      const body = (await resp.json()) as { result?: HotelRate; error?: { message?: string } };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Update failed (${resp.status})`);
      return body.result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.hotelRates.list() });
      addToast("Hotel rate corrected.", "success");
      setDrawerOpen(false);
    },
    onError: (err: unknown) => addToast(err instanceof Error ? err.message : "Failed to update hotel rate", "error"),
  });

  // A price change: the next version, starting on a chosen date. The current version keeps
  // applying until then, and trips are priced by the version valid on their PICKUP date.
  const newHotelVersionMutation = useMutation({
    mutationFn: async (input: { id: string; valid_from: string; valid_to: string | null; pickup: number; drop: number; currency: string }) => {
      const resp = await csrfFetch(`/api/v1/config/pricing/hotel-rates/${input.id}/new-version/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valid_from: input.valid_from,
          valid_to: input.valid_to,
          pickup_price_minor: input.pickup,
          drop_price_minor: input.drop,
          currency: input.currency,
        }),
      });
      const body = (await resp.json()) as { result?: HotelRate; error?: { message?: string } };
      if (!resp.ok) throw new Error(body?.error?.message ?? `Could not add the version (${resp.status})`);
      return body.result;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: keys.config.hotelRates.list() });
      addToast(
        created && created.status === "UPCOMING"
          ? `Version ${created.version} scheduled from ${created.valid_from}.`
          : `Version ${created?.version ?? ""} is now in force.`,
        "success",
      );
      setDrawerOpen(false);
    },
    onError: (err: unknown) => addToast(err instanceof Error ? err.message : "Failed to add the version", "error"),
  });

  // Every version of one hotel deal, newest first.
  const [historyFor, setHistoryFor] = useState<HotelRate | null>(null);
  const { data: historyRows = [], isFetching: historyLoading } = useQuery({
    queryKey: ["hotel-rate-versions", historyFor?.id],
    enabled: historyFor !== null,
    queryFn: () => fetchJson<HotelRate[]>(`/api/v1/config/pricing/hotel-rates/${historyFor?.id}/versions/`),
  });

  const [pendingDelete, setPendingDelete] = useState<HotelRate | null>(null);
  const deleteHotelRateMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await csrfFetch(`/api/v1/config/pricing/hotel-rates/${id}/`, { method: "DELETE" });
      if (!resp.ok && resp.status !== 204) {
        const body = (await resp.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Delete failed (${resp.status})`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.config.hotelRates.list() });
      addToast("Hotel rate removed.", "success");
      setPendingDelete(null);
    },
    onError: (err: unknown) => addToast(err instanceof Error ? err.message : "Failed to remove hotel rate", "error"),
  });

  const today = new Date().toISOString().split("T")[0] ?? "";
  const emptyForm: RateCardInput = {
    vendor_id: vendors[0]?.id ?? "",
    vehicle_type_id: vts[0]?.id ?? "",
    basis: "PER_KM",
    rate_per_km_minor: 2000,
    modifiers: { min_fare_minor: 20000 },
    valid_from: today,
    currency: "USD",
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [supersedingId, setSupersedingId] = useState<string | null>(null);
  // "edit"      -> PATCH the card, version unchanged (or PATCH the hotel rate's prices).
  // "supersede" -> publish version + 1 and close the old one (rate cards only).
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "supersede">("create");
  const [formData, setFormData] = useState<RateCardInput>(emptyForm);

  // ------------------------------------------------------------ hotel-rate-only form state
  const [airportCode, setAirportCode] = useState("");
  const [selectedHotel, setSelectedHotel] = useState<HotelSearchResult | null>(null);
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");

  const isHotelRate = formData.basis === "HOTEL_RATE";
  const isEditingExisting = drawerMode === "edit" && supersedingId !== null;
  // Editing OR adding a version to an existing hotel rate: the vendor / vehicle type / airport /
  // hotel are fixed (changing any would be a different deal).
  const isExistingHotelDeal = isHotelRate && supersedingId !== null;

  const selectedVendor = vendors.find((v) => v.id === formData.vendor_id);
  const vendorAirportCodes = splitAirportCodes(selectedVendor?.airport_code);
  const showAirportPicker = vendorAirportCodes.length > 1;

  // A single-airport vendor's airport is implied the moment it's picked; a multi-airport
  // vendor needs an explicit choice (mirrors VehiclesTab.tsx's showAirport/airportOptions).
  useEffect(() => {
    if (!isHotelRate || isExistingHotelDeal) return;
    if (vendorAirportCodes.length === 1) {
      setAirportCode(vendorAirportCodes[0] ?? "");
    } else if (vendorAirportCodes.length === 0) {
      setAirportCode("");
    }
  }, [formData.vendor_id, isHotelRate, isExistingHotelDeal, vendorAirportCodes]);

  const { data: hotelOptions, isFetching: hotelsLoading } = useQuery({
    queryKey: keys.config.hotelSearch.list(airportCode),
    queryFn: () => fetchJson<HotelSearchResult[]>(`/api/v1/pricing/hotels/?airport_code=${airportCode}`),
    enabled: isHotelRate && Boolean(airportCode) && !isExistingHotelDeal,
  });

  /**
   * The rate inputs are held as text in *dollars*, not as numbers in the `_minor` fields.
   *
   * Two reasons. First, typing 22 used to be written straight into `rate_per_km_minor`, which
   * the API and the table both read as 22 *cents* — the card came back as $0.22. Second, a
   * number input backed by `minor / 100` cannot be typed into: after "22." parseFloat yields
   * 22, the field snaps back to "22", and the next keystroke gives 225 instead of 22.5.
   * Keeping the raw string until save fixes both.
   */
  const [rateText, setRateText] = useState<{ perKm: string; perHour: string }>({
    perKm: "",
    perHour: "",
  });

  /** Minor units → an editable dollar string. Blank for "not set", so the field starts empty. */
  const minorToDollarText = (minor?: number | null): string =>
    minor == null ? "" : String(minor / 100);

  const resetHotelFormState = () => {
    setAirportCode("");
    setSelectedHotel(null);
    setPickupText("");
    setDropText("");
  };

  const openCreate = () => {
    setDrawerMode("create");
    setSupersedingId(null);
    setFormData({ ...emptyForm, vendor_id: vendors[0]?.id ?? "", vehicle_type_id: vts[0]?.id ?? "" });
    setRateText({
      perKm: minorToDollarText(emptyForm.rate_per_km_minor),
      perHour: minorToDollarText(emptyForm.rate_per_hour_minor),
    });
    resetHotelFormState();
    setDrawerOpen(true);
  };

  const openEdit = (row: DisplayRow) => {
    if (row._kind === "hotel_rate") {
      const h = hotelRates.find((hr) => hr.id === row.id);
      if (!h) return;
      setDrawerMode("edit");
      setSupersedingId(h.id);
      setFormData({
        vendor_id: h.vendor,
        vehicle_type_id: h.vehicle_type,
        basis: "HOTEL_RATE",
        valid_from: h.valid_from,
        valid_to: h.valid_to,
        currency: h.currency,
      });
      setAirportCode(h.airport_code);
      // star_category isn't snapshotted on HotelRate (only name/address are) — not shown
      // while editing, just when picking a hotel fresh from RICH.
      setSelectedHotel({
        id: h.rich_hotel_id,
        mapping_id: h.mapping_id,
        name: h.hotel_name,
        address: h.hotel_address,
        city: "",
        star_category: null,
      });
      setPickupText(String(h.pickup_price_minor / 100));
      setDropText(String(h.drop_price_minor / 100));
      setDrawerOpen(true);
      return;
    }
    const rc = rateCards.find((r) => r.id === row.id);
    if (!rc) return;
    setDrawerMode("edit");
    setSupersedingId(rc.id);
    seedForm(rc);
  };

  /** Add the next version of a hotel rate: same deal, new prices, starting on a chosen date. */
  const openHotelNewVersion = (h: HotelRate) => {
    openEdit({ _kind: "hotel_rate", id: h.id } as DisplayRow);
    setDrawerMode("supersede");
    setFormData((prev) => ({ ...prev, valid_from: today, valid_to: undefined }));
  };

  const openSupersede = (rc: RateCard) => {
    setDrawerMode("supersede");
    setSupersedingId(rc.id);
    seedForm(rc);
    setFormData((prev) => ({ ...prev, valid_from: today }));
  };

  const seedForm = (rc: RateCard) => {
    resetHotelFormState();
    setFormData({
      vendor_id: rc.vendor,
      vehicle_type_id: rc.vehicle_type,
      basis: rc.basis,
      rate_per_km_minor: rc.rate_per_km_minor,
      rate_per_hour_minor: rc.rate_per_hour_minor,
      modifiers: rc.modifiers as Record<string, unknown> | undefined,
      // Edit keeps the card's own start date; a supersede overrides it to today below,
      // because a new version starts when it is published.
      valid_from: rc.valid_from,
      valid_to: rc.valid_to,
      currency: rc.currency,
    });
    setRateText({
      perKm: minorToDollarText(rc.rate_per_km_minor),
      perHour: minorToDollarText(rc.rate_per_hour_minor),
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!formData.vendor_id || !formData.vehicle_type_id) {
      addToast(t("vendorCustomerVehicleRequired", language), "error");
      return;
    }

    if (isHotelRate) {
      const currency = formData.currency ?? "USD";
      const toMinorOrNull = (text: string): number | null => {
        const trimmed = text.trim();
        if (!trimmed) return null;
        const value = Number(trimmed);
        if (!Number.isFinite(value) || value < 0) return null;
        return toMinor(value, currency);
      };
      const pickup = toMinorOrNull(pickupText);
      const drop = toMinorOrNull(dropText);
      if (pickup === null || drop === null) {
        addToast("Enter both a pickup and a drop price.", "error");
        return;
      }

      if (drawerMode === "supersede" && supersedingId) {
        if (!formData.valid_from) {
          addToast("Choose the date the new price starts.", "error");
          return;
        }
        if (formData.valid_to && formData.valid_to < formData.valid_from) {
          addToast("The end date cannot be before the start date.", "error");
          return;
        }
        newHotelVersionMutation.mutate({
          id: supersedingId,
          valid_from: formData.valid_from,
          valid_to: formData.valid_to ?? null,
          pickup,
          drop,
          currency,
        });
        return;
      }

      if (isEditingExisting && supersedingId) {
        updateHotelRateMutation.mutate({ id: supersedingId, pickup, drop, valid_to: formData.valid_to ?? null });
        return;
      }

      if (!airportCode || !selectedHotel) {
        addToast("Pick an airport and a hotel.", "error");
        return;
      }
      createHotelRateMutation.mutate({
        vendor: formData.vendor_id,
        vehicle_type: formData.vehicle_type_id,
        airport_code: airportCode,
        rich_hotel_id: selectedHotel.id,
        mapping_id: selectedHotel.mapping_id,
        hotel_name: selectedHotel.name,
        hotel_address: selectedHotel.address,
        pickup_price_minor: pickup,
        drop_price_minor: drop,
        currency,
        valid_from: formData.valid_from || undefined,
        valid_to: formData.valid_to ?? null,
      });
      return;
    }

    const currency = formData.currency ?? "USD";
    // Convert at the boundary: what the operator typed is dollars, what the API stores is cents.
    const toMinorOrUndefined = (text: string): number | undefined => {
      const trimmed = text.trim();
      if (!trimmed) return undefined;
      const value = Number(trimmed);
      if (!Number.isFinite(value) || value < 0) return undefined;
      return toMinor(value, currency);
    };

    const perKm = toMinorOrUndefined(rateText.perKm);
    const perHour = toMinorOrUndefined(rateText.perHour);

    if (formData.basis === "PER_KM" && perKm === undefined) {
      addToast("Enter a per-km rate.", "error");
      return;
    }
    if (formData.basis === "HOURLY" && perHour === undefined) {
      addToast("Enter an hourly rate.", "error");
      return;
    }

    const input: RateCardInput = {
      ...formData,
      rate_per_km_minor: perKm,
      rate_per_hour_minor: perHour,
    };

    if (drawerMode === "edit" && supersedingId) {
      updateMutation.mutate({ id: supersedingId, input });
    } else if (drawerMode === "supersede" && supersedingId) {
      supersedeMutation.mutate({ id: supersedingId, input });
    } else {
      createMutation.mutate(input);
    }
  };

  const basisLabel = (basis: string): string => (basis === "HOTEL_RATE" ? "Hotel Rate" : basis);

  const columns: Column[] = [
    {
      key: "basis",
      header: t("basis", language),
      sortable: true,
      render: (val): React.ReactNode => <Badge variant="blue">{basisLabel(val as string)}</Badge>,
    },
    {
      key: "vendor_name",
      header: t("vendor", language),
      sortable: true,
      render: (val): React.ReactNode => (val ? (val as string) : t("dash", language)),
    },
    {
      key: "vehicle_type_name",
      header: t("vehicleType", language),
      sortable: true,
      render: (val, row): React.ReactNode => {
        const name = val ? (val as string) : t("dash", language);
        const vt = vts.find((v) => v.id === (row as Record<string, unknown>).vehicle_type);
        return vt && typeof vt.luggage_capacity === "number"
          ? `${name} · ${vt.luggage_capacity} bag${vt.luggage_capacity === 1 ? "" : "s"}`
          : name;
      },
    },
    {
      key: "hotel_name",
      header: "Hotel",
      render: (val): React.ReactNode => (val ? (val as string) : t("dash", language)),
    },
    {
      key: "rate_per_km_minor",
      header: t("perKm", language),
      // Per explicit instruction: show each card's OWN currency (INR for JBM/kaif/chaudhary/
      // delhi vendor, USD for Hubballi, ...) — was hardcoded to "USD" regardless of the row's
      // real stored currency, so an INR card still rendered with a $ sign.
      render: (val, row): React.ReactNode =>
        val
          ? formatMoney(val as number, ((row as Record<string, unknown>).currency as string) || "USD")
          : t("dash", language),
    },
    {
      key: "rate_per_hour_minor",
      header: t("hourly", language),
      render: (val, row): React.ReactNode =>
        val
          ? formatMoney(val as number, ((row as Record<string, unknown>).currency as string) || "USD")
          : t("dash", language),
    },
    {
      key: "pickup_price_minor",
      header: "Pickup (hotel→airport)",
      render: (val, row): React.ReactNode =>
        val != null
          ? formatMoney(val as number, ((row as Record<string, unknown>).currency as string) || "USD")
          : t("dash", language),
    },
    {
      key: "drop_price_minor",
      header: "Drop (airport→hotel)",
      render: (val, row): React.ReactNode =>
        val != null
          ? formatMoney(val as number, ((row as Record<string, unknown>).currency as string) || "USD")
          : t("dash", language),
    },
    { key: "valid_from", header: t("validFrom", language), sortable: true, render: (val): React.ReactNode => (val ? (val as string) : t("dash", language)) },
    {
      key: "valid_to",
      header: t("validTo", language),
      render: (val): React.ReactNode => (val ? (val as string) : "∞"),
    },
    {
      key: "status",
      header: "Status",
      render: (val): React.ReactNode => {
        const st = val as string | undefined;
        if (!st) return t("dash", language);
        const variant = st === "ACTIVE" ? "green" : st === "UPCOMING" ? "blue" : "default";
        return <Badge variant={variant}>{st === "ACTIVE" ? "Active" : st === "UPCOMING" ? "Upcoming" : "Expired"}</Badge>;
      },
    },
    {
      key: "version",
      header: t("version", language),
      sortable: true,
      render: (val): React.ReactNode => (val ? <Badge variant="purple">v{val as number}</Badge> : t("dash", language)),
    },
    {
      key: "actions",
      header: "Actions",
      // Rate cards are copy-on-write in the backend (apps/pricing/services.supersede_rate_card):
      // a card that has priced an Offer is evidence of what someone was quoted, so editing in
      // place would rewrite history — "Edit rates" PATCHes in place, "New version" publishes
      // v+1. Hotel rates have no Offer referencing them yet, so they get an ordinary edit +
      // remove instead.
      render: (_, row): React.ReactNode => {
        const display = row as unknown as DisplayRow;
        if (display._kind === "hotel_rate") {
          const h = hotelRates.find((hr) => hr.id === display.id);
          return (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openEdit(display)}
                title={`Correct v${h?.version ?? ""} in place — the price history is not kept; use New version for a real price change`}
              >
                Correct
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-brand-wine/10! hover:text-brand-wine!"
                onClick={() => h && openHotelNewVersion(h)}
                title="Set new prices from a chosen date, keeping the current ones on record"
              >
                {t("newVersion", language)}
              </Button>
              {h && h.version_count > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setHistoryFor(h)}>
                  History
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="hover:bg-danger/10! hover:text-danger!"
                onClick={() => h && setPendingDelete(h)}
              >
                Remove
              </Button>
            </div>
          );
        }
        const rc = rateCards.find((r) => r.id === display.id);
        if (!rc) return null;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openEdit(display)}
              title={`Edit v${rc.version} in place — the version number does not change`}
            >
              {t("edit", language)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="hover:bg-brand-wine/10! hover:text-brand-wine!"
              onClick={() => openSupersede(rc)}
              title={`Publish v${rc.version + 1} based on this card`}
            >
              {t("newVersion", language)}
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
          {t("rateCards", language)} ({filteredRows.length})
        </h3>
        <Button onClick={openCreate} variant="primary" size="sm">
          {t("newRateCard", language)}
        </Button>
      </div>

      {/* Comboboxes rather than native <select>: these lists grow with the tenant (every vendor,
          every customer), and scrolling a 60-row native dropdown to find one name is the slow
          part of building a rate card. The leading "All …" entry has value "" so the filter can
          be cleared from inside the same list. */}
      <div className="flex gap-3 flex-wrap">
        <SearchableSelect
          className="w-48"
          clearable
          value={rateCardVendorId}
          onChange={setRateCardVendorId}
          placeholder="Search vendor…"
          options={[
            { value: "", label: "All vendors" },
            ...vendors.map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
        <SearchableSelect
          className="w-48"
          clearable
          value={rateCardVehicleTypeId}
          onChange={setRateCardVehicleTypeId}
          placeholder="Search vehicle type…"
          options={[
            { value: "", label: "All types" },
            ...vts.map((v) => ({ value: v.id, label: v.name })),
          ]}
        />
      </div>

      <QueryBoundary isLoading={isLoading || hotelRatesLoading} error={error || hotelRatesError} isEmpty={filteredRows.length === 0} emptyFallback={<p className="text-sm text-text-secondary py-4">{t("noRateCards", language)}</p>}>
        <DataTable
          columns={columns}
          data={filteredRows as unknown as Record<string, unknown>[]}
          pageSize={10}
          emptyMessage={t("noRateCards", language)}
        />
      </QueryBoundary>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={
          drawerMode === "edit"
            ? isHotelRate
              ? "Correct hotel rate"
              : "Edit this version (version number unchanged)"
            : drawerMode === "supersede"
              ? isHotelRate
                ? "New hotel rate version"
                : t("newVersion", language)
              : t("newRateCard", language)
        }
        size="xl"
        premium
      >
        <div className="space-y-4">
          <FormField label={t("vendor", language)} required>
            {supersedingId ? (
              // Locked while editing/superseding: changing these would be a different deal (or
              // a different hotel pairing), not an edit of this one.
              <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                {vendors.find((o) => o.id === formData.vendor_id)?.name ?? "—"}
                <span className="ml-2 text-xs text-text-muted">(cannot change in-place)</span>
              </div>
            ) : (
              <SearchableSelect
                value={formData.vendor_id}
                onChange={(value) => setFormData({ ...formData, vendor_id: value })}
                options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vendor…"
              />
            )}
          </FormField>

          <FormField label={t("vehicleType", language)} required>
            {supersedingId ? (
              <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                {vts.find((o) => o.id === formData.vehicle_type_id)?.name ?? "—"}
                <span className="ml-2 text-xs text-text-muted">(cannot change in-place)</span>
              </div>
            ) : (
              <SearchableSelect
                value={formData.vehicle_type_id}
                onChange={(value) => setFormData({ ...formData, vehicle_type_id: value })}
                options={vts.map((v) => ({ value: v.id, label: v.name }))}
                placeholder="Search vehicle type…"
              />
            )}
          </FormField>

          <FormField label={t("basis", language)}>
            <Select
              value={formData.basis}
              disabled={isEditingExisting}
              onChange={(e) => setFormData({ ...formData, basis: e.target.value as BasisChoice })}
              options={[
                { value: "PER_KM", label: t("perKm", language) },
                { value: "HOURLY", label: t("hourly", language) },
                { value: "HOTEL_RATE", label: "Hotel Rate" },
              ]}
            />
          </FormField>

          {/* Per explicit instruction: rate cards must show/enter in the tenant's own real
              currency (INR for JBM/kaif/chaudhary/delhi vendor, USD for Hubballi, ...) — this
              field didn't exist before, so every new rate card silently defaulted to USD
              regardless of the tenant, which is what caused JBM's own rates to read in $. */}
          <FormField label={t("currency", language)}>
            <Select
              value={formData.currency ?? "USD"}
              disabled={isEditingExisting}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              options={[
                { value: "USD", label: "USD ($)" },
                { value: "INR", label: "INR (₹)" },
                { value: "AED", label: "AED" },
              ]}
            />
          </FormField>

          {formData.basis === "PER_KM" && (
            <FormField label={`${t("ratePerKm", language)} (${CURRENCY_SYMBOL[formData.currency ?? "USD"] ?? formData.currency})`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 22.50"
                value={rateText.perKm}
                onChange={(e) => setRateText((prev) => ({ ...prev, perKm: e.target.value }))}
              />
            </FormField>
          )}

          {formData.basis === "HOURLY" && (
            <FormField label={`${t("hourlyRate", language)} (${CURRENCY_SYMBOL[formData.currency ?? "USD"] ?? formData.currency})`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 450.00"
                value={rateText.perHour}
                onChange={(e) => setRateText((prev) => ({ ...prev, perHour: e.target.value }))}
              />
            </FormField>
          )}

          {isHotelRate && (
            <>
              {isExistingHotelDeal && drawerMode === "supersede" && (
                <div className="rounded-lg border border-accent-gold/40 bg-gold-soft px-3 py-2.5 text-xs text-text-primary">
                  The current price keeps applying until the start date below. Trips are priced by the
                  version valid on their <span className="font-semibold">pickup date</span>, and quotes
                  already given are not changed.
                </div>
              )}
              {isExistingHotelDeal ? (
                <FormField label="Airport">
                  <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                    {airportCode}
                    <span className="ml-2 text-xs text-text-muted">(cannot change in-place)</span>
                  </div>
                </FormField>
              ) : (
                showAirportPicker && (
                  <FormField label="Airport" required hint="This vendor serves more than one airport — pick which one this rate is for.">
                    <SearchableSelect
                      value={airportCode}
                      onChange={(val) => {
                        setAirportCode(val);
                        setSelectedHotel(null);
                      }}
                      options={vendorAirportCodes.map((c) => ({ value: c, label: c }))}
                      placeholder="Select airport…"
                    />
                  </FormField>
                )
              )}

              <FormField label="Hotel" required hint={isExistingHotelDeal ? undefined : "Sourced live from RICH, filtered to the airport above."}>
                {isExistingHotelDeal ? (
                  <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-text-secondary">{selectedHotel?.name ?? "—"}</span>
                      <span className="text-xs text-text-muted ml-1">(cannot change in-place)</span>
                    </div>
                    {selectedHotel?.address && <div className="text-xs text-text-tertiary mt-0.5">{selectedHotel.address}</div>}
                  </div>
                ) : (
                  <SearchableSelect
                    value={selectedHotel ? String(selectedHotel.id) : ""}
                    onChange={(val) => setSelectedHotel(hotelOptions?.find((h) => String(h.id) === val) ?? null)}
                    options={(hotelOptions ?? []).map((h) => ({
                      value: String(h.id),
                      label: h.name,
                      description: h.address,
                    }))}
                    placeholder={!airportCode ? "Pick a vendor/airport first…" : hotelsLoading ? "Loading hotels…" : "Search hotel…"}
                    disabled={!airportCode}
                  />
                )}
              </FormField>

              <FormField label={`Pickup price — hotel → airport (${CURRENCY_SYMBOL[formData.currency ?? "USD"] ?? formData.currency})`}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 800.00"
                  value={pickupText}
                  onChange={(e) => setPickupText(e.target.value)}
                />
              </FormField>

              <FormField label={`Drop price — airport → hotel (${CURRENCY_SYMBOL[formData.currency ?? "USD"] ?? formData.currency})`}>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 900.00"
                  value={dropText}
                  onChange={(e) => setDropText(e.target.value)}
                />
              </FormField>
            </>
          )}

          {isHotelRate && (
            <>
              <FormField
                label={drawerMode === "supersede" ? "New price starts on" : t("validFrom", language)}
                required={drawerMode !== "edit"}
                hint={
                  drawerMode === "supersede"
                    ? "Pick a future date to schedule the change; today applies it straight away."
                    : drawerMode === "edit"
                      ? "The start date of a later version is fixed when it is created."
                      : "The first day this price applies."
                }
              >
                {drawerMode === "edit" && (hotelRates.find((hr) => hr.id === supersedingId)?.version ?? 1) > 1 ? (
                  <div className="px-3 py-2 bg-page-bg border border-border rounded-lg text-sm text-text-secondary">
                    {formData.valid_from}
                  </div>
                ) : (
                  <DateTimePicker mode="date" value={formData.valid_from}
                    onChange={(val) => setFormData({ ...formData, valid_from: val })} />
                )}
              </FormField>
              <FormField label={t("validTo", language)} hint="Optional — leave empty to keep it open-ended.">
                <DateTimePicker mode="date" value={formData.valid_to ?? ""}
                  onChange={(val) => setFormData({ ...formData, valid_to: val || undefined })} />
              </FormField>
            </>
          )}

          {!isHotelRate && (
            <>
              <FormField label={t("validFrom", language)}>
                <DateTimePicker mode="date" value={formData.valid_from}
                  onChange={(val) => setFormData({ ...formData, valid_from: val })} />
              </FormField>

              <FormField label={t("validTo", language)}>
                <DateTimePicker mode="date" value={formData.valid_to ?? ""}
                  onChange={(val) => setFormData({ ...formData, valid_to: val || undefined })} />
              </FormField>
            </>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              variant="primary"
              disabled={createMutation.isPending || supersedeMutation.isPending || updateMutation.isPending || createHotelRateMutation.isPending || updateHotelRateMutation.isPending || newHotelVersionMutation.isPending}
            >
              {drawerMode === "edit"
                ? isHotelRate
                  ? "Save correction"
                  : "Save changes"
                : drawerMode === "supersede"
                  ? t("createVersion", language)
                  : t("create", language)}
            </Button>
            <Button onClick={() => setDrawerOpen(false)} variant="secondary">
              {t("cancel", language)}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title={historyFor ? `${historyFor.hotel_name} — price history` : "Price history"}
        size="xl"
      >
        {historyLoading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-text-tertiary">
                <th className="py-2 pr-3">Version</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Valid</th>
                <th className="py-2 pr-3 text-right">Pickup (hotel→airport)</th>
                <th className="py-2 text-right">Drop (airport→hotel)</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((v) => (
                <tr key={v.id} className="border-t border-ops-line">
                  <td className="py-2 pr-3"><Badge variant="purple">v{v.version}</Badge></td>
                  <td className="py-2 pr-3">
                    <Badge variant={v.status === "ACTIVE" ? "green" : v.status === "UPCOMING" ? "blue" : "default"}>
                      {v.status === "ACTIVE" ? "Active" : v.status === "UPCOMING" ? "Upcoming" : "Expired"}
                    </Badge>
                  </td>
                  <td className="py-2 pr-3 tabular">{v.valid_from} → {v.valid_to ?? "∞"}</td>
                  <td className="py-2 pr-3 text-right tabular">{formatMoney(v.pickup_price_minor, v.currency)}</td>
                  <td className="py-2 text-right tabular">{formatMoney(v.drop_price_minor, v.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this hotel rate?"
        message={
          pendingDelete
            ? `This stops pricing airport transfers for ${pendingDelete.hotel_name}${pendingDelete.version_count > 1 ? ` and removes all ${pendingDelete.version_count} of its versions` : ""}. To change the price instead, add a new version.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        busy={deleteHotelRateMutation.isPending}
        onConfirm={() => pendingDelete && deleteHotelRateMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

RateCardsTab.displayName = "RateCardsTab";
