# Phase 0 — Foundation & App Shell

**Depends on:** nothing. **Produces:** the skeleton every later phase plugs into.
**How to run:** ensure `CLAUDE.md` is at the repo root, then paste everything below the line into Claude Code.

---

You are building the **RIDE** prototype described in `CLAUDE.md`. In this first phase build **only the foundation** — no domain features beyond proving the shell.

Build:
1. A Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind project. Add `zustand`, `lucide-react`, `recharts`, and a Leaflet/MapLibre + OSM tiles dependency (used later).
2. **App shell:** persistent left **sidebar** with nav items — Dashboard, Configuration, Pricing & Quotes, Trip Requests, Dispatch, Tracking, Driver App, Billing, API Console (later phases fill these; for now empty "Coming soon" pages are fine). Top bar with a **tenant (operator) switcher**, a mock signed-in user, and a global search placeholder.
3. **Tenant store** (`stores/tenantStore.ts`) seeded with 3 operators (incl. `contractCurrency`); switching sets a global `activeTenantId` all later stores read.
4. **UI kit** in `components/ui/`: `Card`, `DataTable` (sortable, paginated, empty state), `Drawer` (right slide-over), `Modal`, `Tabs`, `Badge` + `StatusBadge` (a colour map covering **all** `TripStatus` and `VehicleStatus` values now), `Toast`/toaster, `Button`, `Input`, `Select`, `FormField`, and a **`PII`** component (masks its value, reveals on click via an eye icon).
5. Put the full domain types from `CLAUDE.md` into `lib/types/index.ts`.
6. **Dashboard** landing page with placeholder KPI cards (Active Trips, Vehicles, Drivers, Today's Pickups → 0/empty for now) and a "prototype — mocked data" banner.
7. `lib/mock/` with an `id()` helper and a home for seed data.
8. A `/kitchen-sink` page demoing every UI-kit component, including the `StatusBadge` colour map and `PII` reveal.

Design per `CLAUDE.md`: dense control-room aesthetic, slate/zinc, one accent, status colours.

**Acceptance criteria**
- App runs; sidebar + top bar render; all nav items present (later ones route to "Coming soon").
- Tenant switcher changes `activeTenantId` (show it in a debug chip).
- `DataTable`, `Drawer`, `Modal`, `StatusBadge`, and `PII` (mask → click to reveal) all demoable on `/kitchen-sink`.
- Strict TS passes; no `any` in shared types.
