# Phase 7 — Partner API Console & Integration

**Depends on:** Phases 2–6. **Produces:** the tangible API-first surface — quote→book→confirm, pre-flight checks, typed errors, webhook retry, comms bridge, integration map. All mocked client-side (no real server).

---

Extend the RIDE prototype. Build an **API Console** under `/api-console` demonstrating the partner integration surface that RISMA/ROMA/CLASS and airline customers integrate against. This phase makes the **maturity bar** concrete.

Build:
1. **Quote → Book → Confirm playground** (the headline): a stepper that calls the *real* prototype logic end to end —
   - **Quote:** request offers (Phase 2) → show offer JSON incl. `priceId`, `rateCardVersion`, price, `freeCancellationHours`, `expiresAt`.
   - **Check time:** call `checkTime` (Phase 4) → show verdict.
   - **Create order:** create the trip citing the chosen **`priceId`** (Phase 3) → show the order JSON the operator returns (incl. vehicle + driver details and pax, possibly blank to be filled by the caller).
   - **Confirm:** mock confirmation → status flips; emit a webhook (below).
   - Provide **canned sample payloads** styled as RISMA, ROMA, and CLASS for `API_PAX` and `API_VEHICLE_COUNT`.
2. **Pre-flight check endpoints** surfaced as callable cards: `check-time`, `check-cancel`, `check-update` — each rendering request + typed response.
3. **Typed error taxonomy:** a consistent envelope `{ result, error: { name, message, code, status } }`, segmented (general / order / request / pricing / search / voucher). Add a control to **force example errors** (e.g. expired `priceId`, capacity < pax, missing flight number) and show the envelope.
4. **Outbound read APIs (customer-facing, no UI login):** an explorer where a "customer" fetches trip status / vehicle + driver / live position by `reference` → render the JSON the operator exposes.
5. **Webhooks log with retry contract:** emit mock webhook events on lifecycle transitions (created, quoted, assigned, driver_accepted, pax_picked, vehicle_swap, completed, billed, cancelled, sos). Show payloads streaming, and **simulate the retry contract (10 attempts, 2-min intervals)** on a forced delivery failure (compressed time for the demo).
6. **Token panel:** show JWT Bearer + refresh, 7-day lifetime, and the "retry auth max 3 times on invalid token" rule (illustrative).
7. **Comms bridge (illustrative):** a panel showing **Mattermost (operator ops)** vs **WhatsApp (pax)** messages on assignment/swap/OTP/SOS — and **this is where the pax "receives" their OTP** (SMS/WhatsApp/email mocked), which the Phase 5 driver app consumes.
8. **Integration map:** a one-screen static SVG — RISMA/ROMA/CLASS + external airline APIs → RIDE (quote→book→confirm inbound), RIDE → customers/webhooks (outbound), with Traccar + OSM + Mattermost/WhatsApp on the sides.
9. **Sandbox note:** a short panel listing "cannot be tested in sandbox" items (card payment, voucher delivery, SMS/email) and that production access is gated on acceptance testing.

**Acceptance criteria**
- The Quote→Book→Confirm stepper runs end to end using real prototype logic; the order is created **only** against a valid `priceId`; an expired `priceId` produces a typed error.
- `check-time` / `check-cancel` / `check-update` return typed responses; forced errors render the standard envelope.
- Read APIs return trip status / vehicle / driver / position JSON by reference.
- Webhook log streams events and demonstrates the retry contract on a forced failure.
- Comms panel shows Mattermost vs WhatsApp and is the source of the pax OTP used by the driver app.
- The integration map screen renders.

---

## You're done
After Phase 7 passes its acceptance criteria, the clickable prototype demonstrates the full RIDE flow end to end for internal validation. See `HOW-TO-USE.md` for what to do next (review checklist, mapping to the BRD, and moving toward the production build).
