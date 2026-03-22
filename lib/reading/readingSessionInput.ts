import type { Prisma } from "@prisma/client";
import { z } from "zod";

export const highlightEntrySchema = z.object({
  id: z.string().max(48).optional(),
  text: z.string().min(1).max(12_000),
  page: z.number().int().min(0).optional(),
  loc: z.string().max(300).optional(),
  note: z.string().max(12_000).optional(),
});

export const highlightsSchema = z.array(highlightEntrySchema).max(400);

export function parseHighlights(raw: unknown): Prisma.InputJsonValue | null {
  if (raw === undefined || raw === null) return null;
  const parsed = highlightsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data as unknown as Prisma.InputJsonValue;
}

/** `YYYY-MM-DD` → UTC midnight date for @db.Date */
export function parseDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) throw new Error("INVALID_DATE");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error("INVALID_DATE");
  return new Date(Date.UTC(y, mo - 1, d));
}

export function formatDayUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local calendar `YYYY-MM-DD` for `<input type="date">` defaults (matches what users expect for “today”). */
export function localCalendarDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const readingMediumSchema = z.enum(["paperback", "hardcover", "ebook", "audiobook", "other"]);

export const createReadingSessionSchema = z.object({
  workId: z.string().uuid(),
  editionId: z.string().uuid().nullable().optional(),
  /** Streak / “logged activity” day — defaults to today (UTC). */
  date: z.string().optional(),
  periodStart: z.string(),
  periodEnd: z.string().nullable().optional(),
  pagesRead: z.number().int().min(0).max(100_000).optional().default(0),
  pagesTotal: z.number().int().min(1).max(100_000).nullable().optional(),
  startPage: z.number().int().min(0).nullable().optional(),
  endPage: z.number().int().min(0).nullable().optional(),
  percentComplete: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().max(30_000).nullable().optional(),
  readingTimeMinutes: z.number().int().min(0).max(60_000).nullable().optional(),
  medium: readingMediumSchema.optional(),
  mediumNote: z.string().max(120).nullable().optional(),
  highlights: z.any().optional(),
  /** Omit to auto-increment per work for this user. */
  readCycle: z.number().int().min(1).max(999).optional(),
});

export const patchReadingSessionSchema = createReadingSessionSchema.partial().omit({ workId: true });
