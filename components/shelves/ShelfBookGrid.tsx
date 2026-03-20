"use client";

import Image from "next/image";
import Link from "next/link";
import ShelfPopover from "./ShelfPopover";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";

interface Author { name: string }
interface Genre { name: string; slug: string }
interface Work {
  id: string;
  title: string;
  coverUrl: string | null;
  averageRating: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  workAuthors: { author: Author }[];
  workGenres: { genre: Genre }[];
}
interface BookEntry {
  work: Work;
  addedAt: Date;
}

interface Props {
  books: BookEntry[];
  emoji: string;
  /** Visitor / public shelf view — no move/remove popover */
  readOnly?: boolean;
  /** Per-shelf accent for buttons and empty state */
  accentColour?: string | null;
}

export default function ShelfBookGrid({ books, emoji, readOnly, accentColour }: Props) {
  const accent = accentColour ?? "var(--accent)";

  if (books.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", border: "1.5px dashed var(--border)", borderRadius: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>This shelf is empty</p>
        {!readOnly && (
          <>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>Search for books to add them here</p>
            <Link href="/search" style={{ display: "inline-block", padding: "10px 24px", borderRadius: 10, background: accent, color: "#fff", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
              Find books
            </Link>
          </>
        )}
        {readOnly && (
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>No books on this shelf yet.</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 20 }}>
      {books.map(({ work, addedAt }) => {
        const authors = work.workAuthors.map((wa) => wa.author.name);
        return (
          <div key={work.id} style={{ position: "relative" }}>
            <Link href={`/books/${work.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, textDecoration: "none" }}>
              <HoverCover work={work} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {work.title}
                </div>
                {authors.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {authors.join(", ")}
                  </div>
                )}
                <div style={{ marginTop: 4 }}>
                  <ReaderCommunitySignals
                    compact
                    community={{
                      communityRatingAvg: work.communityRatingAvg ?? 0,
                      communityReviewCount: work.communityReviewCount ?? 0,
                      recommendationsReceivedCount: work.recommendationsReceivedCount ?? 0,
                    }}
                    openLibraryRating={work.averageRating}
                    openLibraryRatingsCount={work.ratingsCount ?? 0}
                  />
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, opacity: 0.6 }}>
                  Added {new Date(addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </div>
            </Link>
            {!readOnly && (
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <ShelfPopover workId={work.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HoverCover({ work }: { work: Work }) {
  return (
    <div
      style={{ width: "100%", aspectRatio: "2/3", borderRadius: 10, overflow: "hidden", background: "var(--border)", position: "relative", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", transition: "box-shadow 0.15s, transform 0.15s" }}
      onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 8px 28px rgba(0,0,0,0.2)"; el.style.transform = "translateY(-3px)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; el.style.transform = "none"; }}
    >
      {work.coverUrl ? (
        <Image src={work.coverUrl} alt={work.title} fill style={{ objectFit: "cover" }} sizes="200px" />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12, background: "var(--surface)" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.4 }}>{work.title}</span>
        </div>
      )}
    </div>
  );
}
