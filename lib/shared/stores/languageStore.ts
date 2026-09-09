"use client";

/**
 * UI language. English-only now (Japanese support removed) — kept as a hook rather than a bare
 * constant because ~146 call sites still read it as `useLanguageStore((s) => s.language)` and
 * pass the result straight into `t(key, language)`; changing every one of those is unnecessary
 * churn when this one file can just always answer "en". `setLanguage`/`toggleLanguage` stay as
 * harmless no-ops for the same reason — nothing left calls them (the toggle button is gone too),
 * but keeping the shape means nothing else has to change if that's wrong.
 */

export type Language = "en";

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

function noop(): void {}

const state: LanguageStore = { language: "en", setLanguage: noop, toggleLanguage: noop };

export function useLanguageStore<T = LanguageStore>(selector?: (s: LanguageStore) => T): T {
  const select = selector ?? ((s: LanguageStore) => s as unknown as T);
  return select(state);
}
