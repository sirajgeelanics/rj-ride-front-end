import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Check, Loader2, Plane, Hotel } from "lucide-react";
import { csrfFetch } from "@/lib/shared";
import { highlightParts, searchOptions } from "@/lib/search";
import type { LocalPlace } from "@/lib/places";

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
  /** Instant, offline suggestions (airports, hotels) shown from the first typed character. */
  localPlaces?: LocalPlace[];
  /** Fired when one of `localPlaces` is picked. */
  onSelectLocal?: (place: LocalPlace) => void;
}

const DEBOUNCE_MS = 250;
// Remember answers for the session: retyping, backspacing or re-opening a stop never re-asks.
const resultCache = new Map<string, GeocodeCandidate[]>();
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
  localPlaces = [],
  onSelectLocal,
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
    const key = query.toLowerCase();
    const cached = resultCache.get(key);
    if (cached) {
      setSuggestions(cached);
      setHighlight(0);
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
          const found = body?.result ?? [];
          if (resp.ok) resultCache.set(key, found);
          setSuggestions(found);
          setHighlight(0);
        } catch {
          // Network error / aborted — leave whatever suggestions are already shown rather than
          // flashing an error for what's usually just an in-progress keystroke.
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Keep the arrow-key highlight visible inside the scrolling list.
  useEffect(() => {
    if (open) optionRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

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

  const MENU_MAX_H = 288;

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

  // Instant matches from the first character; the geocoder adds real-world places from 3.
  const locals = React.useMemo(() => {
    const q = value.trim();
    if (!q || !localPlaces.length || !onSelectLocal) return [];
    return searchOptions(
      localPlaces.map((p) => ({ ...p, description: p.detail })),
      q,
    ).slice(0, 6);
  }, [value, localPlaces, onSelectLocal]);

  const selectLocal = (p: LocalPlace) => {
    onSelectLocal?.(p);
    setSuggestions([]);
    setOpen(false);
  };

  const select = (opt: GeocodeCandidate) => {
    // The box now holds the picked place's full name; remember it so the effect above doesn't go
    // and look that exact text up again.
    resultCache.set(opt.display_name.trim().toLowerCase(), [opt]);
    onSelect({ address: opt.display_name, lat: opt.lat, lng: opt.lng });
    setSuggestions([]);
    setOpen(false);
  };

  const showMenu =
    open && (locals.length > 0 || loading || suggestions.length > 0 || value.trim().length >= MIN_QUERY_LENGTH);

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
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            const total = locals.length + suggestions.length;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, total - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (highlight < locals.length) {
                const place = locals[highlight];
                if (place) {
                  e.preventDefault();
                  selectLocal(place);
                }
              } else {
                const opt = suggestions[highlight - locals.length];
                if (opt) {
                  e.preventDefault();
                  select(opt);
                }
              }
            } else if (e.key === "Escape") {
              if (open) {
                e.preventDefault();
                e.stopPropagation(); // close only the suggestions, not the surrounding dialog
              }
              setOpen(false);
            }
          }}
          className={`w-full pl-10 ${hasCoordinates ? "pr-8" : "pr-3"} h-10 text-sm bg-white border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue`}
        />
        {loading && !hasCoordinates && (
          <Loader2 className="absolute right-2.5 w-4 h-4 text-text-tertiary animate-spin" aria-label="Searching" />
        )}
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
          className="z-[100] max-h-72 overflow-auto bg-white border border-border rounded-xl shadow-lift ring-1 ring-black/5"
        >
          {locals.map((p, i) => (
            <div
              key={p.id}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                selectLocal(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-2 cursor-pointer flex items-start gap-2.5 border-b border-border/50 ${
                i === highlight ? "bg-brand-blue/10" : "hover:bg-brand-blue/5"
              }`}
            >
              {p.kind === "airport" ? (
                <Plane className="w-4 h-4 mt-0.5 shrink-0 text-brand-blue" />
              ) : (
                <Hotel className="w-4 h-4 mt-0.5 shrink-0 text-accent-gold" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary truncate">
                  {highlightParts(p.label, value).map((part, k) =>
                    part.hit ? (
                      <mark key={k} className="bg-gold-soft text-inherit rounded-sm px-0.5 -mx-0.5">
                        {part.text}
                      </mark>
                    ) : (
                      <React.Fragment key={k}>{part.text}</React.Fragment>
                    ),
                  )}
                </div>
                {p.detail && <div className="text-xs text-text-tertiary truncate mt-0.5">{p.detail}</div>}
              </div>
            </div>
          ))}
          {value.trim().length < MIN_QUERY_LENGTH && locals.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-secondary">
              Keep typing — street and area search starts at {MIN_QUERY_LENGTH} letters.
            </div>
          )}
          {value.trim().length >= MIN_QUERY_LENGTH && loading && suggestions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-secondary flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching places…
            </div>
          ) : value.trim().length >= MIN_QUERY_LENGTH && suggestions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-text-secondary">
              No places found for &ldquo;{value.trim()}&rdquo;. Try a landmark, area or
              pincode, or keep what you typed as-is.
            </div>
          ) : (
            suggestions.map((opt, i) => {
              const [name, ...rest] = opt.display_name.split(",");
              const detail = rest.join(",").trim();
              return (
                <div
                  key={`${opt.lat},${opt.lng},${i}`}
                  ref={(el) => {
                    optionRefs.current[locals.length + i] = el;
                  }}
                  role="option"
                  aria-selected={locals.length + i === highlight}
                  title={opt.display_name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(opt);
                  }}
                  onMouseEnter={() => setHighlight(locals.length + i)}
                  className={`px-3 py-2 cursor-pointer flex items-start gap-2.5 border-b border-border/50 last:border-b-0 ${
                    locals.length + i === highlight ? "bg-brand-blue/10" : "hover:bg-brand-blue/5"
                  }`}
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-text-tertiary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {highlightParts(name ?? "", value).map((part, k) =>
                        part.hit ? (
                          <mark key={k} className="bg-gold-soft text-inherit rounded-sm px-0.5 -mx-0.5">
                            {part.text}
                          </mark>
                        ) : (
                          <React.Fragment key={k}>{part.text}</React.Fragment>
                        ),
                      )}
                    </div>
                    {detail && <div className="text-xs text-text-tertiary truncate mt-0.5">{detail}</div>}
                  </div>
                </div>
              );
            })
          )}
          {value.trim().length >= MIN_QUERY_LENGTH && !(loading && suggestions.length === 0) && (
            <div
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              className="px-3 py-2 text-xs text-text-secondary bg-ops-card2/60 border-t border-border cursor-pointer hover:bg-ops-card2"
            >
              Use &ldquo;{value.trim()}&rdquo; as typed
              <span className="text-text-tertiary"> — location is looked up when the trip is booked</span>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};

AddressAutocomplete.displayName = "AddressAutocomplete";
