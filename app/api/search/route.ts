import { NextRequest, NextResponse } from "next/server";
import { meili } from "@/lib/meilisearch";
import { setupBooksIndex } from "@/lib/meilisearch-setup";
import { gapFill } from "@/lib/openlibrary/import";

// Cache of queries we've already gap-filled this server session
// Avoids re-importing on every keystroke for the same term
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
  if (q && page === 1 && !filledQueries.has(q.toLowerCase())) {
    filledQueries.add(q.toLowerCase());
    await gapFill(q, 10);
  }

  const result = await index.search(q, {
    limit,
    offset: (page - 1) * limit,
    filter,
    sort: q ? undefined : ["ratings_count:desc"],
  });

  return NextResponse.json({ hits: result.hits, total: result.estimatedTotalHits });
}
