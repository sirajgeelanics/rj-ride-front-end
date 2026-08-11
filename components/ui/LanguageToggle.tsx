"use client";

import React from "react";
import { useLanguageStore, t } from "@/lib/shared";
import { Globe } from "lucide-react";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguageStore();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-table-header transition-colors text-sm font-medium text-text-primary"
      title={t("toggleLanguage", language)}
    >
      <Globe className="w-4 h-4 text-text-secondary" />
      <span>{language.toUpperCase()}</span>
    </button>
  );
}
