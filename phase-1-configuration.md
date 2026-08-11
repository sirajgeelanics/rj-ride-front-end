# Phase 1 — Configuration Domain

**Depends on:** Phase 0. **Produces:** Vendors, Customers, Vehicle Types, Vehicles (+docs), Drivers (+docs), Add-on services, Location typing.

---

Extend the RIDE prototype. Build the **Configuration** module under `/configuration` with sub-tabs: **Vendors, Customers, Vehicle Types, Vehicles, Drivers, Add-on Services**. All data is tenant-scoped, lives in Zustand stores seeded with realistic Indian-operator mock data (`CLAUDE.md`). Each entity: a `DataTable` list (search + filter + status badge), a right **Drawer** for create/edit using the `lib/types` interfaces, soft activate/deactivate, and the `PII` reveal for all PII fields.

Specifics:
- **Vendors** (`stores/vendorStore.ts`): one `SELF` (the operator) + several `SUB_VENDOR`. Vehicles may be owned by SELF or a sub-vendor.
- **Customers** (`stores/customerStore.ts`): incl. one airline-type; show `code`, billing cycle, SPOC, approved vehicle types, `defaultCostCenter`. Note in the UI that customers consume RIDE via API and have no login.
- **Vehicle Types** (`stores/vehicleTypeStore.ts`): Sedan/SUV/Tempo Traveller/Coach with seating + AC.
- **Vehicles** (`stores/vehicleStore.ts`): full `Vehicle` type incl. `ownership`, `ownerVendorId`, registration, fuel, `traccarDeviceId`, and a **documents** sub-section (Registration, National/State Permit, Fitness, PUC, Insurance) each with number + **expiry**; an **"expiring soon"** indicator (≤30 days → amber, expired → red). File upload may be a mock filename picker.
- **Drivers** (`stores/driverStore.ts`): full `Driver` type incl. licence + PSV badge + police verification + medical + induction (number + expiry), languages, assigned vehicle(s) (multi-select), shift, rating, availability toggle, same expiry indicators.
- **Add-on Services** (`stores/addonStore.ts`): the `AddonService` reference — categories MEET_GREET / CHILD_SEAT / TOLL_ROAD and types TABLE / SEAT / BOOSTER / TOLL, with `defaultInclude`. Enforce **max one of each type** per future trip (validation helper now).
- **Location typing helper** (`lib/location.ts`): given a point, classify `LocationType` and expose which fields become required (AIRPORT ⇒ flightNumber + optional terminal; RAIL ⇒ trainNumber; HOTEL via lodging tag). Used by Phase 3.

Add a **Configuration health** strip per list showing counts of expiring/expired documents.

**Acceptance criteria**
- Create/edit/deactivate every entity; changes persist and are tenant-scoped (switching operator shows different data).
- Vehicle & Driver document expiries drive amber/red indicators.
- Assigning vehicles to a driver reflects on both sides.
- Add-on "one of each type" validation helper works; location-typing helper returns correct required-field sets.
- PII masked by default everywhere.
