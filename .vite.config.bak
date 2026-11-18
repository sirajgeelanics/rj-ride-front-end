import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// /api/* is proxied to Django with a trailing slash guaranteed (Django 301-loops without it) —
// the old middleware.ts. /vendor and /ops are the dev-only rewrites next.config.ts had so the
// three portals could be opened from one origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.API_ORIGIN ?? "https://api-ravani.rezolv.app";
  return {
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
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
        "/vendor": { target: "http://localhost:3001", changeOrigin: false, ws: true },
        "/ops": { target: "http://localhost:3002", changeOrigin: false, ws: true },
      },
    },
  };
});
