import { stripEdgePunct } from "./extractMessageUrls";

export type UrlSpan = { start: number; end: number; raw: string };

function pushSpan(spans: UrlSpan[], start: number, end: number, raw: string) {
  if (end <= start) return;
  spans.push({ start, end, raw });
}

/** Non-overlapping URL spans in document order (for one line of text). */
export function findUrlSpansInLine(line: string): UrlSpan[] {
  const spans: UrlSpan[] = [];

  const absRe = /\bhttps?:\/\/[^\s<>\]'")]+/gi;
  let m: RegExpExecArray | null;
  while ((m = absRe.exec(line)) !== null) {
    const raw = m[0];
    const trimmed = stripEdgePunct(raw);
    if (!trimmed) continue;
    const trimStart = raw.indexOf(trimmed);
    const trimEnd = trimStart + trimmed.length;
    pushSpan(spans, m.index + trimStart, m.index + trimEnd, trimmed);
  }

  const relRe =
    /(?:^|\s)(\/books\/[0-9a-f-]{36}(?:\?[^\s<>\]'")]+)?|\/books(?:\?[^\s<>\]'")]+)?|\/search(?:\?[^\s<>\]'")]+)?|\/shelves(?:\?[^\s<>\]'")]+)?|\/u\/[^/\s]+(?:\/(?:profile|shelves\/[^?\s#]+))?(?:\?[^\s<>\]'")]+)?)/gi;
  while ((m = relRe.exec(line)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    const trimmed = stripEdgePunct(raw);
    if (!trimmed) continue;
    const g1Start = m.index + m[0].indexOf(m[1]);
    const trimStartInG1 = raw.indexOf(trimmed);
    pushSpan(spans, g1Start + trimStartInG1, g1Start + trimStartInG1 + trimmed.length, trimmed);
  }

  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: UrlSpan[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start < last.end) {
      if (s.end <= last.end) continue;
      last.end = s.end;
      last.raw = line.slice(last.start, last.end);
      continue;
    }
    merged.push({ ...s });
  }
  return merged;
}

export type LineSegment =
  | { type: "text"; text: string }
  | { type: "url"; raw: string };

export function lineToSegments(line: string): LineSegment[] {
  const spans = findUrlSpansInLine(line);
  if (spans.length === 0) return [{ type: "text", text: line }];

  const out: LineSegment[] = [];
  let i = 0;
  for (const sp of spans) {
    if (sp.start > i) out.push({ type: "text", text: line.slice(i, sp.start) });
    out.push({ type: "url", raw: sp.raw });
    i = sp.end;
  }
  if (i < line.length) out.push({ type: "text", text: line.slice(i) });
  return out;
}
