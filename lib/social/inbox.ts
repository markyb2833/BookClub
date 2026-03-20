import { prisma } from "@/lib/prisma";
import { getBlockedPeerIds } from "@/lib/social/blocking";
import { mutualPartnerIdSet } from "@/lib/social/friends";
import { getDirectUnreadBySenderMap, getGroupUnreadByGroupIdMap } from "@/lib/social/messageUnread";

export type InboxDirectItem = {
  type: "direct";
  user: { id: string; username: string; displayName: string | null };
  lastMessage: { body: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
};

export type InboxGroupItem = {
  type: "group";
  id: string;
  name: string;
  createdAt: string;
  lastMessage: {
    body: string;
    createdAt: string;
    fromMe: boolean;
    senderUsername: string;
  } | null;
  unreadCount: number;
};

export type InboxPayload = {
  unreadTotal: number;
  direct: InboxDirectItem[];
  groups: InboxGroupItem[];
};

export async function getInboxPayload(me: string): Promise<InboxPayload> {
  const [directUnreadMap, groupUnreadMap] = await Promise.all([
    getDirectUnreadBySenderMap(me),
    getGroupUnreadByGroupIdMap(me),
  ]);

  let unreadTotal = 0;
  for (const v of directUnreadMap.values()) unreadTotal += v;
  for (const v of groupUnreadMap.values()) unreadTotal += v;

  const blockedPeerIds = await getBlockedPeerIds(me);

  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: me, deletedBySender: false },
        { recipientId: me, deletedByRecipient: false },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    include: {
      sender: { select: { id: true, username: true, displayName: true } },
      recipient: { select: { id: true, username: true, displayName: true } },
    },
  });

  const latestByPartner = new Map<
    string,
    { user: { id: string; username: string; displayName: string | null }; last: (typeof rows)[0] }
  >();

  const candidatePartnerIds = new Set<string>();
  for (const m of rows) {
    const partner = m.senderId === me ? m.recipient : m.sender;
    if (blockedPeerIds.has(partner.id)) continue;
    candidatePartnerIds.add(partner.id);
  }

  const partnerIdList = [...candidatePartnerIds];
  const mutual = await mutualPartnerIdSet(me, partnerIdList);

  for (const m of rows) {
    const partner = m.senderId === me ? m.recipient : m.sender;
    if (blockedPeerIds.has(partner.id)) continue;
    if (!mutual.has(partner.id)) continue;
    if (!latestByPartner.has(partner.id)) {
      latestByPartner.set(partner.id, { user: partner, last: m });
    }
  }

  type DirectWithSort = InboxDirectItem & { sortAt: number };
  const directItems: DirectWithSort[] = [...latestByPartner.values()].map(({ user, last }) => ({
    type: "direct" as const,
    user,
    lastMessage: {
      body: last.body.length > 140 ? `${last.body.slice(0, 137)}…` : last.body,
      createdAt: last.createdAt.toISOString(),
      fromMe: last.senderId === me,
    },
    unreadCount: directUnreadMap.get(user.id) ?? 0,
    sortAt: last.createdAt.getTime(),
  }));

  directItems.sort((a, b) => b.sortAt - a.sortAt);
  const direct: InboxDirectItem[] = directItems.map(({ sortAt: _s, ...rest }) => rest);

  const memberships = await prisma.groupMember.findMany({
    where: { userId: me },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              body: true,
              createdAt: true,
              senderId: true,
              sender: { select: { username: true } },
            },
          },
        },
      },
    },
  });

  type GroupWithSort = InboxGroupItem & { sortAt: number };
  const groupItemsRaw: GroupWithSort[] = memberships.map((m) => {
    const g = m.group;
    const last = g.messages[0];
    const sortAt = last ? last.createdAt.getTime() : g.createdAt.getTime();
    return {
      type: "group" as const,
      id: g.id,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
      lastMessage: last
        ? {
            body: last.body.length > 140 ? `${last.body.slice(0, 137)}…` : last.body,
            createdAt: last.createdAt.toISOString(),
            fromMe: last.senderId === me,
            senderUsername: last.sender.username,
          }
        : null,
      unreadCount: groupUnreadMap.get(g.id) ?? 0,
      sortAt,
    };
  });

  groupItemsRaw.sort((a, b) => b.sortAt - a.sortAt);
  const groups: InboxGroupItem[] = groupItemsRaw.map(({ sortAt: _s, ...rest }) => rest);

  return { unreadTotal, direct, groups };
}
