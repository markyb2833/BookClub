import type { PrismaClient } from "@prisma/client";

export type WorkCommunityStats = {
  /** Mean of BookClub review ratings (reviews with a numeric rating only) */
  communityRatingAvg: number;
  /** Non-deleted reviews for this work */
  communityReviewCount: number;
  /** Recommendations where this work is the recommended target */
  recommendationsReceivedCount: number;
};

export const ZERO_COMMUNITY_STATS: WorkCommunityStats = {
  communityRatingAvg: 0,
  communityReviewCount: 0,
  recommendationsReceivedCount: 0,
};

export async function getWorkCommunityStats(prisma: PrismaClient, workId: string): Promise<WorkCommunityStats> {
  const [ratedAvg, reviewCount, recCount] = await Promise.all([
    prisma.review.aggregate({
      where: { workId, deletedAt: null, rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { workId, deletedAt: null } }),
    prisma.bookRecommendation.count({ where: { workId, deletedAt: null } }),
  ]);
  return {
    communityRatingAvg: ratedAvg._avg.rating != null ? Number(ratedAvg._avg.rating) : 0,
    communityReviewCount: reviewCount,
    recommendationsReceivedCount: recCount,
  };
}

/** One round-trip for many works (browse, shelves, library wall). */
export async function getWorksCommunityStatsMap(prisma: PrismaClient, workIds: string[]): Promise<Map<string, WorkCommunityStats>> {
  const map = new Map<string, WorkCommunityStats>();
  for (const id of workIds) map.set(id, { ...ZERO_COMMUNITY_STATS });
  const unique = [...new Set(workIds)].filter(Boolean);
  if (unique.length === 0) return map;

  const [avgRows, countRows, recRows] = await Promise.all([
    prisma.review.groupBy({
      by: ["workId"],
      where: { workId: { in: unique }, deletedAt: null, rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.review.groupBy({
      by: ["workId"],
      where: { workId: { in: unique }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.bookRecommendation.groupBy({
      by: ["workId"],
      where: { workId: { in: unique }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  for (const r of avgRows) {
    const cur = map.get(r.workId)!;
    cur.communityRatingAvg = r._avg.rating != null ? Number(r._avg.rating) : 0;
  }
  for (const r of countRows) {
    const cur = map.get(r.workId)!;
    cur.communityReviewCount = r._count._all;
  }
  for (const r of recRows) {
    const cur = map.get(r.workId)!;
    cur.recommendationsReceivedCount = r._count._all;
  }
  return map;
}

export function mergeWorkCommunityStats<T extends { id: string }>(work: T, stats: Map<string, WorkCommunityStats>): T & WorkCommunityStats {
  return { ...work, ...(stats.get(work.id) ?? ZERO_COMMUNITY_STATS) };
}
