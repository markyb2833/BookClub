import { NextRequest, NextResponse } from "next/server";
import { meili } from "@/lib/meilisearch";
import { setupBooksIndex } from "@/lib/meilisearch-setup";
import { gapFill } from "@/lib/openlibrary/import";

// Cache of queries we've already gap-filled this server session.
// Bump version when gap-fill / import rules change so old sessions retry OL.
const GAP_FILL_CACHE_VER = 2;
const filledQueries = new Set<string>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const genre = req.nextUrl.searchParams.get("genre");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = 20;

  if (!q && !genre) {
    return NextResponse.json({ hits: [], total: 0 });
  }

  // Ensure index exists
  await setupBooksIndex();

  const filter = genre ? [`genres = "${genre}"`] : [];
  const index = meili.index("works");

  // Gap-fill from Open Library on page 1 for queries we haven't seen yet
  const gapKey = `${GAP_FILL_CACHE_VER}:${q.toLowerCase()}`;
  if (q && page === 1 && !filledQueries.has(gapKey)) {
    filledQueries.add(gapKey);
    await gapFill(q, 10);
  }

  const wordCount = q.trim().split(/\s+/).filter(Boolean).length;
  const result = await index.search(q, {
    limit,
    offset: (page - 1) * limit,
    filter,
    sort: q ? undefined : ["ratings_count:desc"],
    ...(wordCount >= 4 ? { matchingStrategy: "all" as const } : {}),
  });

  return NextResponse.json({ hits: result.hits, total: result.estimatedTotalHits });
}
