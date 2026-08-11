# Phase 5 — Tracking & Driver App

**Depends on:** Phase 4. **Produces:** mock Traccar live tracking on OSM + the single embedded driver app (tracking + workflow + OTP + SOS).

---

Extend the RIDE prototype. Build the **Tracking** module under `/tracking` and a **Driver App** simulator under `/driver` (the **single** app — tracking embedded, per `CLAUDE.md`).

**Tracking:**
1. **Live map** with **OpenStreetMap** tiles (Leaflet or MapLibre — no Google). Plot active vehicles from a **mock Traccar feed** (`lib/mock/traccar.ts`) keyed by `traccarDeviceId`: a generator moving vehicles along their convoy stop sequence over time (interpolation on an interval).
2. Markers coloured by `VehicleStatus`; click → side panel with trip context, driver, pax (PII masked), status, **ETA to next stop** (remaining distance × mock speed).
3. **Trip-focused view:** select a trip → all its convoy vehicles on the map together.
4. A **"Traccar: self-hosted (mock)"** chip to convey the integration source.

**Driver App simulator** (mobile-framed, one driver at a time, pick which driver you simulate):
1. **Inbox:** assigned trips; **Accept / Reject** (feeds Phase 4's policy + timeout).
2. **Active trip:** the convoy stop list; large **status-advance** button following the legal transition map.
3. **OTP:** at PICKUP and/or DROP **if enabled** for that trip/customer (config), the driver enters the **OTP shared by the pax**; verifying flips the gate Phase 4 requires (`otp.pickupVerified` / `otp.dropVerified`). The pax OTP originates in Phase 7's comms panel — for now provide a way to view it for the demo.
4. **Location:** a "sharing location" toggle that drives this driver's position in the mock Traccar feed.
5. **SOS** button → raises the SOS exception (Phase 4) + an alert.

**Acceptance criteria**
- Vehicles animate along routes on an OSM map; markers reflect status; ETA shows and updates.
- Driver simulator can accept/reject, advance status, and **OTP gates block PAX_PICKED/PAX_DROPPED until verified** when OTP is enabled.
- "Sharing location" moves the marker on the Tracking map (one feed, one app).
- SOS from the driver app appears as an alert in Dispatch/Tracking.
