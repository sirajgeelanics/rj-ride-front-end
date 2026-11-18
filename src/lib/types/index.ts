export type ID = string;

// Enums and literal types
export type CreationMethod = "MANUAL" | "BULK_UPLOAD" | "API_PAX" | "API_VEHICLE_COUNT" | "RECURRING" | "CLONE" | "ROSTER" | "POOLING";

// ── Phase 8: Roster & Route Planning Types ──
export type Gender = "MALE" | "FEMALE" | "OTHER";

// ── FR-BL-6/7: Billing Enhancement Types ──
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AED";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  exchangeRate: number;       // 1 baseCurrency = X this currency
}

// ── FR-ER-3/4: Escalation & Emergency Types ──
export type AnomalyType = "ROUTE_DEVIATION" | "PROLONGED_STOP" | "NO_SHOW";

export interface BillingEvent {
  id: ID;
  billingLineId: ID;
  type: "CREATED" | "STATEMENTED" | "RECONCILED" | "ADJUSTED" | "CORRECTED" | "VOIDED";
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  delta?: number;             // Amount changed
  reason: string;
  actor: string;
  createdAt: string;
}
export type SafetyFlag = "LONE_FEMALE" | "NIGHT_SHIFT" | "SPECIAL_NEEDS" | "SENSITIVE";
export type RosterSource = "MANUAL_UPLOAD" | "API_PUSH" | "HRMS_SYNC";
export type PoolingStatus = "DRAFT" | "PLANNED" | "APPROVED" | "ACTIVE" | "REPLANNED";

export interface Employee {
  id: ID;
  tenantId: ID;
  employeeId: string;       // Company employee ID
  name: string;
  phone: string;
  email?: string;
  gender: Gender;
  homeLat: number;
  homeLng: number;
  homeAddress: string;
  officeLat: number;
  officeLng: number;
  officeAddress: string;
  officeZone?: string;       // e.g. "ZONE_A", "ZONE_B"
  shift: DriverShift;
  safetyFlags: SafetyFlag[];
  active: boolean;
}

export interface RosterEntry {
  id: ID;
  tenantId: ID;
  employeeId: ID;
  date: string;              // YYYY-MM-DD
  startTime: string;         // HH:mm
  endTime: string;           // HH:mm
  source: RosterSource;
  createdAt: string;
  updatedAt: string;
}

export interface RosterChangeLog {
  id: ID;
  rosterEntryId: ID;
  previousValues: Partial<RosterEntry>;
  newValues: Partial<RosterEntry>;
  changedBy: string;
  changedAt: string;
  reason?: string;
}

export interface RosterUpload {
  id: ID;
  tenantId: ID;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  source: RosterSource;
  uploadedAt: string;
  mapping?: Record<string, string>; // CSV column -> field mapping
}

export interface HrmsConnectorConfig {
  id: ID;
  tenantId: ID;
  name: string;
  type: "WORKDAY" | "SAP_SUCCESS_FACTORS" | "BAMBOO_HR" | "CUSTOM_API";
  apiUrl: string;
  apiKey?: string;           // Will be stored as encrypted PI
  syncSchedule: "DAILY" | "WEEKLY" | "MANUAL";
  lastSyncAt?: string;
  mapping: Record<string, string>;
  active: boolean;
}

// ── Pooling Types ──

export interface PoolingConfig {
  id: ID;
  tenantId: ID;
  name: string;
  maxPassengersPerVehicle: number;
  maxDetourPercent: number;  // Max extra distance as percentage of direct route
  maxWaitMinutes: number;    // Max wait time at pickup
  safetyConstraints: SafetyConstraint[];
  vehicleTypeId: ID;         // Vehicle type to use for pooling
  active: boolean;
}

export interface SafetyConstraint {
  type: "NO_LONE_FEMALE_LAST_DROP" | "SAME_GENDER_PREFERRED" | "NIGHT_SHIFT_ESCORT" | "MAX_TRAVEL_TIME" | "NO_OVERNIGHT_ALONE";
  enabled: boolean;
  params?: Record<string, number | string>;
}

export interface PooledTrip {
  id: ID;
  tenantId: ID;
  configId: ID;
  date: string;
  shift: DriverShift;
  officeZone: string;
  status: PoolingStatus;
  stops: Stop[];
  employees: Employee[];
  vehicleTypeId: ID;
  vehicleId?: ID;
  driverId?: ID;
  totalDistance: number;     // km
  estimatedDuration: number; // minutes
  safetyChecksPassed: boolean;
  safetyIssues: string[];
  createdAt: string;
  updatedAt: string;
}
export type TripStatus = "DRAFT" | "CONFIRMED" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "BILLED" | "CANCELLED";
export type VehicleStatus =
  | "PENDING"
  | "ASSIGNED"
  | "DRIVER_ACCEPTED"
  | "DRIVER_REJECTED"
  | "EN_ROUTE_PICKUP"
  | "AT_PICKUP"
  | "PAX_PICKED"
  | "IN_TRANSIT"
  | "AT_DROP"
  | "PAX_DROPPED"
  | "COMPLETED"
  | "NO_SHOW"
  | "BREAKDOWN"
  | "ACCIDENT"
  | "VEHICLE_SWAP"
  | "DELAYED"
  | "SOS"
  | "CANCELLED";

export type StopType = "PICKUP" | "DROP" | "WAYPOINT";
export type LocationType = "AIRPORT" | "RAIL" | "HOTEL" | "CITY" | "ADDRESS";
export type RateBasis = "PER_KM" | "FIXED_LOCATION_PAIR" | "HOURLY" | "PACKAGE";

export type VehicleDocumentKind = "REGISTRATION" | "PERMIT_NATIONAL" | "PERMIT_STATE" | "FITNESS" | "PUC" | "INSURANCE";
export type DriverDocumentKind = "LICENCE" | "PSV_BADGE" | "POLICE_VERIFICATION" | "MEDICAL" | "INDUCTION";
export type DriverShift = "DAY" | "NIGHT" | "FLEX";
export type VehicleOwnership = "OWN" | "LEASED" | "SUB_VENDOR";
export type VehicleType = "SEDAN" | "SUV" | "TEMPO_TRAVELLER" | "COACH";
export type FuelType = "PETROL" | "DIESEL" | "CNG" | "EV";

export type AddonCategory = "MEET_GREET" | "CHILD_SEAT" | "TOLL_ROAD";
export type AddonType = "TABLE" | "SEAT" | "BOOSTER" | "TOLL";

export type BillingCycle = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
export type RecurrenceFreq = "DAILY" | "WEEKLY";
export type ScheduleType = "ONE_OFF" | "RECURRING";
export type TollHandling = "INCLUDED" | "EXTRA";
export type ParkingHandling = "INCLUDED" | "EXTRA";

// Configuration entities
export interface OTPConfig {
  enabled: boolean;
  defaultCode?: string;
}

export interface Tenant {
  id: ID;
  name: string;
  legalName: string;
  baseCity: string;
  contractCurrency: string;
  otpConfig?: OTPConfig;
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
}

export interface Customer {
  id: ID;
  tenantId: ID;
  name: string;
  code: string;
  billingCycle?: BillingCycle;
  spocName?: string;
  phone?: string;
  email?: string;
  approvedVehicleTypeIds?: ID[];
  defaultCostCenter?: string;
  active: boolean;
  otpConfig?: OTPConfig;
  apiOnly?: boolean;
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

export interface VehicleDocument {
  kind: VehicleDocumentKind;
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

export interface DriverDocument {
  kind: DriverDocumentKind;
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

// Add-on services
export interface AddonService {
  id: ID;
  tenantId: ID;
  category: AddonCategory;
  type: AddonType;
  name: string;
  defaultInclude: boolean;
  price?: number;
}

// Rate engine and quotes
export interface RateModifiers {
  minFare?: number;
  nightCharge?: number;
  waitingPerHour?: number;
  tollHandling?: TollHandling;
  parkingHandling?: ParkingHandling;
  interStateSurcharge?: number;
  deadMileagePerKm?: number;
}

export interface FixedPair {
  fromZone: string;
  toZone: string;
  price: number;
}

export interface PackageRate {
  hours: number;
  km: number;
  price: number;
  extraPerHour?: number;
  extraPerKm?: number;
}

export interface RateCard {
  id: ID;
  tenantId: ID;
  vendorId: ID;
  customerId: ID;
  vehicleTypeId: ID;
  basis: RateBasis;
  perKm?: number;
  fixedPairs?: FixedPair[];
  hourlyRate?: number;
  package?: PackageRate;
  modifiers?: RateModifiers;
  validFrom: string;
  validTo?: string;
  version: number;
}

export interface Offer {
  priceId: ID;
  tenantId: ID;
  rateCardId: ID;
  rateCardVersion: number;
  customerId: ID;
  vehicleTypeId: ID;
  basis: RateBasis;
  price: number;
  currency: string;
  freeCancellationHours: number;
  minLeadTimeHours: number;
  blackoutDates?: string[];
  includedServices?: string[];
  quotedAt: string;
  expiresAt: string;
}

// Trips
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

export interface OTPAttemptLog {
  attemptedAt: string;
  enteredOtp: string;
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
  otpFailedAttempts?: OTPAttemptLog[];
  breakdownReason?: string;
  addonServiceIds?: ID[];
}

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  time: string;
}

export type Schedule =
  | { type: "ONE_OFF"; when?: string }
  | { type: "RECURRING"; rule: RecurrenceRule };

export interface Coordinator {
  name?: string;
  phone?: string;
}

// ── FR-ER-3/4: Escalation & Emergency Types ──
export type EscalationLevel = "DRIVER" | "DISPATCHER" | "SPOC" | "AUTHORITIES";

export interface EscalationStep {
  level: EscalationLevel;
  label: string;
  contact?: string;           // Phone/email of the contact
  timeoutMinutes: number;     // Auto-escalate after N minutes
  actions: string[];          // What to do at this level
}

export interface EscalationTree {
  id: ID;
  tenantId: ID;
  name: string;
  steps: EscalationStep[];
  active: boolean;
}

export interface EmergencyTimelineEntry {
  id: ID;
  emergencyId: ID;           // Links to an anomaly/SOS event
  level: EscalationLevel;
  action: string;
  actionedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface EmergencyEvent {
  id: ID;
  tenantId: ID;
  tripId: ID;
  vehicleIndex: number;
  type: "SOS" | "ANOMALY";
  anomalyType?: AnomalyType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  status: "OPEN" | "ESCALATING" | "RESOLVED";
  currentLevel: EscalationLevel;
  timeline: EmergencyTimelineEntry[];
  resolvedAt?: string;
  createdAt: string;
}

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
  coordinator?: Coordinator;
  viewers?: string[];
  costCenter?: string;
  pos?: string;
  createdAt: string;
}
