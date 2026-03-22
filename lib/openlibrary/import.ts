import { prisma } from "@/lib/prisma";
import { meili } from "@/lib/meilisearch";
import {
  searchBooks,
  getWork,
  getEditions,
  getSeries,
  coverUrl,
  OLSearchDoc,
} from "./client";
import { mapSubjectsToGenres, genreSlug } from "./genres";
import { seriesSlug } from "@/lib/seriesSlug";

// Phrases that indicate a result is not a standalone book
const NOISE_PATTERNS = [
  /coloring book/i, /box set/i, /collection set/i, /omnibus/i,
  /\d+ books?\b/i, /\bset\b/i,
];

function isNoise(doc: OLSearchDoc): boolean {
  if (NOISE_PATTERNS.some((p) => p.test(doc.title))) return true;
  return false;
}

function extractText(val: string | { value: string } | undefined): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val.value;
}

function olKeyToId(key: string): string {
  return key.replace("/works/", "").replace("/authors/", "").replace("/books/", "");
}

function olSeriesKeyToId(key: string): string {
  return key.replace(/^\/series\//, "").replace(/\/$/, "").replace(/\.json$/i, "");
}

/**
 * Persist Open Library series links for a work (replaces prior rows).
 * Skips when OL has no series or fetch fails.
 */
export async function syncWorkSeriesFromOpenLibrary(workId: string, olWorkKey: string) {
  let olWork: Awaited<ReturnType<typeof getWork>> | null = null;
  try {
    olWork = await getWork(olWorkKey);
  } catch {
    return;
  }
  const refs = olWork?.series;
  if (!refs?.length) {
    await prisma.workSeries.deleteMany({ where: { workId } });
    return;
  }

  const seenSeriesKeys = new Set<string>();
  const toLink: { seriesId: string; position: string | null }[] = [];

  for (const ref of refs) {
    const sk = ref.series?.key;
    if (!sk) continue;
    if (seenSeriesKeys.has(sk)) continue;
    seenSeriesKeys.add(sk);
    if (toLink.length >= 4) break;

    const olSeriesId = olSeriesKeyToId(sk);
    if (!olSeriesId) continue;

    let doc: Awaited<ReturnType<typeof getSeries>>;
    try {
      doc = await getSeries(sk);
    } catch {
      continue;
    }
    const rawName = doc.name?.trim();
    if (!rawName) continue;

    const slug = seriesSlug(rawName, olSeriesId);
    const row = await prisma.series.upsert({
      where: { openLibraryId: olSeriesId },
      create: {
        openLibraryId: olSeriesId,
        name: rawName.slice(0, 300),
        slug,
      },
      update: { name: rawName.slice(0, 300) },
    });

    const pos = ref.position?.trim() ?? null;
    toLink.push({ seriesId: row.id, position: pos ? pos.slice(0, 32) : null });
  }

  await prisma.workSeries.deleteMany({ where: { workId } });
  if (toLink.length === 0) return;

  await prisma.workSeries.createMany({
    data: toLink.map((t) => ({
      workId,
      seriesId: t.seriesId,
      position: t.position,
    })),
  });

  const workFull = await prisma.work.findUnique({
    where: { id: workId },
    include: {
      workAuthors: { include: { author: true } },
      workGenres: { include: { genre: true } },
      workSeries: { include: { series: true } },
    },
  });
  if (workFull) {
    const description = workFull.description ?? "";
    await meili
      .index("works")
      .updateDocuments([
        {
          id: workFull.id,
          title: workFull.title,
          subtitle: workFull.subtitle,
          authors: workFull.workAuthors.map((wa) => wa.author.name),
          author_ids: workFull.workAuthors.map((wa) => wa.author.id),
          genres: workFull.workGenres.map((wg) => wg.genre.name),
          series: workFull.workSeries.map((ws) => ws.series.name),
          series_slugs: workFull.workSeries.map((ws) => ws.series.slug),
          description: description.slice(0, 500),
          first_published: workFull.firstPublished,
          average_rating: workFull.averageRating,
          ratings_count: workFull.ratingsCount,
          cover_url: workFull.coverUrl,
        },
      ])
      .catch(() => null);
  }
}

/**
 * Import a single book from an Open Library search doc.
 * Creates Work, Authors, and indexes to Meilisearch.
 * Returns the local Work record.
 */
export async function importFromSearchDoc(doc: OLSearchDoc) {
  const olWorkId = olKeyToId(doc.key);

  // If we already have it, return it
  const existing = await prisma.work.findUnique({
    where: { openLibraryId: olWorkId },
    include: { workAuthors: { include: { author: true } } },
  });
  if (existing) {
    if (existing.openLibraryId) {
      syncWorkSeriesFromOpenLibrary(existing.id, doc.key).catch(() => null);
    }
    return existing;
  }

  // cover_i from search is the most reliable — use it first
  const coverId = doc.cover_i ?? null;

  // Fetch full work details (description, subjects)
  const olWork = await getWork(doc.key).catch(() => null);
  const description = olWork ? extractText(olWork.description) : "";

  // Upsert authors
  const authorIds: string[] = [];
  const authorNames: string[] = doc.author_name ?? [];

  if (doc.author_key) {
    for (let i = 0; i < doc.author_key.length; i++) {
      const olAuthorId = olKeyToId(doc.author_key[i]);
      const name = authorNames[i] ?? "Unknown";

      const author = await prisma.author.upsert({
        where: { openLibraryId: olAuthorId },
        create: { openLibraryId: olAuthorId, name },
        update: {},
      });
      authorIds.push(author.id);
    }
  }

  // Map raw OL subjects to curated genres
  const genreIds: string[] = [];
  const rawSubjects = doc.subject ?? olWork?.subjects ?? [];
  const mappedGenres = mapSubjectsToGenres(rawSubjects);
  for (const name of mappedGenres) {
    const slug = genreSlug(name);
    const genre = await prisma.genre.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    genreIds.push(genre.id);
  }

  // Create work
  const work = await prisma.work.create({
    data: {
      openLibraryId: olWorkId,
      title: doc.title,
      description,
      coverUrl: coverId ? coverUrl(coverId) : null,
      firstPublished: doc.first_publish_year,
      averageRating: doc.ratings_average ?? 0,
      ratingsCount: doc.ratings_count ?? 0,
      workAuthors: {
        create: authorIds.map((authorId) => ({ authorId, role: "author" })),
      },
      workGenres: {
        create: genreIds.map((genreId) => ({ genreId })),
      },
    },
    include: { workAuthors: { include: { author: true } }, workGenres: { include: { genre: true } } },
  });

  await syncWorkSeriesFromOpenLibrary(work.id, doc.key).catch(() => null);

  const seriesRows = await prisma.workSeries.findMany({
    where: { workId: work.id },
    include: { series: true },
  });

  // Index to Meilisearch
  await meili.index("works").addDocuments([
    {
      id: work.id,
      title: work.title,
      subtitle: work.subtitle,
      authors: work.workAuthors.map((wa: { author: { name: string } }) => wa.author.name),
      author_ids: work.workAuthors.map((wa: { author: { id: string } }) => wa.author.id),
      genres: work.workGenres.map((wg: { genre: { name: string } }) => wg.genre.name),
      series: seriesRows.map((ws) => ws.series.name),
      series_slugs: seriesRows.map((ws) => ws.series.slug),
      description: description.slice(0, 500),
      first_published: work.firstPublished,
      average_rating: work.averageRating,
      ratings_count: work.ratingsCount,
      cover_url: work.coverUrl,
    },
  ]);

  return work;
}

/**
 * Gap-fill: search Open Library for a query, import any results
 * not already in our DB. Returns local work IDs.
 */
export async function gapFill(query: string, limit = 10) {
  const results = await searchBooks(query, 1, limit * 2); // fetch extra to allow for filtering
  const workIds: string[] = [];
  const seenKeys = new Set<string>();

  for (const doc of results.docs) {
    if (workIds.length >= limit) break;
    // Skip noise and duplicates
    if (isNoise(doc)) continue;
    if (seenKeys.has(doc.key)) continue;
    seenKeys.add(doc.key);

    try {
      const work = await importFromSearchDoc(doc);
      workIds.push(work.id);
    } catch (e) {
      console.error(`Failed to import ${doc.key}:`, e);
    }
  }

  return workIds;
}

/**
 * Fetch and store editions for a work.
 */
export async function importEditions(workId: string, olWorkKey: string) {
  const result = await getEditions(olWorkKey).catch(() => null);
  if (!result) return;

  for (const ed of result.entries) {
    const olEdId = olKeyToId(ed.key);
    const coverId = ed.covers?.[0];
    const lang = ed.languages?.[0]?.key?.replace("/languages/", "") ?? null;

    await prisma.edition.upsert({
      where: { openLibraryId: olEdId },
      create: {
        workId,
        openLibraryId: olEdId,
        isbn10: ed.isbn_10?.[0] ?? null,
        isbn13: ed.isbn_13?.[0] ?? null,
        title: ed.title ?? null,
        publisher: ed.publishers?.[0] ?? null,
        publishDate: ed.publish_date ?? null,
        pages: ed.number_of_pages ?? null,
        language: lang,
        coverUrl: coverId ? coverUrl(coverId) : null,
      },
      update: {},
    });
  }
}
