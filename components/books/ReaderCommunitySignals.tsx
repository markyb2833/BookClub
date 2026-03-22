"use client";

import { HalfStarRatingDisplay } from "@/components/books/HalfStarRating";
import type { WorkCommunityStats } from "@/lib/social/workCommunityStats";

type Props = {
  community: WorkCommunityStats;
  /** Open Library / catalogue average when present */
  openLibraryRating?: number;
  openLibraryRatingsCount?: number;
  /** Tighter typography for cards */
  compact?: boolean;
  /**
   * Browse-style cards: always two rows (BookClub + Open Library) so mixed data doesn’t change card height.
   */
  variant?: "default" | "card";
};

/**
 * Reader-side aggregates: avg rating from BookClub reviews, review count, times recommended.
 * Optionally a muted Open Library line when catalogue data exists.
 */
export default function ReaderCommunitySignals({
  community,
  openLibraryRating = 0,
  openLibraryRatingsCount = 0,
  compact = false,
  variant = "default",
}: Props) {
  const fs = compact || variant === "card" ? 11 : 13;
  const fsMuted = compact || variant === "card" ? 10 : 12;
  const starSize = compact || variant === "card" ? 12 : 14;
  const hasReaderSignal =
    community.communityRatingAvg > 0 ||
    community.communityReviewCount > 0 ||
    community.recommendationsReceivedCount > 0;
  const hasOL = openLibraryRating > 0;

  if (!hasReaderSignal && !hasOL) return null;

  const parts: string[] = [];
  if (community.communityReviewCount > 0) {
    parts.push(`${community.communityReviewCount.toLocaleString()} review${community.communityReviewCount === 1 ? "" : "s"}`);
  }
  if (community.recommendationsReceivedCount > 0) {
    parts.push(
      `${community.recommendationsReceivedCount.toLocaleString()} recommendation${community.recommendationsReceivedCount === 1 ? "" : "s"}`,
    );
  }

  if (variant === "card" && (hasReaderSignal || hasOL)) {
    const labelStyle = {
      fontSize: 9,
      color: "var(--muted)",
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
      lineHeight: 1.2,
    };

    const bookClubRow =
      community.communityRatingAvg > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minWidth: 0 }}>
          <HalfStarRatingDisplay rating={community.communityRatingAvg} fontSize={starSize} />
          <span style={{ fontSize: fs, color: "var(--text)", fontWeight: 600 }}>{community.communityRatingAvg.toFixed(1)}</span>
          {parts.length > 0 ? (
            <span style={{ fontSize: fsMuted, color: "var(--muted)", minWidth: 0, overflow: "hidden", overflowWrap: "anywhere" }}> · {parts.join(" · ")}</span>
          ) : null}
        </div>
      ) : parts.length > 0 ? (
        <span style={{ fontSize: fsMuted, color: "var(--muted)", lineHeight: 1.45, minWidth: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>{parts.join(" · ")}</span>
      ) : (
        <span style={{ fontSize: fsMuted, color: "var(--muted)", lineHeight: 1.45 }}>No scores yet</span>
      );

    const olRow =
      openLibraryRating > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minWidth: 0 }}>
          <HalfStarRatingDisplay rating={openLibraryRating} fontSize={starSize} />
          <span style={{ fontSize: fs, color: "var(--text)", fontWeight: 600 }}>{openLibraryRating.toFixed(1)}</span>
          {openLibraryRatingsCount > 0 ? (
            <span style={{ fontSize: fsMuted, color: "var(--muted)", minWidth: 0, overflow: "hidden", overflowWrap: "anywhere" }}> · {openLibraryRatingsCount.toLocaleString()} catalogue</span>
          ) : null}
        </div>
      ) : (
        <span style={{ fontSize: fsMuted, color: "var(--muted)", lineHeight: 1.45 }}>No catalogue rating</span>
      );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={labelStyle}>BookClub</span>
          {bookClubRow}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
          <span style={labelStyle}>Open Library</span>
          {olRow}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 4 : 6 }}>
      {hasReaderSignal ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {community.communityRatingAvg > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <HalfStarRatingDisplay rating={community.communityRatingAvg} fontSize={starSize} />
              <span style={{ fontSize: fs, color: "var(--text)", fontWeight: 600 }}>{community.communityRatingAvg.toFixed(1)}</span>
              <span style={{ fontSize: fsMuted, color: "var(--muted)", fontWeight: 500 }}>Reader average</span>
            </div>
          ) : null}
          {parts.length > 0 ? (
            <span style={{ fontSize: fsMuted, color: "var(--muted)", lineHeight: 1.45 }}>{parts.join(" · ")}</span>
          ) : null}
        </div>
      ) : null}

      {hasOL ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <HalfStarRatingDisplay rating={openLibraryRating} fontSize={starSize} />
            <span style={{ fontSize: fs, color: "var(--text)", fontWeight: 600 }}>{openLibraryRating.toFixed(1)}</span>
            <span style={{ fontSize: fsMuted, color: "var(--muted)", fontWeight: 500 }}>Open Library</span>
          </div>
          {openLibraryRatingsCount > 0 ? (
            <span style={{ fontSize: fsMuted, color: "var(--muted)", lineHeight: 1.45 }}>
              {openLibraryRatingsCount.toLocaleString()} catalogue rating{openLibraryRatingsCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
