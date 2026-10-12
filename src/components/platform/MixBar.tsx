import React from "react";
import { TONE, type Tone } from "@/lib/colors";

export interface MixSegment {
  label: string;
  value: number;
  tone: Tone;
}

/** A thin stacked bar showing how a fleet splits by state, with the numbers in its tooltip. */
export function MixBar({ segments, empty = "None" }: { segments: MixSegment[]; empty?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <span className="text-xs text-text-tertiary">{empty}</span>;
  const summary = segments
    .filter((s) => s.value > 0)
    .map((s) => `${s.label} ${s.value}`)
    .join(" · ");
  return (
    <div className="min-w-[110px]" title={summary} aria-label={summary} role="img">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-ops-card2">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <span
              key={s.label}
              className={`h-full ${TONE[s.tone].dot}`}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ))}
      </div>
      <p className="mt-1 text-[11px] text-text-secondary tabular truncate">{summary}</p>
    </div>
  );
}
