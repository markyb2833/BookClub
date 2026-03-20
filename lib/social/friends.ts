import { prisma } from "@/lib/prisma";

/** Both users follow each other — required for 1:1 DMs in BookClub. */
export async function areMutuallyFollowing(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return false;
  const [ab, ba] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: aId, followingId: bId } },
      select: { id: true },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: bId, followingId: aId } },
      select: { id: true },
    }),
  ]);
  return !!ab && !!ba;
}

/** Among `candidateUserIds`, return the subset that are mutual follows with `me`. */
export async function mutualPartnerIdSet(me: string, candidateUserIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(candidateUserIds)].filter((id) => id !== me);
  if (ids.length === 0) return new Set();
  const [iFollow, theyFollowMe] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: me, followingId: { in: ids } },
      select: { followingId: true },
    }),
    prisma.follow.findMany({
      where: { followerId: { in: ids }, followingId: me },
      select: { followerId: true },
    }),
  ]);
  const a = new Set(iFollow.map((x) => x.followingId));
  const b = new Set(theyFollowMe.map((x) => x.followerId));
  const out = new Set<string>();
  for (const id of ids) {
    if (a.has(id) && b.has(id)) out.add(id);
  }
  return out;
}
