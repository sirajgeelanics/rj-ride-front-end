import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Shown on every screen (src/lib/appVersion.ts): package.json version + short git commit + build date.
const pkgVersion = (JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as { version: string }).version;
function gitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// Served under /vendor (was Next's basePath). The browser calls /vendor/api/...; this proxies it
// to Django as /api/... with the trailing slash the API requires (same as the old middleware.ts).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.API_ORIGIN ?? "";
  return {
    base: "/vendor/",
    build: { outDir: "dist/vendor", emptyOutDir: true },
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    define: {
      __APP_VERSION__: JSON.stringify(pkgVersion),
      __APP_COMMIT__: JSON.stringify(gitCommit()),
      __APP_BUILT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
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
