# RIDE Platform Console

Read-only, cross-tenant view of every tenant, its vendors and its trips. Same stack and design
language as the Admin portal (Next.js 15, React 19, Tailwind v4, TanStack Query).

- Dev: `npm run dev` → http://127.0.0.1:3003 (Django on `API_ORIGIN`, default `localhost:8001`).
- Access: a Django **superuser** only. The API (`/api/v1/platform/…`) refuses everyone else; an
  agency admin is shown a "not a platform account" screen.
- Read-only: nothing here writes. Use the Django admin for changes.

Open it on `127.0.0.1:3003` (not `localhost`) if the Admin portal is open on `localhost:3000`:
cookies are shared per host, so two portals on the same host would overwrite each other's session.
