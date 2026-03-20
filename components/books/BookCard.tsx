import Link from "next/link";
import Image from "next/image";
import ShelfPopover from "@/components/shelves/ShelfPopover";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";

interface Author { name: string }
interface Genre  { name: string }

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
}: Props) {
  const authorList = workAuthors?.map((wa) => wa.author.name) ?? authors ?? [];
  const genreList  = workGenres?.map((wg) => wg.genre.name) ?? genres ?? [];

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
    <Link
      href={`/books/${id}`}
      style={{
        display: "flex",
        gap: 12,
        flex: 1,
        minHeight: 0,
        borderRadius: 12,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: 12,
        textDecoration: "none",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      className="bookcard-link"
    >
      <style>{`.bookcard-link:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); border-color: var(--muted) !important; }`}</style>

      {/* Cover */}
      <div style={{ width: 80, height: 120, borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "var(--border)", position: "relative" }}>
        {coverUrl ? (
          <Image src={coverUrl} alt={title} fill style={{ objectFit: "cover" }} sizes="80px" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
            <span style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", lineHeight: 1.3 }}>{title.slice(0, 24)}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, paddingTop: 4, flex: 1, minHeight: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text)", lineHeight: 1.3, fontSize: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {title}
        </div>
        {authorList.length > 0 && (
          <div style={{ fontSize: 13, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {authorList.join(", ")}
          </div>
        )}
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
        {genreList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: "auto", paddingTop: 4 }}>
            {genreList.slice(0, 3).map((g) => (
              <span key={g} style={{ fontSize: 11, background: "var(--bg)", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "2px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
    {/* Shelf popover — sits outside the Link to avoid nested interactive elements */}
    <div style={{ position: "absolute", top: 10, right: 10 }}>
      <ShelfPopover workId={id} />
    </div>
    </div>
  );
}
