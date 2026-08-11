import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/vendor",
  // The API client hits trailing-slash URLs (/api/v1/.../). Without this, Next 308-redirects
  // them to the slashless form before the rewrite runs, breaking the proxied API calls.
  skipTrailingSlashRedirect: true,
  // Accessed over the LAN IP (e.g. http://192.168.1.39:3001) rather than localhost,
  // so Next's dev server treats its own _next/HMR resources as cross-origin and blocks
  // them, which prevents the client bundle from hydrating (login form goes dead / native
  // submit). Allow the LAN host(s) explicitly. Extend this list for other dev hostnames.
  allowedDevOrigins: [
    "192.168.1.39",
    "ride.local",
    "vendor.local",
    "ride.192.168.1.39.nip.io",
    "vendor.192.168.1.39.nip.io",
    "localhost",
    "127.0.0.1",
  ],
  // /api/* is proxied to Django by middleware.ts (preserves trailing slash); see there.
  // The shared client library now lives in ./lib/shared rather than a separate package, so the
  // old @tanstack/react-query dedupe is no
  // longer needed — there is only ever one copy, this portal's.
};

export default nextConfig;
