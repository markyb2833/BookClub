import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import BookCard from "@/components/books/BookCard";
import { getWorksCommunityStatsMap, ZERO_COMMUNITY_STATS } from "@/lib/social/workCommunityStats";
import { booksBrowseHref, type BooksBrowseState } from "@/lib/booksBrowseHref";
import Link from "next/link";

interface Props {
  searchParams: Promise<{
    page?: string;
    genre?: string;
    sort?: string;
    q?: string;
    author?: string;
    series?: string;
  }>;
}

export const metadata = { title: "Browse Books" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BooksPage({ searchParams }: Props) {
  const { page: pageStr, genre, sort = "popular", q: qRaw, author: authorParam, series: seriesParam } =
    await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1"));
  const limit = 20;
  const q = qRaw?.trim() ?? "";

  const [authorRow, seriesRow] = await Promise.all([
    authorParam && UUID_RE.test(authorParam)
      ? prisma.author.findUnique({ where: { id: authorParam }, select: { id: true, name: true } })
      : null,
    seriesParam
      ? prisma.series.findUnique({ where: { slug: seriesParam }, select: { id: true, slug: true, name: true } })
      : null,
  ]);

  const conditions: Prisma.WorkWhereInput[] = [];
  if (genre) {
    conditions.push({ workGenres: { some: { genre: { slug: genre } } } });
  }
  if (authorRow) {
    conditions.push({ workAuthors: { some: { authorId: authorRow.id } } });
  }
  if (seriesRow) {
    conditions.push({ workSeries: { some: { seriesId: seriesRow.id } } });
  }
  if (q) {
    conditions.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { workAuthors: { some: { author: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  const where = conditions.length ? { AND: conditions } : {};

  const orderBy =
    sort === "recent" ? { firstPublished: "desc" as const }
    : sort === "rating" ? { averageRating: "desc" as const }
    : { ratingsCount: "desc" as const };

  const [works, total, genres] = await Promise.all([
    prisma.work.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        workAuthors: { include: { author: true } },
        workGenres: { include: { genre: true } },
        workSeries: { include: { series: true } },
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
    { value: "rating", label: "Top Rated" },
    { value: "recent", label: "Recent" },
  ];

  const browseState: BooksBrowseState = {
    genre: genre ?? null,
    sort,
    q: q || null,
    author: authorRow?.id ?? null,
    series: seriesRow?.slug ?? null,
  };

  let titleLabel = "All Books";
  if (seriesRow) titleLabel = seriesRow.name;
  else if (authorRow) titleLabel = `Books by ${authorRow.name}`;
  else if (genre) titleLabel = genre.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const hasActiveFilters = !!(q || genre || authorRow || seriesRow);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 80px" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {titleLabel}
          </h1>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {total.toLocaleString()} book{total !== 1 ? "s" : ""}
            {q ? (
              <>
                {" "}
                · matching &quot;{q}&quot;
              </>
            ) : null}
          </span>
        </div>

        {/* Sort */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sortLinks.map((s) => (
            <Link
              key={s.value}
              href={booksBrowseHref({ ...browseState, sort: s.value, page: 1 })}
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

      {/* Search — GET keeps filters in the URL */}
      <form
        method="get"
        action="/books"
        style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}
      >
        {genre ? <input type="hidden" name="genre" value={genre} /> : null}
        {sort !== "popular" ? <input type="hidden" name="sort" value={sort} /> : null}
        {authorRow ? <input type="hidden" name="author" value={authorRow.id} /> : null}
        {seriesRow ? <input type="hidden" name="series" value={seriesRow.slug} /> : null}
        <label htmlFor="books-browse-q" style={{ flex: "1 1 240px", minWidth: 0, margin: 0 }}>
          <span style={{ position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>
            Search by title or author
          </span>
          <input
            id="books-browse-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by title or author…"
            autoComplete="off"
            enterKeyHint="search"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 10,
              border: "1.5px solid var(--border)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 14,
              padding: "10px 14px",
              outline: "none",
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        {q ? (
          <Link
            href={booksBrowseHref({ genre: browseState.genre, sort: browseState.sort, author: browseState.author, series: browseState.series, page: 1 })}
            style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}
          >
            Clear search
          </Link>
        ) : null}
        {hasActiveFilters ? (
          <Link href="/books" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}>
            Clear all filters
          </Link>
        ) : null}
      </form>

      <div style={{ display: "flex", gap: 28 }}>
        {/* Genre sidebar */}
        <aside style={{ width: 160, flexShrink: 0 }} className="genre-sidebar">
          <style>{`@media (max-width: 1024px) { .genre-sidebar { display: none; } }`}</style>
          <p style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8 }}>
            Genres
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Link
              href={booksBrowseHref({ q: browseState.q, sort: browseState.sort, author: browseState.author, series: browseState.series, page: 1 })}
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
                href={booksBrowseHref({ genre: g.slug, sort: browseState.sort, q: browseState.q, author: browseState.author, series: browseState.series, page: 1 })}
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
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                {hasActiveFilters ? "No books match these filters." : "No books yet."}
              </p>
              <Link href="/search" style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline" }}>
                Search to import some
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
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
                  href={booksBrowseHref({ ...browseState, page: page - 1 })}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textDecoration: "none", fontSize: 13 }}
                >
                  Previous
                </Link>
              )}
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{page} / {pages}</span>
              {page < pages && (
                <Link
                  href={booksBrowseHref({ ...browseState, page: page + 1 })}
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
