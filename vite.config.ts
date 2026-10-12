import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api/* is proxied to Django with a trailing slash guaranteed on the path (the API client and
// Django both expect it; without it Django 301-loops). Mirrors the old Next middleware.ts.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.API_ORIGIN ?? "https://api-ravani.rezolv.app";
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      allowedHosts: true,
      proxy: {
        "^/api/": {
          target: apiOrigin,
          changeOrigin: true,
          rewrite: (p) => {
            const [pathname, search = ""] = p.split("?");
            const slashed = pathname!.endsWith("/") ? pathname! : `${pathname}/`;
            return search ? `${slashed}?${search}` : slashed;
          },
        },
      },
    },
  };
});
