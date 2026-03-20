import DOMPurify from "isomorphic-dompurify";

const RICH = {
  ALLOWED_TAGS: [
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
  ],
  ALLOWED_ATTR: ["href", "target", "rel", "style"],
};

let styleHookInstalled = false;

function sanitizeStyleForTag(tag: string, raw: string | undefined): string | null {
  if (!raw) return null;
  const upper = tag.toUpperCase();
  const parts = raw.split(";").map((s) => s.trim()).filter(Boolean);
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

function ensureRichTextStyleHook() {
  if (styleHookInstalled) return;
  styleHookInstalled = true;
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName !== "style") return;
    const clean = sanitizeStyleForTag(node.tagName, data.attrValue);
    if (clean) data.attrValue = clean;
    else data.keepAttr = false;
  });
}

/** Sanitize HTML from TipTap / reviews / recommendations / feed posts. */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  ensureRichTextStyleHook();
  const s = String(DOMPurify.sanitize(dirty ?? "", RICH));
  return s.replace(/<a /g, '<a rel="noopener noreferrer" target="_blank" ');
}

/** Strip to plain text for previews / validation length. */
export function richTextToPlain(html: string): string {
  return String(DOMPurify.sanitize(html, { ALLOWED_TAGS: [] })).replace(/\s+/g, " ").trim();
}

/** Single-line / comment bodies — no HTML. */
export function sanitizePlainContent(s: string | null | undefined): string {
  return String(DOMPurify.sanitize(s ?? "", { ALLOWED_TAGS: [] })).trim();
}
