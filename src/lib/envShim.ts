// Next.js inlined NEXT_PUBLIC_* and exposed `process.env`; the shared client code still reads
// them that way, so provide the same shape from Vite's env before any other module loads.
const g = globalThis as unknown as { process?: { env: Record<string, string | undefined> } };
g.process = g.process ?? { env: {} };
for (const [k, v] of Object.entries(import.meta.env)) {
  if (k.startsWith("NEXT_PUBLIC_")) g.process.env[k] = String(v);
}
export {};
