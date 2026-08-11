"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, csrfFetch, keys } from "@/lib/shared";
import type { components } from "@/lib/shared/api/schema.d";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { useToastStore } from "@/stores/toastStore";
import { Copy, Send } from "lucide-react";

type Customer = components["schemas"]["Customer"];
type VehicleType = components["schemas"]["VehicleType"];

type Method = "API_PAX" | "API_VEHICLE_COUNT";

const ENDPOINT: Record<Method, string> = {
  API_PAX: "/api/v1/trips/pax-payload/",
  API_VEHICLE_COUNT: "/api/v1/trips/vehicle-count/",
};

interface PaxRow {
  id: string;
  name: string;
  phone: string;
}

/** Local ISO (yyyy-MM-ddTHH:mm) -> absolute ISO the API expects. */
function toIso(local: string): string {
  return local ? new Date(local).toISOString() : new Date().toISOString();
}

export const ApiTester: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  const [method, setMethod] = useState<Method>("API_PAX");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null);

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
  const [distanceKm, setDistanceKm] = useState("35");
  const [vehicleCount, setVehicleCount] = useState(2);
  const [autoAssign, setAutoAssign] = useState(false);
  const [pax, setPax] = useState<PaxRow[]>([
    { id: "P1", name: "John Doe", phone: "9876543210" },
    { id: "P2", name: "Jane Smith", phone: "9876543211" },
  ]);

  // Real tenant data — these dropdowns used to read from client-side mock stores.
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

  // Default to the first of each once loaded, so the console is usable immediately.
  useEffect(() => {
    if (!customerId && customers[0]) setCustomerId(customers[0].id);
  }, [customers, customerId]);
  useEffect(() => {
    if (!vehicleTypeId && vehicleTypes[0]) setVehicleTypeId(vehicleTypes[0].id);
  }, [vehicleTypes, vehicleTypeId]);

  /** Exactly what will be POSTed — shown to the user and sent verbatim. */
  const requestBody = useMemo(() => {
    const stops = [
      { kind: "PICKUP", address: pickupAddress, location_type: "AIRPORT" },
      { kind: "DROP", address: dropAddress, location_type: "ADDRESS" },
    ];
    const base = {
      customer_id: customerId,
      vehicle_type_id: vehicleTypeId,
      pickup_at: toIso(pickupAt),
      stops,
      distance_km: distanceKm || "0",
    };
    return method === "API_PAX"
      ? { ...base, pax: pax.map((p) => ({ id: p.id, name: p.name, phone: p.phone })) }
      : { ...base, count: vehicleCount, auto_assign: autoAssign };
  }, [
    method, customerId, vehicleTypeId, pickupAt, pickupAddress, dropAddress,
    distanceKm, pax, vehicleCount, autoAssign,
  ]);

  const handleTestApi = async () => {
    if (!customerId || !vehicleTypeId) {
      addToast("Pick a customer and a vehicle type.", "error");
      return;
    }
    if (method === "API_PAX" && pax.length === 0) {
      addToast("Add at least one passenger.", "error");
      return;
    }
    setIsLoading(true);
    setResponse(null);
    try {
      const resp = await csrfFetch(ENDPOINT[method], {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const body: unknown = await resp.json().catch(() => ({}));
      setResponse({ status: resp.status, body });
      if (resp.ok) {
        const ref =
          (body as { trip_reference?: string })?.trip_reference ??
          (body as { trip_id?: string })?.trip_id ??
          "created";
        addToast(`Trip created: ${ref}`, "success");
      } else {
        const msg = (body as { error?: { message?: string } })?.error?.message;
        addToast(msg ?? `Request failed (${resp.status})`, "error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setResponse({ status: 0, body: { error: message } });
      addToast(message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const updatePax = (i: number, field: keyof PaxRow, val: string) =>
    setPax((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: val } : p)));

  return (
    <div className="space-y-4">
      <Card padding="md">
        <p className="text-xs text-text-secondary">
          Sends a real request to{" "}
          <code className="font-mono text-brand-blue">{ENDPOINT[method]}</code> as the signed-in
          admin. This creates a real trip in your tenant.
        </p>
      </Card>

      <div className="flex gap-2">
        {(["API_PAX", "API_VEHICLE_COUNT"] as Method[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMethod(m);
              setResponse(null);
            }}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              method === m
                ? "bg-brand-blue text-white border-brand-blue"
                : "border-border text-text-secondary hover:bg-brand-blue/10"
            }`}
          >
            {m === "API_PAX" ? "Pax payload" : "Vehicle count"}
          </button>
        ))}
      </div>

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

      {method === "API_PAX" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Passengers ({pax.length})</span>
            <button
              onClick={() =>
                setPax((p) => [...p, { id: `P${p.length + 1}`, name: "", phone: "" }])
              }
              className="text-xs text-brand-blue hover:underline"
            >
              + Add passenger
            </button>
          </div>
          {pax.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Name"
                value={p.name}
                onChange={(e) => updatePax(i, "name", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Phone"
                value={p.phone}
                onChange={(e) => updatePax(i, "phone", e.target.value)}
                className="w-40"
              />
              <button
                onClick={() => setPax((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-danger text-xs px-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Vehicle count">
            <Input
              type="number"
              value={String(vehicleCount)}
              onChange={(e) => setVehicleCount(Math.max(1, Number(e.target.value) || 1))}
            />
          </FormField>
          <FormField label="Auto-assign">
            <label className="flex items-center gap-2 text-sm text-text-primary pt-2">
              <input
                type="checkbox"
                checked={autoAssign}
                onChange={(e) => setAutoAssign(e.target.checked)}
              />
              Assign nearest vehicle to each slot
            </label>
          </FormField>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-text-secondary">Request body</span>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(requestBody, null, 2));
              addToast("Request copied", "success");
            }}
            className="text-xs text-brand-blue hover:underline flex items-center gap-1"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
        <pre className="text-xs bg-ops-bg border border-border rounded-lg p-3 overflow-auto max-h-56 text-text-primary">
          {JSON.stringify(requestBody, null, 2)}
        </pre>
      </div>

      <Button onClick={() => void handleTestApi()} variant="primary" loading={isLoading} className="w-full">
        <Send className="w-4 h-4 mr-2" /> Send Request
      </Button>

      {response && (
        <Card padding="md">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-text-secondary">Response</span>
            <Badge variant={response.status >= 200 && response.status < 300 ? "green" : "red"}>
              HTTP {response.status || "network error"}
            </Badge>
          </div>
          <pre className="text-xs bg-ops-bg border border-border rounded-lg p-3 overflow-auto max-h-72 text-text-primary">
            {JSON.stringify(response.body, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

ApiTester.displayName = "ApiTester";
