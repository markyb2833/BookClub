import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestReadingMetaByWorkIds } from "@/lib/reading/workReadingProgress";
import { getWorksCommunityStatsMap, mergeWorkCommunityStats } from "@/lib/social/workCommunityStats";
import { redirect } from "next/navigation";
import ShelfDashboard from "@/components/shelves/ShelfDashboard";
import {
  clampWallCols,
  clampWallRows,
  fillEmptySlots,
  parseWallSlots,
} from "@/lib/shelves/libraryWall";

export const metadata = { title: "My Library" };

export default async function ShelvesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      displayName: true,
      username: true,
      settings: {
        select: {
          libraryWallCols: true,
          libraryWallRows: true,
          libraryWallSlots: true,
        },
      },
      shelves: {
        orderBy: { sortOrder: "asc" },
        include: {
          ornaments: { orderBy: { zIndex: "asc" } },
          books: {
            orderBy: [{ sortOrder: "asc" }, { addedAt: "desc" }],
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
        },
      },
    },
  });

  if (!user) redirect("/login");

  let settings = user.settings;
  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: session.user.id },
      select: {
        libraryWallCols: true,
        libraryWallRows: true,
        libraryWallSlots: true,
      },
    });
  }

  const otherShelves = user.shelves.filter((s) => s.slug !== "currently-reading");
  const otherIds = [...otherShelves].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id);

  const cols = clampWallCols(settings.libraryWallCols);
  const rows = clampWallRows(settings.libraryWallRows);
  const need = cols * rows;
  let slots = parseWallSlots(settings.libraryWallSlots, need);
  let wallDirty = false;

  if (!slots.some(Boolean)) {
    slots = fillEmptySlots(slots, otherIds);
    wallDirty = true;
  }

  if (wallDirty) {
    await prisma.userSettings.update({
      where: { userId: session.user.id },
      data: { libraryWallCols: cols, libraryWallRows: rows, libraryWallSlots: slots },
    });
  }

  const libraryWall = { cols, rows, slots };

  const allWorkIds = user.shelves.flatMap((s) => s.books.map((b) => b.work.id));
  const [commMap, readingMeta] = await Promise.all([
    getWorksCommunityStatsMap(prisma, allWorkIds),
    getLatestReadingMetaByWorkIds(prisma, session.user.id, allWorkIds),
  ]);
  const shelvesWithCommunity = user.shelves.map((shelf) => ({
    ...shelf,
    books: shelf.books.map((b) => {
      const meta = readingMeta.get(b.work.id);
      return {
        ...b,
        work: {
          ...mergeWorkCommunityStats(b.work, commMap),
          readingProgressPercent: meta?.progressPercent ?? null,
        },
      };
    }),
  }));

  return (
    <ShelfDashboard
      shelves={shelvesWithCommunity}
      username={user.username}
      displayName={user.displayName}
      libraryWall={libraryWall}
    />
  );
}
