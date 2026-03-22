import { highlightEntrySchema, highlightsSchema } from "@/lib/reading/readingSessionInput";
import type { z } from "zod";

export type HighlightEntry = z.infer<typeof highlightEntrySchema>;

/** Parsed, validated highlight rows (empty if invalid). */
export function getHighlightEntries(raw: unknown): HighlightEntry[] {
  const p = highlightsSchema.safeParse(raw);
  if (!p.success) return [];
  return p.data;
}

export function countHighlightEntries(raw: unknown): number {
  return getHighlightEntries(raw).filter((h) => h.text.trim().length > 0).length;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DEFAULT_MAX_IN_FEED = 35;

/**
 * Rich HTML appendix for feed posts: session notes + highlights (sanitizer-safe: escaped text, allowlisted structure).
 */
export function buildReadingFeedAppendixHtml(
  notes: string | null,
  highlights: unknown,
  options?: { maxHighlights?: number }
): string {
  const maxH = options?.maxHighlights ?? DEFAULT_MAX_IN_FEED;
  const parts: string[] = [];

  if (notes?.trim()) {
    const paras = notes.trim().split(/\n+/).filter(Boolean);
    parts.push("<p><strong>Reading notes</strong></p>");
    for (const para of paras) {
      parts.push(`<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`);
    }
  }

  const entries = getHighlightEntries(highlights).filter((e) => e.text.trim());
  if (entries.length === 0) return parts.join("");

  parts.push("<p><strong>Highlights</strong></p><ul>");
  const shown = entries.slice(0, maxH);
  for (const e of shown) {
    const bits: string[] = [`<p>${escapeHtml(e.text.trim())}</p>`];
    const meta: string[] = [];
    if (e.page != null && Number.isFinite(e.page)) meta.push(`p. ${e.page}`);
    if (e.loc?.trim()) meta.push(e.loc.trim());
    if (meta.length) bits.push(`<p><em>${escapeHtml(meta.join(" · "))}</em></p>`);
    if (e.note?.trim()) bits.push(`<p><em>${escapeHtml(e.note.trim())}</em></p>`);
    parts.push(`<li>${bits.join("")}</li>`);
  }
  parts.push("</ul>");
  const more = entries.length - shown.length;
  if (more > 0) {
    parts.push(`<p><em>+${more} more in this reading log.</em></p>`);
  }
  return parts.join("");
}
