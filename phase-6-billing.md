# Phase 6 — Billing & Reconciliation

**Depends on:** Phases 2–5. **Produces:** deterministic costing from the frozen quote, operator fee, sub-vendor invoice reconciliation, customer statements, vouchers, multi-currency.

---

Extend the RIDE prototype. Build the **Billing** module under `/billing` (`stores/billingStore.ts`).

Build:
1. **Trip cost from the frozen quote (anchoring pattern #1):** when a `TripVehicle` reaches `COMPLETED`, bill it from its **locked** `priceId` / `lockedPrice` / `lockedRateCardVersion` (do **not** re-resolve the rate card). Apply modifiers already captured. **Record the locked version** on the billing line. Roll vehicle costs up to a **trip total**. Add a visible note that this is why billing is deterministic.
2. **Billable Trips ledger:** every completed trip with its lines, computed cost, the **operator platform fee** — a tenant setting, **configurable case-to-case**: expose **flat / % / tiered** options (default TODO) — and a status (Unbilled → Statemented → Reconciled).
3. **Sub-vendor invoice reconciliation:** upload a (mock) sub-vendor invoice and **match it line-by-line against system trip records**, flagging mismatches (amount / trip-count / missing). Show matched vs disputed.
4. **Customer usage statements:** per-customer statement for a date range including **cost centre / POS**, trips, costs, fees, with an **export** (CSV/print view).
5. **Vouchers/documents:** generate vouchers per-passenger and whole-trip, multi-language (mock links), echoing the document-generation pattern.
6. **Multi-currency:** statements in the customer's currency with **contract-currency fallback** and a conversion note (INR default; AED/USD/EUR demo).
7. **Immutable billable-event log:** once a line is statemented it's **locked**; corrections go through an **adjustment** entry (with reason), not an edit — show the audit trail.

**Acceptance criteria**
- Completed trips auto-produce cost lines from the **locked** quote, citing the version applied (no re-resolution).
- Operator fee configurable (flat/%/tiered) and reflected in totals.
- Reconciliation flags mismatches between a mock sub-vendor invoice and system records.
- Customer statement (with cost centre/POS) generates and exports for a date range; multi-currency fallback works.
- Vouchers generate per-passenger and whole-trip.
- Statemented lines lock; adjustments are auditable.
