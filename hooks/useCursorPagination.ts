"use client";

import { useCallback, useMemo, useState } from "react";
import { csrfFetch } from "@/lib/shared";

/**
 * Pull the `cursor` value out of a DRF pagination link.
 *
 * DRF's CursorPagination returns `next`/`previous` as FULL URLs
 * (`http://host/api/v1/trips/?cursor=cD0yMDI2...&page_size=2`), not bare cursors. Feeding that
 * whole URL back as the `cursor` query param — which is what the trips list used to do — sends
 * `cursor=http%3A%2F%2Fhost%2F...`, which DRF cannot decode, so "Next" silently returned page 1.
 */
export function cursorFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    // Relative URLs need a base; the origin is irrelevant, we only read the query.
    return new URL(url, "http://localhost").searchParams.get("cursor");
  } catch {
    return null;
  }
}

/**
 * Walk a DRF cursor-paginated list to the very end and return every row.
 *
 * Cursor pagination returns one page (25 rows) plus a `next` link and — deliberately — no total
 * count and no page-jump. Screens that must show or count the *whole* set (config lists, the
 * dashboard's "registered vehicles" tile) therefore follow `next` page by page. We re-issue the
 * same relative path with the extracted `cursor` each time rather than fetching DRF's absolute
 * `next` URL directly, so the request always goes through the proxy with CSRF intact.
 *
 * `basePath` is a REST path that may already carry a query string (e.g. `?vendor_in=…`).
 */
export async function fetchAllPages<T>(basePath: string): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  // Hard cap: a misbehaving server that always returns `next` must not loop forever.
  for (let guard = 0; guard < 1000; guard++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const path = cursor
      ? `${basePath}${sep}cursor=${encodeURIComponent(cursor)}`
      : basePath;
    const resp = await csrfFetch(path, { credentials: "include" });
    if (!resp.ok) throw new Error(`Failed to load ${basePath} (${resp.status})`);
    const body = (await resp.json()) as { results?: T[]; next?: string | null };
    all.push(...(body.results ?? []));
    cursor = cursorFromUrl(body.next);
    if (!cursor) break;
  }
  return all;
}

export interface CursorPagination {
  /** Pass as the `cursor` query param. `undefined` on the first page. */
  cursor: string | undefined;
  /** 0-based index, for a "Page N" label. */
  pageIndex: number;
  hasPrev: boolean;
  hasNext: boolean;
  goNext: () => void;
  goPrev: () => void;
  /** Call whenever a filter changes — otherwise page 3's cursor is applied to a new result set. */
  reset: () => void;
}

/**
 * Cursor pagination state for a DRF list endpoint.
 *
 * Cursor pagination can only step forward one page at a time, so going *back* means remembering
 * the cursor that produced each page — hence the stack rather than a page number.
 *
 * @param nextUrl the `next` field from the current response
 */
export function useCursorPagination(nextUrl: string | null | undefined): CursorPagination {
  // Index 0 is `null` — the first page, which is requested with no cursor at all.
  const [stack, setStack] = useState<Array<string | null>>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  const nextCursor = useMemo(() => cursorFromUrl(nextUrl), [nextUrl]);

  const goNext = useCallback(() => {
    if (!nextCursor) return;
    setStack((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
  }, [nextCursor, pageIndex]);

  const goPrev = useCallback(() => {
    setPageIndex((i) => Math.max(0, i - 1));
  }, []);

  const reset = useCallback(() => {
    setStack([null]);
    setPageIndex(0);
  }, []);

  return {
    cursor: stack[pageIndex] ?? undefined,
    pageIndex,
    hasPrev: pageIndex > 0,
    hasNext: !!nextCursor,
    goNext,
    goPrev,
    reset,
  };
}
