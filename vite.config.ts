import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Served under /vendor (was Next's basePath). The browser calls /vendor/api/...; this proxies it
// to Django as /api/... with the trailing slash the API requires (same as the old middleware.ts).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.API_ORIGIN ?? "https://api-ravani.rezolv.app";
  return {
    base: "/vendor/",
    build: { outDir: "dist/vendor", emptyOutDir: true },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "src") } },
    server: {
      allowedHosts: true,
      proxy: {
        "^/vendor/api/": {
          target: apiOrigin,
          changeOrigin: true,
          rewrite: (p) => {
            const [pathname, search = ""] = p.replace(/^\/vendor/, "").split("?");
            const slashed = pathname!.endsWith("/") ? pathname! : `${pathname}/`;
            return search ? `${slashed}?${search}` : slashed;
          },
        },
      },
    },
  };
});
