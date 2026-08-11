"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional trailing hint, e.g. a count of matching rows. */
  hint?: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  /** Currently selected values. Empty array means "no filter" — show everything. */
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Shown on the trigger when nothing is selected, e.g. "All vendors". */
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * A search-and-tick filter for picking any number of options.
 *
 * Differs from SearchableSelect (which picks exactly one): the menu stays open while you tick
 * rows, so selecting three vendors is three clicks rather than three round trips. Selections
 * show as removable chips beneath the trigger, which is the part that makes a multi-filter
 * readable — otherwise "3 selected" gives no clue *which* three.
 *
 * Empty selection deliberately means "no filter" rather than "match nothing", so the list is
 * never mysteriously blank on first render.
 */
export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  options,
  selected,
  onChange,
  placeholder = "All",
  searchPlaceholder = "Search…",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Rendered in a portal so an ancestor with overflow:hidden (cards, drawers, scroll panes)
  // can never clip the menu. Position is measured off the trigger.
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery("");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? "1 selected")
        : `${selected.length} selected`;

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
        }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border rounded-lg text-sm text-left transition-colors ${
          selected.length > 0
            ? "border-brand-blue text-text-primary"
            : "border-border text-text-secondary"
        }`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-xs"
            >
              {options.find((o) => o.value === value)?.label ?? value}
              <button
                type="button"
                aria-label={`Remove ${options.find((o) => o.value === value)?.label ?? value}`}
                onClick={() => toggle(value)}
                className="hover:bg-brand-blue/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-text-muted hover:text-text-primary underline px-1"
          >
            Clear all
          </button>
        </div>
      )}

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            className="z-[100] bg-white border border-border rounded-lg shadow-xl overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search className="w-4 h-4 text-text-muted shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full text-sm bg-transparent focus:outline-none text-text-primary"
              />
            </div>

            <div className="max-h-56 overflow-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-3 text-sm text-text-secondary">No matches</div>
              ) : (
                filtered.map((opt) => {
                  const isOn = selectedSet.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-page-bg"
                    >
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isOn ? "bg-brand-blue border-brand-blue" : "border-border"
                        }`}
                      >
                        {isOn && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex-1 truncate text-text-primary">{opt.label}</span>
                      {opt.hint && <span className="text-xs text-text-muted">{opt.hint}</span>}
                    </button>
                  );
                })
              )}
            </div>

            {selected.length > 0 && (
              <div className="border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Clear {selected.length} selected
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
