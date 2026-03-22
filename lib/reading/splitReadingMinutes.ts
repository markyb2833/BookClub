import { formatDayUTC } from "@/lib/reading/readingSessionInput";

/** Split `total` into `parts` whole buckets; remainder distributed +1 to the first buckets (sum always equals `total`). */
export function splitIntegerEvenly(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  if (total <= 0) return Array(parts).fill(0);
  const base = Math.floor(total / parts);
  const rem = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * UTC calendar days in the overlap of [periodStart, periodEndOrOpen] and [rangeStart, rangeEnd].
 * When `periodEnd` is null, the open end is treated as `rangeEnd` (same rule as the reading calendar).
 */
export function utcDayKeysInOverlap(
  periodStart: Date,
  periodEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date
): string[] {
  const startMid = Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate());
  const endSrc = periodEnd ?? rangeEnd;
  const endMid = Date.UTC(endSrc.getUTCFullYear(), endSrc.getUTCMonth(), endSrc.getUTCDate());
  const rangeSMid = Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate());
  const rangeEMid = Date.UTC(rangeEnd.getUTCFullYear(), rangeEnd.getUTCMonth(), rangeEnd.getUTCDate());
  const clipStart = Math.max(startMid, rangeSMid);
  const clipEnd = Math.min(endMid, rangeEMid);
  if (clipEnd < clipStart) return [];
  const keys: string[] = [];
  const walk = new Date(clipStart);
  while (walk.getTime() <= clipEnd) {
    keys.push(formatDayUTC(walk));
    walk.setUTCDate(walk.getUTCDate() + 1);
  }
  return keys;
}
