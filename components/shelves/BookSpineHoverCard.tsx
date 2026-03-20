"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";

interface HoverBook {
  title: string;
  coverUrl: string | null;
  averageRating: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  authors: string[];
}

interface Props {
  anchorRect: DOMRect;
  book: HoverBook;
}

const CARD_WIDTH = 190;
const CARD_HEIGHT = 250;

export default function BookSpineHoverCard({ anchorRect, book }: Props) {
  if (typeof document === "undefined") return null;

  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let left = anchorRect.left + scrollX + anchorRect.width / 2 - CARD_WIDTH / 2;
  let top = anchorRect.top + scrollY - CARD_HEIGHT - 10;

  // Flip below if not enough room above
  if (anchorRect.top < CARD_HEIGHT + 10) {
    top = anchorRect.bottom + scrollY + 10;
  }

  // Clamp to viewport edges
  left = Math.max(scrollX + 8, Math.min(left, scrollX + window.innerWidth - CARD_WIDTH - 8));

  return createPortal(
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: CARD_WIDTH,
        zIndex: 9999,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
        overflow: "hidden",
        pointerEvents: "none",
        animation: "fadeInUp 0.12s ease",
      }}
    >
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }`}</style>

      {/* Cover */}
      <div style={{ width: "100%", height: 120, background: "var(--border)", position: "relative" }}>
        {book.coverUrl ? (
          <Image src={book.coverUrl} alt={book.title} fill style={{ objectFit: "cover" }} sizes="190px" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
            <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>{book.title}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {book.title}
        </div>
        {book.authors.length > 0 && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {book.authors.join(", ")}
          </div>
        )}
        <ReaderCommunitySignals
          compact
          community={{
            communityRatingAvg: book.communityRatingAvg ?? 0,
            communityReviewCount: book.communityReviewCount ?? 0,
            recommendationsReceivedCount: book.recommendationsReceivedCount ?? 0,
          }}
          openLibraryRating={book.averageRating}
          openLibraryRatingsCount={book.ratingsCount ?? 0}
        />
      </div>
    </div>,
    document.body
  );
}
