import { prisma } from "@/lib/prisma";
import { getBlockedPeerIds } from "@/lib/social/blocking";
import { mutualPartnerIdSet } from "@/lib/social/friends";

/** Unread 1:1 messages per partner id (sender) for the current user as recipient. */
export async function getDirectUnreadBySenderMap(me: string): Promise<Map<string, number>> {
  const blocked = await getBlockedPeerIds(me);
  const grouped = await prisma.message.groupBy({
    by: ["senderId"],
    where: {
      recipientId: me,
      isRead: false,
      deletedByRecipient: false,
    },
    _count: { id: true },
  });
  const senderIds = grouped.map((g) => g.senderId).filter((id) => !blocked.has(id));
  if (senderIds.length === 0) return new Map();
  const mutual = await mutualPartnerIdSet(me, senderIds);
  const map = new Map<string, number>();
  for (const row of grouped) {
    if (blocked.has(row.senderId) || !mutual.has(row.senderId)) continue;
    map.set(row.senderId, row._count.id);
  }
  return map;
}

/** Unread group messages per group id (others’ messages after last read / join). */
export async function getGroupUnreadByGroupIdMap(me: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ gid: string; c: bigint }[]>`
    SELECT gm.group_id AS gid, COUNT(*)::bigint AS c
    FROM group_messages gm
    INNER JOIN group_members mem ON mem.group_id = gm.group_id AND mem.user_id = ${me}
    WHERE gm.sender_id <> ${me}
      AND gm.created_at > COALESCE(mem.last_read_at, mem.joined_at)
    GROUP BY gm.group_id
  `;
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.gid, Number(r.c));
  }
  return map;
}

export async function getUnreadMessageCount(me: string): Promise<number> {
  const [directMap, groupMap] = await Promise.all([
    getDirectUnreadBySenderMap(me),
    getGroupUnreadByGroupIdMap(me),
  ]);
  let n = 0;
  for (const v of directMap.values()) n += v;
  for (const v of groupMap.values()) n += v;
  return n;
}
