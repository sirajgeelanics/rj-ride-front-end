# Phase 2 — Pricing, Rate Engine & Quotes

**Depends on:** Phase 1. **Produces:** pre-negotiated rate cards (4 bases, effective-dated, versioned) + the **quote** engine that issues `price_id` offers. This phase implements **anchoring pattern #1**.

---

Extend the RIDE prototype. Build the **Pricing & Quotes** module under `/pricing`, surfacing the decoupled **Rate Engine** (here: a Zustand store + a "engine: linked/cached" chip — no real service).

Build:
1. **Rate Cards** list (`stores/rateCardStore.ts`) filterable by vendor, customer, vehicle type, basis. Columns: basis, key price, validity window, version. These are **pre-negotiated** per vendor × customer × vehicle type.
2. A create/edit **Drawer** that adapts to `basis`:
   - **PER_KM** → `perKm` + modifiers.
   - **FIXED_LOCATION_PAIR** → editable `{fromZone,toZone,price}` rows.
   - **HOURLY** → `hourlyRate` + modifiers.
   - **PACKAGE** → `{hours, km, price, extraPerHour, extraPerKm}` (e.g. 8h/80km).
   - **Modifiers** (all bases): minFare, nightCharge, waitingPerHour, toll & parking (included/extra), interStateSurcharge, deadMileagePerKm.
3. **Effective dating + versioning:** editing a rate **creates a new version** (`version+1`, new `validFrom`) and **retains history** — never overwrite. Per (vendor, customer, vehicleType) **version-history timeline** view.
4. **Quote engine** (`stores/quoteStore.ts`, `lib/quote.ts`) — the core of this phase:
   - `getOffers(input)` resolves the applicable rate-card **version for the given date** and returns one or more **`Offer`** objects, each with a fresh **`priceId`**, the `rateCardVersion`, computed `price`, `currency`, `freeCancellationHours`, `minLeadTimeHours`, optional `blackoutDates`, `includedServices`, `quotedAt`, and a short **`expiresAt`** (e.g. +15 min).
   - Offers are stored so Phase 3 can **book against a `priceId`** and Phase 6 can bill from the **locked** price.
   - Apply **location-type pricing eligibility**: exact-address points price normally; imprecise points return a "from" price flag.
5. **Quote Simulator** page: pick vendor + customer + vehicle type + (distance | hours | zone pair) + date → call `getOffers`, render the offer(s) with price, **version used**, `priceId`, and validity countdown — **without** creating a trip.
6. **"Engine: Linked ⟷ Cached"** chip in the header (flips a label + "last synced"). Add a visible note: *because price is locked at quote time (Phase 3), cache/engine divergence does not affect booked orders* — this is the resolved design decision.

**Acceptance criteria**
- All four bases creatable with basis-specific fields + modifiers.
- Editing produces a new version; old versions remain in history.
- `getOffers` returns `Offer`s with a `priceId`, the resolved `version`, price, and an expiry; the Simulator shows them and counts down validity.
- Location-type eligibility produces fixed vs "from" pricing correctly.
- The Linked/Cached chip toggles; the price-lock note is present.
