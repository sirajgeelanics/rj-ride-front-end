import { LocationType } from "@/lib/types";

export interface LocationRequirements {
  flightNumber?: boolean;
  trainNumber?: boolean;
  terminal?: boolean;
  lodging?: boolean;
}

export function getLocationTypeFromAddress(address: string): LocationType {
  const lower = address.toLowerCase();
  if (lower.includes("airport") || lower.includes("aero")) return "AIRPORT";
  if (lower.includes("railway") || lower.includes("station") || lower.includes("rail")) return "RAIL";
  if (lower.includes("hotel") || lower.includes("resort") || lower.includes("lodge")) return "HOTEL";
  if (lower.includes("city")) return "CITY";
  return "ADDRESS";
}

export function getLocationRequirements(locationType: LocationType): LocationRequirements {
  switch (locationType) {
    case "AIRPORT":
      return { flightNumber: true, terminal: false };
    case "RAIL":
      return { trainNumber: true };
    case "HOTEL":
      return { lodging: true };
    case "CITY":
      return {};
    case "ADDRESS":
    default:
      return {};
  }
}

export function isLocationTypeRequired(locationType: LocationType, field: keyof LocationRequirements): boolean {
  const reqs = getLocationRequirements(locationType);
  return reqs[field] === true;
}
