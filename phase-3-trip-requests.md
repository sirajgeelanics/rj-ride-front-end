# Phase 3 — Trip Requests (Convoy + Quote→Book)

**Depends on:** Phases 1–2. **Produces:** the convoy trip model, all creation methods, booking against a `price_id`, location typing, coordinator/viewers, reverse scheduling.

---

Extend the RIDE prototype. Build the **Trip Requests** module under `/trips` (`stores/tripStore.ts`). Implement the **convoy model** from `CLAUDE.md`: one **shared ordered stop sequence**; 1..n `TripVehicle`s; **every vehicle follows the same stops**; each vehicle has a driver (nullable) and **0..n pax assigned to that vehicle** (fields may be blank).

**Trip Requests list:** filter by status, customer, date, creation method; `StatusBadge` for `TripStatus`; expandable row showing vehicles + their `VehicleStatus` + locked price/version if booked.

**Booking rule (anchoring pattern #1):** a vehicle is "booked" only when it carries a **`priceId`** from Phase 2. When building/confirming a trip, call `getOffers`, let the user pick an offer per vehicle (or auto-pick), and **store `priceId`, `lockedPrice`, `lockedRateCardVersion` on the `TripVehicle`**. Confirming without a valid, unexpired `priceId` is blocked (show a clear message + re-quote action).

**Location typing:** when adding stops, classify each via the Phase 1 helper and enforce conditional fields (AIRPORT ⇒ flightNumber required + optional terminal; RAIL ⇒ trainNumber). Use a simple lat/lng input or click-on-mini-map.

**Reverse scheduling:** if the **destination** is AIRPORT/RAIL and a flight/train time is entered, compute and suggest a **recommended dispatch time** (travel time + check-in buffer) the user can accept.

Implement **all creation methods** behind one "New Trip Request" action with tabs:
1. **Manual** — customer, schedule (one-off datetime **or recurring** rule), build the **stop sequence** (add/reorder PICKUP/DROP/WAYPOINT with address + lat/lng + type-conditional fields), then **add vehicles** (choose requested vehicle type; **types may be mixed** e.g. 2 Sedan + 1 Coach), get offers + lock price per vehicle, optionally pre-assign vehicle+driver, optionally add pax per vehicle, optionally set **coordinator** + **viewers** + **costCenter/pos**.
2. **Bulk upload** — CSV/Excel drop → mock parser → multiple draft trips with a row-level validation preview before commit.
3. **API — pax-based** (`API_PAX`) — a mock "incoming payload" panel with 2–3 canned samples styled as RISMA/ROMA: pax + "1 vehicle per pax" **or** "1 coach for all" + pickup/drop → create the trip, **map pax to vehicles**, auto-quote each vehicle.
4. **API — vehicle-count** (`API_VEHICLE_COUNT`) — payload of "N vehicles of type X" + stops; honour **`autoAssign`**: on → auto-pick available vehicles+drivers (Phase 1) and auto-quote; off → create **unfilled slots** (still quoted) for the dispatcher (Phase 4).
5. **Recurring generator** — from a recurring rule, generate the next ~7 occurrences as individual trips.
6. **Clone** — duplicate an existing trip.

Pax PII masked with reveal. Show on each trip its `createdVia` and external `reference`.

**Acceptance criteria**
- Convoy enforced: editing stops edits them for all vehicles; UI never lets one vehicle diverge (guides to "new request").
- A trip can mix vehicle types and can have vehicles with empty pax.
- **Confirm is blocked unless every vehicle has a valid, unexpired `priceId`**; locked price + version are stored and shown.
- Location-type conditional fields enforced; reverse-scheduling suggestion appears for airport/rail destinations.
- All six creation paths produce valid `TripRequest`s with correct `createdVia`; `API_VEHICLE_COUNT` respects `autoAssign`.
- Coordinator, viewers, costCenter/pos captured where provided.
