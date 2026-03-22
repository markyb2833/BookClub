import type { PrismaClient } from "@prisma/client";

export type ReadingProgressSnapshot = {
  percentComplete: number | null;
  endPage: number | null;
  pagesTotal: number | null;
};

/** Derive 0–100 progress from the latest session row fields. */
export function progressPercentFromSessionSnapshot(s: ReadingProgressSnapshot): number | null {
  const pc = s.percentComplete;
  if (pc != null && Number.isFinite(pc)) {
    return Math.max(0, Math.min(100, pc));
  }
  const total = s.pagesTotal;
  if (total != null && total > 0 && s.endPage != null && Number.isFinite(s.endPage)) {
    return Math.max(0, Math.min(100, (s.endPage / total) * 100));
  }
  return null;
}

/**
 * For each workId, uses the most recently updated reading session (any cycle).
 * `lastActivityAt` is always set when a session exists; `progressPercent` may be null if the row has no usable fields.
 */
export async function getLatestReadingMetaByWorkIds(
  prisma: PrismaClient,
  userId: string,
  workIds: string[]
): Promise<Map<string, { progressPercent: number | null; lastActivityAt: Date }>> {
  if (workIds.length === 0) return new Map();

  const rows = await prisma.readingSession.findMany({
    where: { userId, workId: { in: workIds } },
    orderBy: { updatedAt: "desc" },
    select: {
      workId: true,
      updatedAt: true,
      percentComplete: true,
      endPage: true,
      pagesTotal: true,
    },
  });

  const map = new Map<string, { progressPercent: number | null; lastActivityAt: Date }>();
  for (const row of rows) {
    if (map.has(row.workId)) continue;
    map.set(row.workId, {
      progressPercent: progressPercentFromSessionSnapshot(row),
      lastActivityAt: row.updatedAt,
    });
  }
  return map;
}
