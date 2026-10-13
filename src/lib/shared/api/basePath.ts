/**
 * The portal's Next.js `basePath`, applied to every same-origin API URL.
 *
 * This portal is served under `basePath: "/vendor"`. Next prefixes middleware matchers with the
 * basePath, so the `/api/:path*` proxy only ever matches `/vendor/api/*` — but `fetch("/api/…")`
 * is not basePath-aware, so the browser asks for `/api/…` and Next 404s it.
 *
 * That is why the portal worked at http://host:3000/vendor (ride_prd has no basePath and proxies
 * `/api/*` itself) and failed at http://host:3001. Every same-origin API call must go through
 * `apiUrl()`; `/vendor/api/…` resolves correctly through both entry points.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative API path with the basePath. Absolute URLs pass through unchanged. */
export function apiUrl(path: string): string {
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
