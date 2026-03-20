import { prisma } from "@/lib/prisma";
import BookCard from "@/components/books/BookCard";
import { getWorksCommunityStatsMap, ZERO_COMMUNITY_STATS } from "@/lib/social/workCommunityStats";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ page?: string; genre?: string; sort?: string }>;
}

export const metadata = { title: "Browse Books" };

export default async function BooksPage({ searchParams }: Props) {
  const { page: pageStr, genre, sort = "popular" } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 20;

  const where = genre
    ? { workGenres: { some: { genre: { slug: genre } } } }
    : {};

  const orderBy =
    sort === "recent"  ? { firstPublished: "desc" as const }
    : sort === "rating" ? { averageRating:   "desc" as const }
    :                     { ratingsCount:     "desc" as const };

  const [works, total, genres] = await Promise.all([
    prisma.work.findMany({
      where, orderBy,
      skip: (page - 1) * limit, take: limit,
      include: {
        workAuthors: { include: { author: true } },
        workGenres:  { include: { genre: true } },
      },
    }),
    prisma.work.count({ where }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, take: 30 }),
  ]);

  const commMap = await getWorksCommunityStatsMap(
    prisma,
    works.map((w) => w.id),
  );

  const pages = Math.ceil(total / limit);
  const sortLinks = [
    { value: "popular", label: "Popular" },
    { value: "rating",  label: "Top Rated" },
    { value: "recent",  label: "Recent" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {genre ? genre.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "All Books"}
          </h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{total.toLocaleString()} books</span>
        </div>

        {/* Sort */}
        <div style={{ display: "flex", gap: 6 }}>
          {sortLinks.map((s) => (
            <Link
              key={s.value}
              href={`/books?sort=${s.value}${genre ? `&genre=${genre}` : ""}`}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                border: "1px solid var(--border)",
                background: sort === s.value ? "var(--text)" : "var(--surface)",
                color: sort === s.value ? "var(--bg)" : "var(--muted)",
                transition: "all 0.15s",
              }}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 28 }}>
        {/* Genre sidebar */}
        <aside style={{ width: 160, flexShrink: 0 }} className="genre-sidebar">
          <style>{`@media (max-width: 1024px) { .genre-sidebar { display: none; } }`}</style>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Genres
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Link
              href="/books"
              style={{
                fontSize: 13, padding: "5px 10px", borderRadius: 7, textDecoration: "none",
                background: !genre ? "var(--border)" : "transparent",
                color: !genre ? "var(--text)" : "var(--muted)",
                fontWeight: !genre ? 600 : 400,
              }}
            >
              All
            </Link>
            {genres.map((g) => (
              <Link
                key={g.id}
                href={`/books?genre=${g.slug}${sort !== "popular" ? `&sort=${sort}` : ""}`}
                style={{
                  fontSize: 13, padding: "5px 10px", borderRadius: 7, textDecoration: "none",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  background: genre === g.slug ? "var(--border)" : "transparent",
                  color: genre === g.slug ? "var(--text)" : "var(--muted)",
                  fontWeight: genre === g.slug ? 600 : 400,
                }}
              >
                {g.name}
              </Link>
            ))}
          </div>
        </aside>

        {/* Book grid */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {works.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "var(--muted)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>No books yet.</p>
              <Link href="/search" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}>
                Search to import some
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {works.map((work) => {
                const c = commMap.get(work.id) ?? ZERO_COMMUNITY_STATS;
                return (
                  <BookCard
                    key={work.id}
                    {...work}
                    communityRatingAvg={c.communityRatingAvg}
                    communityReviewCount={c.communityReviewCount}
                    recommendationsReceivedCount={c.recommendationsReceivedCount}
                  />
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 32 }}>
              {page > 1 && (
                <Link
                  href={`/books?page=${page - 1}&sort=${sort}${genre ? `&genre=${genre}` : ""}`}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textDecoration: "none", fontSize: 13 }}
                >
                  Previous
                </Link>
              )}
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{page} / {pages}</span>
              {page < pages && (
                <Link
                  href={`/books?page=${page + 1}&sort=${sort}${genre ? `&genre=${genre}` : ""}`}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textDecoration: "none", fontSize: 13 }}
                >
                  Next
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
