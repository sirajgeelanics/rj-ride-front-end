export type ID = string;

// === From ride_prd lib/types (exact match for persist compatibility) ===

export type CreationMethod = "MANUAL" | "BULK_UPLOAD" | "API_PAX" | "API_VEHICLE_COUNT" | "RECURRING" | "CLONE";
export type TripStatus = "DRAFT" | "CONFIRMED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "BILLED" | "CANCELLED";
export type VehicleStatus =
  | "PENDING" | "ASSIGNED" | "DRIVER_ACCEPTED" | "DRIVER_REJECTED"
  | "EN_ROUTE_PICKUP" | "AT_PICKUP" | "PAX_PICKED" | "IN_TRANSIT"
  | "AT_DROP" | "PAX_DROPPED" | "COMPLETED" | "NO_SHOW"
  | "BREAKDOWN" | "ACCIDENT" | "VEHICLE_SWAP" | "DELAYED" | "SOS" | "CANCELLED";

export type StopType = "PICKUP" | "DROP" | "WAYPOINT";
export type LocationType = "AIRPORT" | "RAIL" | "HOTEL" | "CITY" | "ADDRESS";
export type DriverShift = "DAY" | "NIGHT" | "FLEX";
export type VehicleOwnership = "OWN" | "LEASED" | "SUB_VENDOR";
export type FuelType = "PETROL" | "DIESEL" | "CNG" | "EV";

export interface Stop {
  seq: number;
  type: StopType;
  locationType: LocationType;
  address: string;
  lat: number;
  lng: number;
  plannedTime?: string;
  flightNumber?: string;
  trainNumber?: string;
  terminal?: string;
}

export interface Pax {
  id: ID;
  name?: string;
  phone?: string;
  email?: string;
  employeeId?: string;
  pnr?: string;
}

export interface OTPGates {
  pickup?: string;
  drop?: string;
  pickupVerified?: boolean;
  dropVerified?: boolean;
}

export interface TripVehicle {
  id: ID;
  requestedVehicleTypeId: ID;
  vendorId?: ID;
  priceId?: ID;
  lockedPrice?: number;
  lockedRateCardVersion?: number;
  vehicleId?: ID;
  driverId?: ID;
  status: VehicleStatus;
  pax: Pax[];
  otp?: OTPGates;
  addonServiceIds?: ID[];
}

export interface RecurrenceRule {
  freq: "DAILY" | "WEEKLY";
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  time: string;
}

export type Schedule =
  | { type: "ONE_OFF"; when?: string }
  | { type: "RECURRING"; rule: RecurrenceRule };

export interface TripRequest {
  id: ID;
  tenantId: ID;
  customerId: ID;
  createdVia: CreationMethod;
  stops: Stop[];
  vehicles: TripVehicle[];
  schedule: Schedule;
  status: TripStatus;
  autoAssign: boolean;
  reference?: string;
  coordinator?: { name?: string; phone?: string };
  viewers?: string[];
  costCenter?: string;
  pos?: string;
  createdAt: string;
  vendorDeclineLog?: VendorDeclineEntry[];
}

export interface DriverDocument {
  kind: "LICENCE" | "PSV_BADGE" | "POLICE_VERIFICATION" | "MEDICAL" | "INDUCTION";
  number?: string;
  expiry?: string;
  fileName?: string;
}

export interface Driver {
  id: ID;
  tenantId: ID;
  vendorId: ID;
  name: string;
  phone: string;
  licenceNo: string;
  licenceClass?: string;
  documents: DriverDocument[];
  languages?: string[];
  assignedVehicleIds?: ID[];
  shift?: DriverShift;
  rating?: number;
  available: boolean;
  active: boolean;
}

export interface VehicleDocument {
  kind: "REGISTRATION" | "PERMIT_NATIONAL" | "PERMIT_STATE" | "FITNESS" | "PUC" | "INSURANCE";
  number?: string;
  expiry?: string;
  fileName?: string;
}

export interface Vehicle {
  id: ID;
  tenantId: ID;
  ownerVendorId: ID;
  ownership: VehicleOwnership;
  vehicleTypeId: ID;
  make: string;
  model: string;
  year?: number;
  registrationNo: string;
  seatingCapacity: number;
  ac: boolean;
  fuelType: FuelType;
  traccarDeviceId?: string;
  documents: VehicleDocument[];
  active: boolean;
}

export interface Vendor {
  id: ID;
  tenantId: ID;
  name: string;
  type: "SELF" | "SUB_VENDOR";
  gstin?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  active: boolean;
  token?: string;
}

export interface Tenant {
  id: ID;
  name: string;
  legalName: string;
  baseCity: string;
  contractCurrency: string;
}

export interface Customer {
  id: ID;
  tenantId: ID;
  name: string;
  code: string;
  billingCycle?: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  spocName?: string;
  phone?: string;
  email?: string;
  approvedVehicleTypeIds?: ID[];
  defaultCostCenter?: string;
  active: boolean;
  createdAt?: string;
}

export interface VehicleTypeConfig {
  id: ID;
  tenantId: ID;
  name: string;
  seatingCapacity: number;
  ac: boolean;
  class?: string;
  active: boolean;
}

// === Vendor Portal Specific Types ===

export interface VendorDeclineEntry {
  vendorId: string;
  reason: string;
  declinedAt: string;
}

export interface VendorEarnings {
  earningId: string;
  tripId: string;
  vendorId: string;
  driverId?: string;
  fare: number;
  operatorFee: number;
  netToVendor: number;
  completedAt: string;
  status: 'UNBILLED' | 'STATEMENTED' | 'RECONCILED';
}

export interface PayoutEntry {
  id: string;
  vendorId: string;
  payoutDate: string;
  periodStart: string;
  periodEnd: string;
  tripsIncluded: number;
  amount: number;
  status: 'PAID' | 'PENDING';
}

export interface VendorAlert {
  id: string;
  vendorId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'critical';
  type: 'DOC_EXPIRY' | 'VEHICLE_BREAKDOWN' | 'DRIVER_OFFLINE' | 'TRIP_ISSUE' | 'SOS_RAISED' | 'OTP_BLOCKED';
  message: string;
  entityId?: string;
  entityType?: 'driver' | 'vehicle';
  tenantId?: string;
  tripId?: string;
  daysRemaining?: number;
  read: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  vendorId: string;
  type: 'TRIP_ASSIGNED' | 'TRIP_ACCEPTED' | 'TRIP_COMPLETED' | 'VEHICLE_BREAKDOWN' | 'DOC_EXPIRY' | 'DRIVER_OFFLINE' | 'FAILOVER' | 'DRIVER_ARRIVED';
  title: string;
  message: string;
  tripId?: string;
  read: boolean;
  createdAt: string;
}

export interface EventLogEntry {
  id: string;
  type: 'TRIP_ASSIGNED' | 'TRIP_ACCEPTED' | 'TRIP_COMPLETED' | 'DRIVER_EN_ROUTE' | 'VENDOR_DECLINED' | 'FAILOVER' | 'NO_VENDOR_AVAILABLE';
  tripId?: string;
  vendorId?: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  action: 'ACCEPT' | 'REJECT' | 'SYSTEM_FAILOVER';
  tripId: string;
  vendorId: string;
  reason?: string;
  actor: string;
  timestamp: string;
}

export interface VendorInfo {
  vendorId: string;
  name: string;
  token: string;
  active: boolean;
}

export interface VendorSession {
  vendorId: string;
  vendorName: string;
  token: string;
  loginAt: string;
}
