import { Stop, LocationType, TripVehicle, Pax } from "@/lib/types";
import { getLocationTypeFromAddress } from "@/lib/location";
import { uuidv4 as id } from "@/lib/shared";

export function createStop(
  seq: number,
  address: string,
  lat: number,
  lng: number,
  locationType: LocationType,
  flightNumber?: string,
  trainNumber?: string,
  terminal?: string
): Stop {
  return {
    seq,
    type: seq === 0 ? "PICKUP" : seq === 1 ? "DROP" : "WAYPOINT",
    address,
    lat,
    lng,
    locationType,
    flightNumber,
    trainNumber,
    terminal,
  };
}

export function createTripVehicle(requestedVehicleTypeId: string, vendorId?: string): TripVehicle {
  return {
    id: id(),
    requestedVehicleTypeId,
    vendorId,
    status: "PENDING",
    pax: [],
  };
}

export function calculateReverseScheduleTime(departureTime: string, travelTimeMinutes: number, bufferMinutes: number = 60): string {
  const dept = new Date(departureTime);
  const dispatchTime = new Date(dept.getTime() - (travelTimeMinutes + bufferMinutes) * 60 * 1000);
  return dispatchTime.toISOString().substring(0, 16);
}

export function isOfferExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function isOfferValid(expiresAt: string): boolean {
  return !isOfferExpired(expiresAt);
}

export function getLocationRequiredFields(locationType: LocationType): {
  flightNumberRequired: boolean;
  trainNumberRequired: boolean;
  terminalRequired: boolean;
} {
  return {
    flightNumberRequired: locationType === "AIRPORT",
    trainNumberRequired: locationType === "RAIL",
    terminalRequired: locationType === "AIRPORT",
  };
}

export function getLocationTypeLabel(locationType: LocationType): string {
  const labels: Record<LocationType, string> = {
    AIRPORT: "✈️ Airport",
    RAIL: "🚂 Railway Station",
    HOTEL: "🏨 Hotel",
    CITY: "🏙️ City Center",
    ADDRESS: "📍 Exact Address",
  };
  return labels[locationType];
}
