"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface CursorPage<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface UseCursorListOptions<T> {
  queryKey: readonly unknown[];
  fetcher: (cursor: string | null) => Promise<CursorPage<T>>;
  pageSize?: number;
}

interface UseCursorListResult<T> {
  items: T[];
  count: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  refetch: () => void;
}

export function useCursorList<T>({
  queryKey,
  fetcher,
}: UseCursorListOptions<T>): UseCursorListResult<T> {
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const currentCursor = cursorStack[currentIdx] ?? null;

  const activeKey = [...queryKey, { cursor: currentCursor }];

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: activeKey,
    queryFn: () => fetcher(currentCursor),
  });

  const fetchNextPage = useCallback(() => {
    if (!data?.next) return;
    const nextCursor = data.next;
    setCursorStack((prev) => {
      const next = prev.slice(0, currentIdx + 1);
      next.push(nextCursor);
      return next;
    });
    setCurrentIdx((i) => i + 1);
  }, [data?.next, currentIdx]);

  const fetchPreviousPage = useCallback(() => {
    if (currentIdx === 0) return;
    setCurrentIdx((i) => i - 1);
  }, [currentIdx]);

  const queryClient = useQueryClient();
  const refetchCurrent = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: activeKey });
  }, [queryClient, activeKey]);

  return {
    items: data?.results ?? [],
    count: data?.count ?? 0,
    isLoading,
    isFetching,
    error: error as Error | null,
    hasNextPage: !!data?.next,
    hasPreviousPage: currentIdx > 0,
    fetchNextPage,
    fetchPreviousPage,
    refetch: refetchCurrent,
  };
}
