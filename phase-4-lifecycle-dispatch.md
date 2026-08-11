# Phase 4 — Lifecycle, Dispatch & Pre-flight Checks

**Depends on:** Phase 3. **Produces:** the two-level state machine, dispatch board, assignment, driver accept/reject, pre-flight checks, computed cancellation, exceptions, vehicle swap. Implements **anchoring pattern #2**.

---

Extend the RIDE prototype. Build the **Dispatch** module under `/dispatch` and the **lifecycle engine** over trip data.

**Two-level state machine** (`lib/lifecycle.ts`) per `CLAUDE.md`:
- **Per-vehicle** transitions with an explicit **allowed-transition map**; block illegal transitions.
- **Trip status is derived** (rolled up) from vehicle statuses — not set manually (except `CONFIRMED`, `CANCELLED`).

Build:
1. **Dispatch board:** kanban lanes by `VehicleStatus` (or a dense table) showing **per-vehicle** cards across all active trips, each with trip context (customer, stops, schedule, locked price).
2. **Assignment:** fill unfilled slots — assign an available `Vehicle` + `Driver` (respect vehicle type, availability, **no double-booking**). Manual reassign/override. **Auto-assign** action for slots flagged `autoAssign`.
3. **Driver accept/reject simulation** (real app is Phase 5): per-vehicle control to simulate the response. On **reject or accept-timeout**, apply a **configurable policy** — a tenant setting offering *auto-reassign to next available* / *return to dispatcher queue* / *escalate* — plus a configurable **accept-timeout** (default TODO). Show it taking effect.
4. **Pre-flight checks** (`lib/preflight.ts`) — the pattern that mirrors the partner API:
   - `checkTime(priceId, pickupTime)` → `{ allowBooking, reasons }` before confirming.
   - `checkCancel(tripVehicle)` → `{ allowed, free, penaltyPct, resultingStatus }` using **deadline = pickupTime − offer.freeCancellationHours**.
   - `checkUpdate(trip)` → `{ allowed, message }` before editing.
   - Each check renders its verdict **before** the action button enables.
5. **Cancellation:** wire `checkCancel`; cancelling before the deadline is free, after it applies the **configurable penalty**; reflect resulting status (`CANCELLED`, and whether penalised). Record on the activity log.
6. **Manual status advance** per vehicle following the legal map, with **OTP gates** as no-ops here (real OTP in Phase 5): `PAX_PICKED` requires `otp.pickupVerified`, `PAX_DROPPED` requires `otp.dropVerified`.
7. **Exceptions:** raise `BREAKDOWN/ACCIDENT/SOS/DELAYED/NO_SHOW` on a vehicle → surface as a **trip alert** + an **Alerts** panel, without auto-failing sibling vehicles in the convoy.
8. **Vehicle swap:** on breakdown/emergency, swap to a replacement vehicle **keeping the same `TripVehicle` id + history + `priceId`/locked price**, carrying over **OTP + tracking continuity**, and **auto-notifying** (toast) pax + dispatcher; record swap reason + timestamp.
9. **Per-vehicle activity timeline** (status changes, swaps, exceptions, check results, with timestamps).

**Acceptance criteria**
- Illegal transitions blocked; trip status correctly derives from vehicle statuses.
- Unfilled slots fill manually and via auto-assign; no double-booking.
- Reject/timeout applies the selected configurable policy.
- `checkTime` / `checkCancel` / `checkUpdate` render a verdict before their action; cancellation respects the **computed deadline** and applies the penalty after it.
- Vehicle swap preserves id + history + locked price and carries OTP/tracking; notification fires.
- Exceptions show as trip alerts without failing sibling vehicles.
