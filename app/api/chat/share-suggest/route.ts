import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { meili } from "@/lib/meilisearch";
import { setupBooksIndex } from "@/lib/meilisearch-setup";
import { getBlockedPeerIds } from "@/lib/social/blocking";

/** Book search hits (Meilisearch document shape, loose). */
type BookHit = Record<string, unknown> & { id?: string; title?: string };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope") ?? "at";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const shelvesFor = req.nextUrl.searchParams.get("shelvesFor")?.trim() ?? "";

  if (scope === "shelves") {
    if (!shelvesFor) {
      return NextResponse.json({ shelves: [] as { slug: string; name: string; emoji: string | null }[] });
    }
    const user = await prisma.user.findFirst({
      where: { username: { equals: shelvesFor, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ shelves: [] });
    }
    const blocked = await getBlockedPeerIds(session.user.id);
    if (blocked.has(user.id)) {
      return NextResponse.json({ shelves: [] });
    }

    const shelves = await prisma.shelf.findMany({
      where: { userId: user.id, isPublic: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 30,
      select: { slug: true, name: true, emoji: true },
    });
    return NextResponse.json({ shelves });
  }

  if (scope === "user") {
    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }
    const blocked = await getBlockedPeerIds(session.user.id);
    const blockedIds = [...blocked];
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
            ],
          },
          { OR: [{ settings: null }, { settings: { is: { profilePublic: true } } }] },
          ...(blockedIds.length > 0 ? [{ id: { notIn: blockedIds } }] : []),
        ],
      },
      take: 10,
      orderBy: { username: "asc" },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    return NextResponse.json({ users });
  }

  const books: BookHit[] = [];
  let authors: { id: string; name: string }[] = [];

  if (q.length >= 1) {
    await setupBooksIndex();
    const index = meili.index("works");
    const wordCount = q.trim().split(/\s+/).filter(Boolean).length;
    const result = await index.search(q, {
      limit: 10,
      ...(wordCount >= 4 ? { matchingStrategy: "all" as const } : {}),
    });
    books.push(...(result.hits as BookHit[]));
  }

  if (q.length >= 2) {
    authors = await prisma.author.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 10,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }

  return NextResponse.json({ books, authors });
}
