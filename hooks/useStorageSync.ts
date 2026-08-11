"use client";

import { useEffect } from "react";

/**
 * Cross-tab sync hook.
 * When localStorage changes in another tab, re-hydrates the specified Zustand store
 * by reading the new value from localStorage and calling setState.
 *
 * Usage:
 *   useStorageSync('ride-vendor-info', useVendorInfoStore);
 */
export function useStorageSync(
  storageKey: string,
  store: { setState: (state: Record<string, unknown>) => void }
) {
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          // Zustand persist wraps state in { state: {...} }
          const state = parsed.state || parsed;
          store.setState(state);
        } catch {
          // Ignore parse errors — stale data is harmless
        }
      }
    };

    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [storageKey, store]);
}
