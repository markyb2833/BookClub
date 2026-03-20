import { sanitizeRichHtml } from "@/lib/sanitizeRichText";

/** Server-safe rendered HTML (sanitized). */
export default function SafeRichHtml({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeRichHtml(html);
  if (!clean.trim()) return null;
  return (
    <>
      <div
        className={className ? `${className} safe-rich-html` : "safe-rich-html"}
        style={{ lineHeight: 1.65, fontSize: 15, color: "var(--text)" }}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      <style>{`
        .safe-rich-html ul {
          margin: 0.5em 0 !important;
          padding-left: 1.75rem !important;
          list-style-position: outside !important;
          list-style-type: disc !important;
        }
        .safe-rich-html ol {
          margin: 0.5em 0 !important;
          padding-left: 1.75rem !important;
          list-style-position: outside !important;
          list-style-type: decimal !important;
        }
        .safe-rich-html ul ul { list-style-type: circle !important; }
        .safe-rich-html ul ul ul { list-style-type: square !important; }
        .safe-rich-html li { display: list-item !important; margin: 0.2em 0 !important; }
        .safe-rich-html li p { margin: 0.15em 0 !important; }
        .safe-rich-html blockquote { margin: 0.65em 0; padding-left: 1rem; border-left: 3px solid var(--border); color: var(--muted); }
        .safe-rich-html h2 { font-size: 1.3rem; font-weight: 700; margin: 0.65em 0 0.35em; line-height: 1.25; color: var(--text); }
        .safe-rich-html h3 { font-size: 1.12rem; font-weight: 700; margin: 0.55em 0 0.3em; line-height: 1.3; color: var(--text); }
        .safe-rich-html h1 { font-size: 1.45rem; font-weight: 700; margin: 0.65em 0 0.35em; color: var(--text); }
        .safe-rich-html p { margin: 0.45em 0; }
        .safe-rich-html a { text-decoration: underline; }
      `}</style>
    </>
  );
}
