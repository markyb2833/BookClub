import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorksCommunityStatsMap, ZERO_COMMUNITY_STATS } from "@/lib/social/workCommunityStats";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;
  const genre = searchParams.get("genre");
  const sort = searchParams.get("sort") ?? "popular";

  const where = genre
    ? { workGenres: { some: { genre: { slug: genre } } } }
    : {};

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
