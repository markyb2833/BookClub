import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { importEditions } from "@/lib/openlibrary/import";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const work = await prisma.work.findUnique({
    where: { id },
    include: {
      workAuthors: { include: { author: true } },
      workGenres: { include: { genre: true } },
      editions: { orderBy: { pages: "desc" }, take: 10 },
      reviews: {
        where: { deletedAt: null },
        orderBy: [{ isFeatured: "desc" }, { upvotesCount: "desc" }],
        take: 10,
        include: { user: { select: { username: true, displayName: true, avatarUrl: true, tier: true } } },
      },
    },
  });

  if (!work) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lazy-load editions from Open Library if we have none
  if (work.editions.length === 0 && work.openLibraryId) {
    importEditions(work.id, `/works/${work.openLibraryId}`).catch(() => null);
  }

  return NextResponse.json(work);
}
