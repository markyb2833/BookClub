import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlockedFromProfile } from "@/lib/social/blocking";

export const PREVIEW_BOOKS = 10;

export const publicUserLibraryInclude = {
  settings: { select: { profilePublic: true, shelvesPublic: true } },
  shelves: {
    where: { isPublic: true },
    orderBy: { sortOrder: "asc" as const },
    include: {
      books: {
        take: PREVIEW_BOOKS,
        orderBy: [{ sortOrder: "asc" as const }, { addedAt: "desc" as const }],
        include: { work: { select: { id: true, title: true, coverUrl: true } } },
      },
      _count: { select: { books: true } },
    },
  },
  _count: {
    select: {
      reviews: { where: { deletedAt: null } },
      followers: true,
      following: true,
    },
  },
} satisfies Prisma.UserInclude;

export type PublicUserWithLibrary = Prisma.UserGetPayload<{ include: typeof publicUserLibraryInclude }>;

export type PublicUserLibraryLoad = {
  user: PublicUserWithLibrary;
  sessionUserId: string | null;
  isOwn: boolean;
  initialFollowing: boolean;
  initialTheyFollowYou: boolean;
  initialYouBlockedThem: boolean;
};

export async function loadPublicUserLibrary(username: string): Promise<PublicUserLibraryLoad | null> {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { username },
    include: publicUserLibraryInclude,
  });

  if (!user || user.settings?.profilePublic === false) return null;
  if (session?.user?.id && (await isBlockedFromProfile(session.user.id, user.id))) return null;

  const sessionUserId = session?.user?.id ?? null;
  const isOwn = sessionUserId === user.id;

  let initialFollowing = false;
  let initialTheyFollowYou = false;
  let initialYouBlockedThem = false;
  if (sessionUserId && !isOwn) {
    const [followRow, reverseFollowRow, blockRow] = await Promise.all([
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: sessionUserId, followingId: user.id } },
        select: { id: true },
      }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: user.id, followingId: sessionUserId } },
        select: { id: true },
      }),
      prisma.userBlock.findUnique({
        where: { blockerId_blockedId: { blockerId: sessionUserId, blockedId: user.id } },
        select: { id: true },
      }),
    ]);
    initialFollowing = !!followRow;
    initialTheyFollowYou = !!reverseFollowRow;
    initialYouBlockedThem = !!blockRow;
  }

  return {
    user,
    sessionUserId,
    isOwn,
    initialFollowing,
    initialTheyFollowYou,
    initialYouBlockedThem,
  };
}

/** Lightweight access check for followers / following list pages. */
export async function loadPublicUserAccess(username: string) {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      settings: { select: { profilePublic: true } },
    },
  });
  if (!user || user.settings?.profilePublic === false) return null;
  if (session?.user?.id && (await isBlockedFromProfile(session.user.id, user.id))) return null;
  return { user, sessionUserId: session?.user?.id ?? null };
}

export function visibleInFollowList(
  viewerId: string | null,
  profileOwnerId: string,
  member: { id: string; settings: { profilePublic: boolean } | null },
) {
  if (member.id === viewerId) return true;
  if (viewerId === profileOwnerId) return true;
  return member.settings?.profilePublic !== false;
}
