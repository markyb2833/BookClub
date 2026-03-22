"use client";

import Link from "next/link";
import type { ChatLinkPreview } from "@/lib/social/chatLinkPreviewTypes";

const kindLabel: Record<ChatLinkPreview["kind"], string | null> = {
  book: "Book",
  browse: "Browse",
  search: "Search",
  shelves: "Shelves",
  profile: "Profile",
  publicShelf: "Shelf",
  userLibrary: "Library",
  generic: null,
};

export default function ChatRichLink({
  preview,
  accent,
  flushTop,
}: {
  preview: ChatLinkPreview;
  accent: string;
  /** When the card is the first content on a line, avoid extra top gap inside the bubble. */
  flushTop?: boolean;
}) {
  const label = kindLabel[preview.kind];
  return (
    <Link
      href={preview.href}
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginTop: flushTop ? 0 : 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--bg)",
        textDecoration: "none",
        color: "inherit",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      {preview.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          style={{
            width: 44,
            height: 64,
            objectFit: "cover",
            borderRadius: 6,
            flexShrink: 0,
            background: "var(--surface)",
          }}
        />
      ) : preview.kind === "profile" || preview.kind === "userLibrary" ? (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            flexShrink: 0,
            background: `${accent}24`,
            border: `1px solid ${accent}40`,
          }}
        />
      ) : (
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            flexShrink: 0,
            background: `${accent}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
          }}
        >
          {preview.emoji ?? "📚"}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        {label && (
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", color: accent, textTransform: "uppercase", marginBottom: 2 }}>
            {label}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: "var(--text)", wordBreak: "break-word" }}>{preview.title}</div>
        {preview.subtitle && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, lineHeight: 1.35, wordBreak: "break-word" }}>{preview.subtitle}</div>
        )}
      </div>
    </Link>
  );
}
