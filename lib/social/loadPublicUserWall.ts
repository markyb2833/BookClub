import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBlockedFromProfile } from "@/lib/social/blocking";
import type { LibraryShelf } from "@/lib/shelves/libraryShelfTypes";
import {
  clampWallCols,
  clampWallRows,
  fillEmptySlots,
  parseWallSlots,
  type WallSlots,
} from "@/lib/shelves/libraryWall";

/** Minimal user fields for `UserPublicShelvesHeader` (works with wall + list payloads). */
export type UserPublicHeaderUser = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  tier: string;
  shelves: readonly unknown[];
  _count: { reviews: number; followers: number; following: number };
};

const wallShelfInclude = {
  ornaments: { orderBy: { zIndex: "asc" as const } },
  books: {
    orderBy: [{ sortOrder: "asc" as const }, { addedAt: "desc" as const }],
    take: 200,
    include: {
      work: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          averageRating: true,
          workAuthors: { select: { author: { select: { name: true } } }, take: 3 },
        },
      },
    },
  },
  _count: { select: { books: true } },
} satisfies Prisma.ShelfInclude;

export const publicUserWallInclude = {
  settings: {
    select: {
      profilePublic: true,
      shelvesPublic: true,
      libraryWallCols: true,
      libraryWallRows: true,
      libraryWallSlots: true,
      accentColour: true,
    },
  },
  shelves: {
    where: { isPublic: true },
    orderBy: { sortOrder: "asc" as const },
    include: wallShelfInclude,
  },
  _count: {
    select: {
      reviews: { where: { deletedAt: null } },
      followers: true,
      following: true,
    },
  },
} satisfies Prisma.UserInclude;

export type PublicUserWallPayload = Prisma.UserGetPayload<{ include: typeof publicUserWallInclude }>;

export type PublicWallPageLoad = {
  user: PublicUserWallPayload;
  sessionUserId: string | null;
  isOwn: boolean;
  initialFollowing: boolean;
  initialTheyFollowYou: boolean;
  initialYouBlockedThem: boolean;
  libraryWall: { cols: number; rows: number; slots: WallSlots };
  wallAssignableShelves: LibraryShelf[];
  hostAccentColour: string;
};

export async function loadPublicUserWallPage(username: string): Promise<PublicWallPageLoad | null> {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { username },
    include: publicUserWallInclude,
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

  const otherShelves = user.shelves.filter((s) => s.slug !== "currently-reading");
  const wallAssignableShelves = otherShelves as unknown as LibraryShelf[];
  const publicIds = new Set(otherShelves.map((s) => s.id));
  const otherIdsOrdered = [...otherShelves].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id);

  const settings = user.settings;
  const cols = clampWallCols(settings?.libraryWallCols ?? 2);
  const rows = clampWallRows(settings?.libraryWallRows ?? 2);
  const need = cols * rows;
  let slots = parseWallSlots(settings?.libraryWallSlots ?? null, need);
  slots = slots.map((id) => (id && publicIds.has(id) ? id : null));

  if (!slots.some(Boolean) && otherIdsOrdered.length > 0) {
    slots = fillEmptySlots(slots, otherIdsOrdered);
  }

  const hostAccentColour = settings?.accentColour ?? "#8b5cf6";

  return {
    user,
    sessionUserId,
    isOwn,
    initialFollowing,
    initialTheyFollowYou,
    initialYouBlockedThem,
    libraryWall: { cols, rows, slots },
    wallAssignableShelves,
    hostAccentColour,
  };
}
