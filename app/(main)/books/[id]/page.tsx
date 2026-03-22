import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import BookCover from "@/components/books/BookCover";
import BrowseBooksBackLink from "@/components/books/BrowseBooksBackLink";
import Link from "next/link";
import { profileLinksHiddenForViewer } from "@/lib/social/blocking";
import { importEditions, syncWorkSeriesFromOpenLibrary } from "@/lib/openlibrary/import";
import { booksBrowseHref } from "@/lib/booksBrowseHref";
import ShelfPopover from "@/components/shelves/ShelfPopover";
import BookCommunitySection from "@/components/books/BookCommunitySection";
import ReaderCommunitySignals from "@/components/books/ReaderCommunitySignals";
import { getWorkCommunityStats } from "@/lib/social/workCommunityStats";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const work = await prisma.work.findUnique({ where: { id }, select: { title: true } });
  return { title: work?.title ?? "Book" };
}

export default async function BookPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  const work = await prisma.work.findUnique({
    where: { id },
    include: {
      workAuthors: { include: { author: true } },
      workGenres: { include: { genre: true } },
      workSeries: { include: { series: true } },
      editions: { orderBy: { pages: "desc" }, take: 5 },
    },
  });

  if (!work) notFound();

  let workSeriesRows = work.workSeries;
  if (work.openLibraryId && work.workSeries.length === 0) {
    await syncWorkSeriesFromOpenLibrary(work.id, `/works/${work.openLibraryId}`).catch(() => null);
    workSeriesRows = await prisma.workSeries.findMany({
      where: { workId: work.id },
      include: { series: true },
    });
  }

  const community = await getWorkCommunityStats(prisma, id);

  const viewerId = session?.user?.id ?? null;
  const [reviewers, recAuthors] = await Promise.all([
    prisma.review.findMany({
      where: { workId: id, deletedAt: null },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.bookRecommendation.findMany({
      where: {
        deletedAt: null,
        OR: [{ workId: id }, { contextWorkId: id }],
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);
  const socialUserIds = [...new Set([...reviewers.map((r) => r.userId), ...recAuthors.map((r) => r.userId)])];
  const hiddenProfileLinks = await profileLinksHiddenForViewer(viewerId, socialUserIds);

  if (work.editions.length === 0 && work.openLibraryId) {
    importEditions(work.id, `/works/${work.openLibraryId}`).catch(() => null);
  }

  const authors = work.workAuthors.map((wa) => wa.author);
  const genres = work.workGenres.map((wg) => wg.genre);
  const seriesLinks = [...workSeriesRows].sort((a, b) => {
    const pa = parseFloat(a.position ?? "");
    const pb = parseFloat(b.position ?? "");
    if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb) return pa - pb;
    return a.series.name.localeCompare(b.series.name);
  });

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 80px" }}>
      <Suspense fallback={null}>
        <BrowseBooksBackLink />
      </Suspense>

      {/* Hero */}
      <div style={{ display: "flex", gap: 32, marginBottom: 40, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <BookCover coverUrl={work.coverUrl} title={work.title} size="lg" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, flex: 1, paddingTop: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", lineHeight: 1.2, margin: 0 }}>
            {work.title}
          </h1>

          {authors.length > 0 && (
            <p style={{ fontSize: 16, color: "var(--muted)", margin: 0 }}>
              by{" "}
              {authors.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ", "}
                  <Link
                    href={booksBrowseHref({ author: a.id })}
                    style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                  >
                    {a.name}
                  </Link>
                </span>
              ))}
            </p>
          )}

          {seriesLinks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.05em" }}>SERIES</span>
              {seriesLinks.map((ws) => (
                <Link
                  key={ws.seriesId}
                  href={booksBrowseHref({ series: ws.series.slug })}
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text)",
                    textDecoration: "none",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    borderRadius: 999,
                    padding: "4px 12px",
                  }}
                >
                  {ws.series.name}
                  {ws.position ? ` · #${ws.position}` : ""}
                </Link>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ReaderCommunitySignals
              community={community}
              openLibraryRating={work.averageRating}
              openLibraryRatingsCount={work.ratingsCount}
            />
            {work.firstPublished ? (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>First published {work.firstPublished}</span>
            ) : null}
          </div>

          {genres.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {genres.map((g) => (
                <Link
                  key={g.id}
                  href={booksBrowseHref({ genre: g.slug })}
                  style={{
                    fontSize: 12, fontWeight: 500,
                    background: "var(--bg)", color: "var(--muted)",
                    border: "1px solid var(--border)",
                    borderRadius: 999, padding: "4px 12px",
                    textDecoration: "none", transition: "border-color 0.15s",
                  }}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <ShelfPopover workId={work.id} />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Add to shelf</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {work.description && (
        <section style={{ marginBottom: 36, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>About this book</h2>
          <p style={{ color: "var(--muted)", lineHeight: 1.7, whiteSpace: "pre-line", maxWidth: 680, margin: 0 }}>
            {work.description}
          </p>
        </section>
      )}

      {/* Editions */}
      {work.editions.length > 0 && (
        <section style={{ marginBottom: 36, borderTop: "1px solid var(--border)", paddingTop: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 14 }}>Editions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {work.editions.map((ed: {
              id: string; title: string | null; format: string | null;
              pages: number | null; publisher: string | null; publishDate: string | null;
            }) => (
              <div key={ed.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                borderRadius: 9, border: "1px solid var(--border)",
                background: "var(--surface)", padding: "10px 14px",
                fontSize: 13, color: "var(--text)",
              }}>
                <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ed.title ?? work.title}
                </span>
                {ed.format && (
                  <span style={{ flexShrink: 0, fontSize: 11, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 5, padding: "2px 8px", textTransform: "capitalize", color: "var(--muted)" }}>
                    {ed.format}
                  </span>
                )}
                {ed.pages && <span style={{ flexShrink: 0, color: "var(--muted)" }}>{ed.pages}pp</span>}
                {ed.publisher && (
                  <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                    {ed.publisher}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <BookCommunitySection
        workId={work.id}
        workTitle={work.title}
        hiddenProfileUserIds={[...hiddenProfileLinks]}
        initialReviewCount={work.reviewsCount}
      />
    </div>
  );
}
