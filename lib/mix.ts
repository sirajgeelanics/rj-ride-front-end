import { DRIVER_MIX, VEHICLE_MIX } from "@/lib/colors";
import type { MixSegment } from "@/components/platform/MixBar";

type Counts = object;

const pick = (source: Counts, defs: { key: string; label: string; tone: MixSegment["tone"] }[]): MixSegment[] =>
  defs.map((d) => ({
    label: d.label,
    tone: d.tone,
    value: (source as Record<string, number>)[d.key] ?? 0,
  }));

/** Vehicle states of any row that carries the `vehicles_*` counters (vendor, fleet tenant row). */
export const vehicleMix = (row: Counts): MixSegment[] => pick(row, VEHICLE_MIX);

/** Driver states of any row that carries the `drivers_*` counters. */
export const driverMix = (row: Counts): MixSegment[] => pick(row, DRIVER_MIX);
