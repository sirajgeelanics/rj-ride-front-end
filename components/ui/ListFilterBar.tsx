"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { DateTimePicker } from "@/components/ui/DateTimePicker";

export interface ListFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: ListFilters = { search: "", dateFrom: "", dateTo: "" };

interface ListFilterBarProps {
  value: ListFilters;
  onChange: (next: ListFilters) => void;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Search + from/to date filter bar for a list screen.
 *
 * `onChange` fires on every keystroke; the caller is expected to debounce before putting
 * `search` in a query key, so typing doesn't fire a request per character.
 */
export const ListFilterBar: React.FC<ListFilterBarProps> = ({
  value,
  onChange,
  searchPlaceholder = "Search…",
  className = "",
}) => {
  const set = (patch: Partial<ListFilters>) => onChange({ ...value, ...patch });
  const isDirty = !!(value.search || value.dateFrom || value.dateTo);

  return (
    <div className={`flex flex-wrap items-end gap-3 ${className}`}>
      <div className="relative flex-1 min-w-[16rem]">
        <label className="block text-xs text-text-secondary mb-1">Search</label>
        <Search className="w-4 h-4 absolute left-3 top-[2.1rem] text-text-tertiary" />
        <input
          type="text"
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder={searchPlaceholder}
          className="w-full pl-9 pr-9 py-2 bg-white border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {value.search && (
          <button
            type="button"
            onClick={() => set({ search: "" })}
            aria-label="Clear search"
            className="absolute right-2 top-[2.1rem] p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-ops-bg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="w-44">
        <label className="block text-xs text-text-secondary mb-1">From</label>
        <DateTimePicker
          mode="date"
          value={value.dateFrom}
          onChange={(v) => set({ dateFrom: v })}
          placeholder="Any date"
        />
      </div>

      <div className="w-44">
        <label className="block text-xs text-text-secondary mb-1">To</label>
        <DateTimePicker
          mode="date"
          value={value.dateTo}
          // A `to` earlier than `from` returns nothing with no explanation, so bound it.
          minDate={value.dateFrom || undefined}
          onChange={(v) => set({ dateTo: v })}
          placeholder="Any date"
        />
      </div>

      {isDirty && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex items-center gap-1 px-2 py-2 text-xs text-text-secondary hover:text-danger"
          title="Clear all filters"
        >
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}
    </div>
  );
};

ListFilterBar.displayName = "ListFilterBar";
