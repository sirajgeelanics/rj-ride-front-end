"use client";

import { useSyncExternalStore } from "react";

/**
 * UI language preference, on React's own `useSyncExternalStore` — no state library.
 *
 * This is a per-browser display preference, not server data, so there is nothing here for
 * Django to own. It replaces the Zustand store (and its `persist` middleware) while keeping the
 * exact same hook shape, because ~146 call sites read it as `useLanguageStore((s) => s.language)`.
 *
 * Hydration: the stored value is read on first subscribe rather than at module load. Reading
 * localStorage eagerly would make the client's first snapshot differ from the server-rendered
 * HTML and trip React's hydration mismatch warning.
 */

export type Language = "en" | "ja";

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const STORAGE_KEY = "ride-language";

const listeners = new Set<() => void>();
let hydrated = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(language: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode / storage disabled — the language still works for this session.
  }
}

function setLanguage(language: Language): void {
  if (language === state.language) return;
  state = { ...state, language };
  persist(language);
  emit();
}

function toggleLanguage(): void {
  setLanguage(state.language === "en" ? "ja" : "en");
}

// Replaced only on change, so an identity selector keeps a stable reference and
// useSyncExternalStore does not loop.
let state: LanguageStore = { language: "en", setLanguage, toggleLanguage };

function hydrateOnce(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if ((stored === "en" || stored === "ja") && stored !== state.language) {
      state = { ...state, language: stored };
      emit();
    }
  } catch {
    // Ignore — fall back to the default.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  hydrateOnce();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LanguageStore {
  return state;
}

/** Server render always sees the default, so the markup is deterministic. */
const serverState: LanguageStore = { language: "en", setLanguage, toggleLanguage };

function getServerSnapshot(): LanguageStore {
  return serverState;
}

export function useLanguageStore<T = LanguageStore>(selector?: (s: LanguageStore) => T): T {
  const select = selector ?? ((s: LanguageStore) => s as unknown as T);
  return useSyncExternalStore(
    subscribe,
    () => select(getSnapshot()),
    () => select(getServerSnapshot()),
  );
}
