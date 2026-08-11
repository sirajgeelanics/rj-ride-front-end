"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
  /** Rendered greyed out and not selectable (e.g. an asset already on a live trip). */
  disabled?: boolean;
  /** Short reason shown next to a disabled option, e.g. "on a trip". */
  hint?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

/**
 * A dropdown you can type into to filter — a combobox. Drop-in replacement for a plain
 * <Select> where the option list may grow large (customers, vendors, vehicle types…).
 * Keyboard: ↑/↓ to move (skipping disabled rows), Enter to pick, Esc to close.
 * Click-outside closes.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Search…",
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // The menu renders in a portal on <body>, so an ancestor with overflow:hidden/auto
  // (drawers, modals, scroll panes) can never clip it. Position is measured from the input.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; drop: "down" | "up" } | null>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);


  const MENU_MAX_H = 224; // matches max-h-56

  const reposition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    // Flip upward only when there genuinely isn't room below but there is above.
    const up = below < Math.min(MENU_MAX_H, 160) && r.top > below;
    setPos({
      top: up ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      drop: up ? "up" : "down",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    // `true` captures scrolls on any ancestor (the drawer body), not just the window.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const select = (opt: Option) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setQuery("");
    setOpen(false);
  };

  /** Next selectable index in `dir`, so arrow keys hop over greyed-out rows. */
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < filtered.length; i += dir) {
      if (!filtered[i]?.disabled) return i;
    }
    return from;
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="text"
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlight(filtered.findIndex((o) => !o.disabled));
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((h) => step(h, 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => step(h, -1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = filtered[highlight];
            if (opt) select(opt);
          } else if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        className="w-full px-3 py-2 bg-white border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent"
      />
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            ...(pos.drop === "down"
              ? { top: pos.top }
              : { bottom: window.innerHeight - pos.top }),
          }}
          className="z-[100] max-h-56 overflow-auto bg-white border border-border rounded-lg shadow-xl"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-secondary">No matches</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled || undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
                onMouseEnter={() => !opt.disabled && setHighlight(i)}
                className={
                  opt.disabled
                    ? "px-3 py-2 text-sm flex items-center justify-between gap-2 text-text-tertiary bg-slate-50 cursor-not-allowed"
                    : `px-3 py-2 text-sm flex items-center justify-between gap-2 cursor-pointer hover:bg-brand-blue/10 ${
                        i === highlight ? "bg-brand-blue/10" : ""
                      } ${opt.value === value ? "font-medium text-brand-blue" : "text-text-primary"}`
                }
              >
                <span className={opt.disabled ? "line-through" : ""}>{opt.label}</span>
                {opt.disabled && opt.hint && (
                  <span className="text-xs shrink-0 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                    {opt.hint}
                  </span>
                )}
              </div>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

SearchableSelect.displayName = "SearchableSelect";
