import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext adapter for Cloudflare Workers. `buildCommand: "next build"` is REQUIRED here because
// package.json's `build` script is `opennextjs-cloudflare build` (so the deploy runs exactly
// `npm run build` + `wrangler deploy`). Without this override OpenNext would re-invoke `npm run
// build` and recurse into itself. SSR + middleware + the /api->Django rewrite all run in the Worker.
export default {
  ...defineCloudflareConfig(),
  buildCommand: "next build",
};
