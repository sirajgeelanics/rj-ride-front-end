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
 *
 * Cross-origin deployments (e.g. staging at ravani.fl8.in calling api-ravani.fl8.in directly):
 * set VITE_API_ORIGIN=https://api-ravani.fl8.in. When set, apiUrl() returns an absolute URL to
 * the API origin and the basePath prefix is omitted — there is no proxy to route through.
 */
// Use import.meta.env so Vite statically replaces this at build time — process.env.* is a
// runtime lookup that depends on envShim.ts having run first, which the bundler doesn't guarantee.
export const BASE_PATH = (import.meta.env.NEXT_PUBLIC_BASE_PATH as string | undefined) ?? "";

// VITE_API_ORIGIN: cross-origin API server origin. Leave empty/unset for same-origin production
// where /vendor/api/* is proxied by the Cloudflare Worker. Example: https://api-ravani.fl8.in
const _apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/$/, "");

// Full base URL for createClient: cross-origin uses the explicit origin; same-origin uses the
// basePath-prefixed proxy path (e.g. /vendor/api → Worker → Django).
export const apiBaseUrl: string = _apiOrigin ? `${_apiOrigin}/api` : `${BASE_PATH}/api`;

/**
 * Resolve a root-relative API path to the correct URL for fetch.
 * - Cross-origin: prepends the API origin (https://api-ravani.fl8.in/api/v1/...)
 * - Same-origin: prepends the basePath (/vendor/api/v1/...)
 * - Absolute URLs pass through unchanged.
 */
export function apiUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  if (_apiOrigin) return `${_apiOrigin}${path}`;
  return `${BASE_PATH}${path}`;
}
