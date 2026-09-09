"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Check } from "lucide-react";
import { csrfFetch } from "@/lib/shared";

interface GeocodeCandidate {
  display_name: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  /** Current free-text address (the source of truth stays with the parent, as with a plain Input). */
  value: string;
  /** Fired on every keystroke — same shape as a plain Input's onChange handler. */
  onTextChange: (text: string) => void;
  /** Fired only when a suggestion is picked — carries the real coordinates for that place. */
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  /** True once this stop has real (lat, lng) — shows a small "located" checkmark. */
  hasCoordinates: boolean;
  placeholder?: string;
  className?: string;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;

/**
 * A text input that looks up address candidates as you type (Photon, via
 * /api/v1/tracking/geocode-search/) and lets you pick one — the picked candidate's own
 * coordinates are what get saved, not a later best-guess geocode of whatever text ends up in
 * the box. Free typing without picking still works (onTextChange keeps firing), for an address
 * Photon doesn't know — the backend falls back to geocoding the typed text at save time.
 *
 * Same portal-positioned-dropdown / keyboard-nav shape as SearchableSelect, adapted for an
 * async, debounced result list instead of client-side filtering of a static option list.
 */
export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onTextChange,
  onSelect,
  hasCoordinates,
  placeholder = "Address",
  className = "",
}) => {
  const [suggestions, setSuggestions] = useState<GeocodeCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; drop: "down" | "up" } | null>(null);

  // Debounced fetch, aborting a still-in-flight request when the query changes again so a
  // slow earlier response can never overwrite a newer, faster one.
  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const resp = await csrfFetch(`/api/v1/tracking/geocode-search/?q=${encodeURIComponent(query)}`, {
            method: "GET",
            signal: controller.signal,
          });
          const body = (await resp.json().catch(() => null)) as { result?: GeocodeCandidate[] } | null;
          setSuggestions(body?.result ?? []);
          setHighlight(0);
        } catch {
          // Network error / aborted — leave whatever suggestions are already shown rather than
          // flashing an error for what's usually just an in-progress keystroke.
        } finally {
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        rootRef.current && !rootRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const MENU_MAX_H = 224;

  const reposition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
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
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  const select = (opt: GeocodeCandidate) => {
    onSelect({ address: opt.display_name, lat: opt.lat, lng: opt.lng });
    setSuggestions([]);
    setOpen(false);
  };

  const showMenu = open && (loading || suggestions.length > 0 || value.trim().length >= MIN_QUERY_LENGTH);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onTextChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              const opt = suggestions[highlight];
              if (opt) {
                e.preventDefault();
                select(opt);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={`w-full pl-10 ${hasCoordinates ? "pr-8" : "pr-3"} py-2 bg-white border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-transparent`}
        />
        {hasCoordinates && (
          <span
            title="Located — coordinates confirmed from a matched place"
            className="absolute right-2.5 w-4 h-4 text-success"
          >
            <Check className="w-4 h-4" />
          </span>
        )}
      </div>

      {showMenu && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            left: pos.left,
            width: pos.width,
            ...(pos.drop === "down" ? { top: pos.top } : { bottom: window.innerHeight - pos.top }),
          }}
          className="z-[100] max-h-56 overflow-auto bg-white border border-border rounded-lg shadow-xl"
        >
          {loading && suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-secondary">Searching…</div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-text-secondary">
              No matches — you can still use the typed address as-is.
            </div>
          ) : (
            suggestions.map((opt, i) => (
              <div
                key={`${opt.lat},${opt.lng},${i}`}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-brand-blue/10 ${
                  i === highlight ? "bg-brand-blue/10" : ""
                } text-text-primary`}
              >
                {opt.display_name}
              </div>
            ))
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

AddressAutocomplete.displayName = "AddressAutocomplete";
