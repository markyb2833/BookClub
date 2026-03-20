import { prisma } from "@/lib/prisma";

/** True if `profileOwnerId` has blocked `viewerId` (blockee cannot open blocker's profile). */
export async function isBlockedFromProfile(viewerId: string | null, profileOwnerId: string): Promise<boolean> {
  if (!viewerId || viewerId === profileOwnerId) return false;
  const row = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: profileOwnerId, blockedId: viewerId } },
    select: { id: true },
  });
  return !!row;
}

/** Either user blocked the other — used for DMs, follows, etc. */
/** User ids involved in any block with `me` (either direction). Used for inbox / unread. */
export async function getBlockedPeerIds(me: string): Promise<Set<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: me }, { blockedId: me }] },
    select: { blockerId: true, blockedId: true },
  });
  const out = new Set<string>();
  for (const b of rows) {
    out.add(b.blockerId === me ? b.blockedId : b.blockerId);
  }
  return out;
}

export async function hasAnyBlockBetween(aId: string, bId: string): Promise<boolean> {
  if (aId === bId) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: aId, blockedId: bId },
        { blockerId: bId, blockedId: aId },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

/** For book pages: hide link to reviewer profile when reviewer blocked the viewer. */
export async function profileLinksHiddenForViewer(
  viewerId: string | null,
  authorUserIds: string[]
): Promise<Set<string>> {
  const hidden = new Set<string>();
  if (!viewerId || authorUserIds.length === 0) return hidden;
  const unique = [...new Set(authorUserIds)].filter((id) => id !== viewerId);
  if (unique.length === 0) return hidden;
  const rows = await prisma.userBlock.findMany({
    where: {
      blockerId: { in: unique },
      blockedId: viewerId,
    },
    select: { blockerId: true },
  });
  for (const r of rows) hidden.add(r.blockerId);
  return hidden;
}
