"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CursorPagination } from "@/hooks/useCursorPagination";

interface PaginationProps {
  page: CursorPagination;
  /** Rows on the current page — shown as context next to the page number. */
  count?: number;
  /** Singular noun for the count, e.g. "trip" → "12 trips". */
  itemLabel?: string;
  className?: string;
}

/**
 * Prev / page / Next control for a cursor-paginated list.
 *
 * Deliberately no total count or page-jump: cursor pagination has no notion of "page 7 of 12" —
 * that is the trade for stable paging while rows are being inserted underneath you.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  count,
  itemLabel = "row",
  className = "",
}) => {
  // Nothing to page through and nothing to go back to — don't show dead controls.
  if (!page.hasPrev && !page.hasNext) return null;

  return (
    <div className={`flex items-center justify-between gap-3 pt-4 ${className}`}>
      <Button size="sm" variant="secondary" onClick={page.goPrev} disabled={!page.hasPrev}>
        <ChevronLeft className="w-4 h-4 mr-1" /> Prev
      </Button>

      <span className="text-xs font-medium text-text-secondary tabular-nums rounded-full bg-ops-card2 px-3 py-1">
        Page {page.pageIndex + 1}
        {typeof count === "number" && (
          <>
            {" · "}
            {count} {itemLabel}
            {count === 1 ? "" : "s"}
          </>
        )}
      </span>

      <Button size="sm" variant="secondary" onClick={page.goNext} disabled={!page.hasNext}>
        Next <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </div>
  );
};

Pagination.displayName = "Pagination";
