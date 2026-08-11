"use client";

import React, { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./Button";

export interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  pageSize?: number;
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc" | null;

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps>(
  ({ columns, data, pageSize = 10, emptyMessage = "No data available" }, ref) => {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);
    const [page, setPage] = useState(0);

    const sortedData = useMemo(() => {
      if (!sortKey || !sortDirection) return data;
      const sorted = [...data].sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal === undefined || aVal === null || bVal === undefined || bVal === null) return 0;
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
      return sorted;
    }, [data, sortKey, sortDirection]);

    const paginatedData = useMemo(() => {
      const start = page * pageSize;
      return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize]);

    const totalPages = Math.ceil(sortedData.length / pageSize);

    const handleSort = (key: string) => {
      if (sortKey === key) {
        if (sortDirection === "asc") {
          setSortDirection("desc");
        } else if (sortDirection === "desc") {
          setSortKey(null);
          setSortDirection(null);
        }
      } else {
        setSortKey(key);
        setSortDirection("asc");
        setPage(0);
      }
    };

    if (data.length === 0) {
      return (
        <div ref={ref} className="text-center py-8 text-text-secondary">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div ref={ref} className="flex flex-col gap-4">
        <div className="overflow-x-auto border border-border rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ops-sidebar border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-medium text-white cursor-pointer hover:bg-[#162030] transition-colors"
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && sortKey === col.key && (
                        sortDirection === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-ops-bg"}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-text-primary font-medium">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-secondary">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(0)}
                disabled={page === 0}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

DataTable.displayName = "DataTable";
