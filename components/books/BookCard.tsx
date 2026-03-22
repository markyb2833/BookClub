import Link from "next/link";
import Image from "next/image";
import ShelfPopover from "@/components/shelves/ShelfPopover";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";
interface Author { id?: string; name: string }
interface Genre { name: string }
interface SeriesRow {
  seriesId?: string;
  position: string | null;
  series: { name: string; slug: string };
}

interface Props {
  id: string;
  title: string;
  coverUrl?: string | null;
  averageRating?: number;
  ratingsCount?: number;
  communityRatingAvg?: number;
  communityReviewCount?: number;
  recommendationsReceivedCount?: number;
  workAuthors?: { author: Author }[];
  authors?: string[];
  workGenres?: { genre: Genre }[];
  genres?: string[];
  workSeries?: SeriesRow[];
}

export default function BookCard({
  id,
  title,
  coverUrl,
  averageRating = 0,
  ratingsCount = 0,
  communityRatingAvg = 0,
  communityReviewCount = 0,
  recommendationsReceivedCount = 0,
  workAuthors,
  authors,
  workGenres,
  genres,
  workSeries = [],
}: Props) {
  const authorList = workAuthors?.map((wa) => wa.author.name) ?? authors ?? [];
  const genreList  = workGenres?.map((wg) => wg.genre.name) ?? genres ?? [];

  const authorLine = authorList.join(", ");

  const primarySeries = [...workSeries].sort((a, b) => {
    const pa = parseFloat(a.position ?? "");
    const pb = parseFloat(b.position ?? "");
    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
    return a.series.name.localeCompare(b.series.name);
  })[0];

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: 12,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      className="bookcard-row"
    >
      <style>{`.bookcard-row:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-color: var(--muted) !important; }`}</style>

      {/* Cover + shelf control — left column so titles use full width */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
        <Link
          href={`/books/${id}`}
          tabIndex={-1}
          aria-hidden
          style={{
            display: "block",
            width: 80,
            height: 120,
            borderRadius: 6,
            overflow: "hidden",
            background: "var(--border)",
            position: "relative",
            flexShrink: 0,
          }}
          className="bookcard-cover-link"
        >
          {coverUrl ? (
            <Image src={coverUrl} alt="" fill style={{ objectFit: "cover" }} sizes="80px" />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
              <span style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>{title.slice(0, 24)}</span>
            </div>
          )}
        </Link>
        <ShelfPopover workId={id} popoverAlign="left" />
      </div>

      <Link
        href={`/books/${id}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
          flex: 1,
          paddingTop: 4,
          textDecoration: "none",
          color: "inherit",
        }}
        className="bookcard-link"
      >
        <div
          style={{
            fontWeight: 600,
            color: "var(--text)",
            lineHeight: 1.3,
            fontSize: 14,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minWidth: 0,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        {primarySeries ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--accent)",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {primarySeries.series.name}
            {primarySeries.position ? ` · #${primarySeries.position}` : ""}
          </span>
        ) : null}
        {authorList.length > 0 && (
          <div
            title={authorLine}
            style={{
              fontSize: 13,
              color: "var(--muted)",
              minWidth: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {authorLine}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <ReaderCommunitySignals
            variant="card"
            community={{
              communityRatingAvg,
              communityReviewCount,
              recommendationsReceivedCount,
            }}
            openLibraryRating={averageRating}
            openLibraryRatingsCount={ratingsCount}
          />
        </div>
        {genreList.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginTop: "auto",
              paddingTop: 4,
              minWidth: 0,
              maxHeight: 52,
              overflow: "hidden",
            }}
          >
            {genreList.slice(0, 3).map((g) => (
              <span key={g} style={{ fontSize: 11, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g}
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  );
}
