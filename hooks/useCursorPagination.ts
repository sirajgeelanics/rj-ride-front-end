"use client";

import { useCallback, useMemo, useState } from "react";

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
