import sanitizeHtml from "sanitize-html";

type HtmlAttribs = Record<string, string>;
type TagResult = { tagName: string; attribs: HtmlAttribs };

const RICH_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "span",
] as const;

function sanitizeStyleForTag(tag: string, raw: string | undefined): string | null {
  if (!raw) return null;
  const upper = tag.toUpperCase();
  const parts = raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i < 0) continue;
    const prop = p.slice(0, i).trim().toLowerCase();
    const val = p.slice(i + 1).trim();
    if (upper === "SPAN") {
      if (prop === "color" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(val)) out.push(`color: ${val}`);
      else if (prop === "font-size" && /^(\d{1,2})(\.\d+)?px$/i.test(val)) {
        const n = parseFloat(val);
        if (n >= 10 && n <= 40) out.push(`font-size: ${val}`);
      } else if (prop === "font-family") {
        if (val.length > 180 || /url\s*\(|expression\s*\(|@import|javascript:/i.test(val)) continue;
        out.push(`font-family: ${val}`);
      }
    }
    if (upper === "P" || upper === "H1" || upper === "H2" || upper === "H3") {
      if (prop === "text-align" && /^(left|right|center|justify)$/.test(val)) {
        out.push(`text-align: ${val}`);
      }
    }
  }
  return out.length ? out.join("; ") : null;
}

function styleTransform(tagName: string, attribs: HtmlAttribs): TagResult {
  if (!attribs.style) return { tagName, attribs };
  const clean = sanitizeStyleForTag(tagName, attribs.style);
  if (clean) return { tagName, attribs: { ...attribs, style: clean } };
  const { style: _s, ...rest } = attribs;
  return { tagName, attribs: rest };
}

const richTransformTags: Record<string, (tagName: string, attribs: HtmlAttribs) => TagResult> = {
  span: (tagName, attribs) => styleTransform(tagName, attribs),
  p: (tagName, attribs) => styleTransform(tagName, attribs),
  h1: (tagName, attribs) => styleTransform(tagName, attribs),
  h2: (tagName, attribs) => styleTransform(tagName, attribs),
  h3: (tagName, attribs) => styleTransform(tagName, attribs),
  a: (tagName, attribs) => ({
    tagName,
    attribs: {
      ...attribs,
      target: "_blank",
      rel: "noopener noreferrer",
    },
  }),
};

const RICH_OPTIONS = {
  allowedTags: [...RICH_TAGS],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["style"],
    p: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
  },
  transformTags: richTransformTags,
} as const satisfies Parameters<typeof sanitizeHtml>[1];

/** Sanitize HTML from TipTap / reviews / recommendations / feed posts. */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  return sanitizeHtml(dirty ?? "", RICH_OPTIONS);
}

/** Strip to plain text for previews / validation length. */
export function richTextToPlain(html: string): string {
  const plain = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  });
  return plain.replace(/\s+/g, " ").trim();
}

/** Single-line / comment bodies — no HTML. */
export function sanitizePlainContent(s: string | null | undefined): string {
  return sanitizeHtml(s ?? "", {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}
