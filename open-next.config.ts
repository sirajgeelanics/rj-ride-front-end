import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// See ride_prd/open-next.config.ts — buildCommand:"next build" avoids recursion since the
// package.json `build` script is `opennextjs-cloudflare build`. Runs SSR + middleware (which
// proxies /api -> Django) in the Worker. basePath "/vendor" is preserved from next.config.ts.
export default {
  ...defineCloudflareConfig(),
  buildCommand: "next build",
};
