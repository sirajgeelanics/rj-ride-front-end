"use client";

import { useEffect, useState } from "react";

/**
 * The value, settled — updates only after `delay` ms without a change.
 *
 * Used for search boxes that feed a query key: without it every keystroke is a cache miss and
 * a request, so typing "T-123" fires five calls and the list flickers through their results.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return settled;
}
