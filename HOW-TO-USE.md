# HOW TO USE — RIDE Phased Prompts (Claude Code)

This pack builds the **RIDE** clickable prototype (vendor/operator edition) one phase at a time in **Claude Code**. Each phase is a separate, self-contained prompt. You run them in order; each builds on the last.

## What's in the pack
| File | Purpose |
|---|---|
| `CLAUDE.md` | **Persistent context.** The authoritative domain model, conventions, and the two anchoring patterns. Goes at the repo root; Claude Code reads it automatically every run. |
| `phase-0-foundation.md` | App shell, UI kit, tenant switcher, types |
| `phase-1-configuration.md` | Vendors, customers, vehicle types, vehicles, drivers, add-ons, location typing |
| `phase-2-pricing-rate-engine.md` | Pre-negotiated rate cards + the **quote** engine (`price_id` offers) |
| `phase-3-trip-requests.md` | Convoy trips, all creation methods, **book against `price_id`**, reverse scheduling |
| `phase-4-lifecycle-dispatch.md` | Two-level state machine, dispatch, **pre-flight checks**, computed cancellation, vehicle swap |
| `phase-5-tracking-driver-app.md` | Mock Traccar on OSM + single driver app (OTP, SOS) |
| `phase-6-billing.md` | Deterministic costing from frozen quote, operator fee, reconciliation, vouchers |
| `phase-7-partner-api.md` | Quote→book→confirm playground, typed errors, webhook retry, comms bridge, integration map |

## Step-by-step

### Step 1 — Set up the repo
```bash
mkdir ride-prototype && cd ride-prototype
git init
```
Copy `CLAUDE.md` from this pack into the repo root. (Open it once and skim it — it's the contract every phase relies on.)

### Step 2 — Start Claude Code in the repo
```bash
claude
```
Claude Code automatically picks up `CLAUDE.md` on each run, so you don't paste it into prompts.

### Step 3 — Run Phase 0
Open `phase-0-foundation.md`, copy **everything below the `---` line**, paste it into Claude Code as one message, and let it build. Then:
```bash
npm install
npm run dev
```
Open the app and walk the **Acceptance criteria** listed at the bottom of the phase file. Don't move on until they pass.

### Step 4 — Commit, then run the next phase
```bash
git add -A && git commit -m "Phase 0: foundation"
```
Repeat Step 3 for `phase-1` … `phase-7`, **in order**, committing after each (ideally one branch per phase). Each phase's prompt assumes the previous phases exist.

### Step 5 — If a phase is too big for one pass
Tell Claude Code: *"implement this phase in sub-steps; pause after each sub-step for me to review."* Phases **3** and **4** are the heaviest and split well. Do **not** advance to the next phase until the current phase's acceptance criteria pass.

## Rules that keep the phases coherent
1. **`CLAUDE.md` is the source of truth for types.** If Claude Code proposes a type change, update `CLAUDE.md` too — the types are the contract between phases.
2. **Keep mock randomness seedable** so demos are repeatable.
3. **Honour the two anchoring patterns** (they're the whole point of this design):
   - **Quote → book → confirm with price-lock:** orders are created **only** against a `price_id`; the price is frozen on the trip vehicle at booking; billing reads the locked price (never re-resolves). This is why there are no rate-reconciliation disputes.
   - **Pre-flight checks before state changes:** `checkTime` before book, `checkCancel` before cancel, `checkUpdate` before edit — verdict shown before the action.
4. **No real backend, no real payments, no Google Maps** — Zustand mocks, OSM tiles only.
5. **PII is masked by default, revealed on tap** — everywhere.

## What to validate at the end (internal review checklist)
- A trip can be **quoted, booked against a `price_id`, dispatched, tracked, completed, and billed** end to end, with the **billed amount equal to the locked quote**.
- A **convoy** trip with mixed vehicle types behaves correctly; one vehicle can't diverge its stops.
- **Cancellation** before the computed deadline is free; after it, the configured penalty applies — and `checkCancel` predicts this before you act.
- **Vehicle swap** preserves trip-vehicle id, history, locked price, OTP, and tracking.
- **API_PAX / API_VEHICLE_COUNT** sample payloads (styled as RISMA/ROMA/CLASS) create correct trips; `autoAssign` on/off behaves.
- **OTP gates** block pickup/drop until verified; the OTP originates in the comms panel and is consumed by the driver app.
- **Tenant isolation:** switching operator shows different data throughout.

## How this maps to the BRD (v0.3)
- Phase 1 ⇒ BRD §7 (Configuration). Phase 2 ⇒ §6 (Rate Engine, Pricing & Quotes). Phase 3 ⇒ §9 (Trip model) + §6.1 (quote→book). Phase 4 ⇒ §10 (Lifecycle, Dispatch, Pre-flight, Cancellation). Phase 5 ⇒ §11 (Tracking/OTP/Swap) + §13 (Driver App). Phase 6 ⇒ §14 (Billing). Phase 7 ⇒ §15 (Partner API).
- The prototype is the **validation vehicle** for the BRD; where they disagree, fix one and note it in the other.

## Still-open product decisions (carry as visible TODOs in the UI)
- Operator-fee rules per buyer (flat / % / tiered).
- Driver accept-timeout default value.
- Named HRMS connectors; WhatsApp BSP; OSM routing engine choice (OSRM / Valhalla / GraphHopper). *(Roster ingestion and ride-sharing — BRD §8 — are intentionally not in the prototype phases; add them as Phase 8 later if you want them in the demo.)*

## Moving toward the production build
This prototype is throwaway UI for validation. For production, reuse the **domain model (`CLAUDE.md`) and the validated flows**, not the mock code, on your standard stack: Django/FastAPI services, React/Next.js web, Flutter driver & passenger apps, PostgreSQL, AWS ap-south-1, real Traccar, an OSM routing engine, Mattermost + WhatsApp BSP, and the partner API as a versioned, documented service.
