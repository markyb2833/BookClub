const TRAILING_PUNCT = /[.,;:!?'")\]]+$/;

export function stripEdgePunct(s: string): string {
  return s.replace(TRAILING_PUNCT, "").trim();
}

/**
 * Collects URL-like strings from a message: absolute http(s) URLs and in-app paths
 * starting with /books, /search, /shelves, or /u/.
 */
export function extractMessageUrls(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const t = stripEdgePunct(raw);
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const absRe = /\bhttps?:\/\/[^\s<>\]'")]+/gi;
  let m: RegExpExecArray | null;
  while ((m = absRe.exec(text)) !== null) {
    add(m[0]);
  }

  const relRe =
    /(?:^|\s)(\/books\/[0-9a-f-]{36}(?:\?[^\s<>\]'")]+)?|\/books(?:\?[^\s<>\]'")]+)?|\/search(?:\?[^\s<>\]'")]+)?|\/shelves(?:\?[^\s<>\]'")]+)?|\/u\/[^/\s]+(?:\/(?:profile|shelves\/[^?\s#]+))?(?:\?[^\s<>\]'")]+)?)/gi;
  while ((m = relRe.exec(text)) !== null) {
    add(m[1]);
  }

  return out;
}

/** Turn a matched token into an absolute URL for server resolution (same-origin only). */
export function toAbsoluteUrlForPreview(raw: string, origin: string): string | null {
  const t = stripEdgePunct(raw);
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) {
    if (!origin) return null;
    try {
      return new URL(t, origin).href;
    } catch {
      return null;
    }
  }
  return null;
}
