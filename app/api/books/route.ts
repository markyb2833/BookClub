import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorksCommunityStatsMap, ZERO_COMMUNITY_STATS } from "@/lib/social/workCommunityStats";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;
  const genre = searchParams.get("genre");
  const sort = searchParams.get("sort") ?? "popular";
  const q = searchParams.get("q")?.trim() ?? "";
  const authorParam = searchParams.get("author");
  const seriesParam = searchParams.get("series");
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const [authorRow, seriesRow] = await Promise.all([
    authorParam && uuidRe.test(authorParam)
      ? prisma.author.findUnique({ where: { id: authorParam }, select: { id: true } })
      : null,
    seriesParam ? prisma.series.findUnique({ where: { slug: seriesParam }, select: { id: true } }) : null,
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
        { title: { contains: q, mode: "insensitive" as const } },
        { workAuthors: { some: { author: { name: { contains: q, mode: "insensitive" as const } } } } },
      ],
    });
  }
  const where = conditions.length ? { AND: conditions } : {};

  const orderBy =
    sort === "recent"
      ? { firstPublished: "desc" as const }
      : sort === "rating"
      ? { averageRating: "desc" as const }
      : { ratingsCount: "desc" as const };

  const [works, total] = await Promise.all([
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
  ]);

  const commMap = await getWorksCommunityStatsMap(
    prisma,
    works.map((w) => w.id),
  );

  const worksOut = works.map((w) => {
    const c = commMap.get(w.id) ?? ZERO_COMMUNITY_STATS;
    return { ...w, ...c };
  });

  return NextResponse.json({
    works: worksOut,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
