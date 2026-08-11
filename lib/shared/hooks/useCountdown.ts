"use client";

import { useEffect, useState } from "react";
import { countdownFrom, type Countdown } from "./countdown";

export type { Countdown } from "./countdown";
export { countdownFrom } from "./countdown";

/**
 * Live countdown to a server deadline. Ticks once a second; recomputes from `Date.now()`
 * each tick (so it self-corrects and resyncs whenever `deadlineIso` changes, e.g. after a
 * WS reconnect refetch). Cleans up its interval on unmount / deadline change.
 */
export function useCountdown(deadlineIso: string | null | undefined): Countdown {
  const [value, setValue] = useState<Countdown>(() => countdownFrom(deadlineIso));

  useEffect(() => {
    setValue(countdownFrom(deadlineIso)); // resync immediately on deadline change
    if (!deadlineIso) return;
    const id = setInterval(() => setValue(countdownFrom(deadlineIso)), 1000);
    return () => clearInterval(id);
  }, [deadlineIso]);

  return value;
}
