import type { PrismaClient } from "@prisma/client";
import type { ChatLinkPreview } from "./chatLinkPreviewTypes";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function displayHref(u: URL): string {
  return `${u.pathname}${u.search}${u.hash}`;
}

async function browseSubtitle(prisma: PrismaClient, sp: URLSearchParams): Promise<string | null> {
  const parts: string[] = [];
  const q = sp.get("q")?.trim();
  if (q) parts.push(q.length > 48 ? `${q.slice(0, 47)}…` : `“${q}”`);
  const genreSlug = sp.get("genre");
  if (genreSlug) {
    const g = await prisma.genre.findUnique({ where: { slug: genreSlug }, select: { name: true } });
    parts.push(g?.name ?? "Genre");
  }
  const authorId = sp.get("author");
  if (authorId && UUID.test(authorId)) {
    const a = await prisma.author.findUnique({ where: { id: authorId }, select: { name: true } });
    if (a) parts.push(a.name);
  }
  const seriesSlug = sp.get("series");
  if (seriesSlug) {
    const s = await prisma.series.findUnique({ where: { slug: seriesSlug }, select: { name: true } });
    if (s) parts.push(s.name);
  }
  const sort = sp.get("sort");
  if (sort && sort !== "popular") parts.push(`Sort: ${sort}`);
  const page = sp.get("page");
  if (page && page !== "1") parts.push(`Page ${page}`);
  return parts.length ? parts.join(" · ") : null;
}

export async function resolveChatLinkPreview(
  prisma: PrismaClient,
  absoluteUrl: URL,
  viewerId: string | null,
): Promise<ChatLinkPreview | null> {
  const pathname = absoluteUrl.pathname.replace(/\/+$/, "") || "/";
  const sp = absoluteUrl.searchParams;
  const href = displayHref(absoluteUrl);

  if (pathname === "/books") {
    const subtitle = await browseSubtitle(prisma, sp);
    return { kind: "browse", title: "Books", subtitle, href };
  }

  const bookMatch = pathname.match(/^\/books\/([0-9a-f-]{36})$/i);
  if (bookMatch) {
    const work = await prisma.work.findUnique({
      where: { id: bookMatch[1] },
      include: { workAuthors: { take: 4, orderBy: { authorId: "asc" }, include: { author: true } } },
    });
    if (!work) {
      return { kind: "generic", title: "Book", subtitle: "Not found in BookClub", href };
    }
    const authors = work.workAuthors.map((wa) => wa.author.name).join(", ");
    const subtitle = [authors, work.subtitle].filter(Boolean).join(" · ") || null;
    return {
      kind: "book",
      title: work.title,
      subtitle,
      href,
      imageUrl: work.coverUrl,
    };
  }

  if (pathname === "/search") {
    const q = sp.get("q")?.trim();
    return {
      kind: "search",
      title: "Search",
      subtitle: q ? (q.length > 56 ? `${q.slice(0, 55)}…` : q) : "Books & people",
      href,
    };
  }

  if (pathname === "/shelves") {
    return { kind: "shelves", title: "My shelves", subtitle: "Library wall & shelves", href };
  }

  const uLib = pathname.match(/^\/u\/([^/]+)$/);
  const uProfile = pathname.match(/^\/u\/([^/]+)\/profile$/);
  const uShelf = pathname.match(/^\/u\/([^/]+)\/shelves\/([^/]+)$/);

  if (uShelf) {
    const username = decodeURIComponent(uShelf[1]);
    const slug = decodeURIComponent(uShelf[2]);
    const owner = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, displayName: true },
    });
    if (!owner) {
      return { kind: "generic", title: "Shelf", subtitle: "User not found", href };
    }
    const shelf = await prisma.shelf.findFirst({
      where: { userId: owner.id, slug: { equals: slug, mode: "insensitive" } },
      select: { name: true, emoji: true, isPublic: true, userId: true },
    });
    if (!shelf) {
      return { kind: "generic", title: "Shelf", subtitle: "Not found", href };
    }
    const isViewer = viewerId && viewerId === owner.id;
    if (!shelf.isPublic && !isViewer) {
      return {
        kind: "generic",
        title: "Shelf",
        subtitle: "Private — open in BookClub to view",
        href,
      };
    }
    return {
      kind: "publicShelf",
      title: shelf.name,
      subtitle: `@${owner.username}`,
      href,
      emoji: shelf.emoji,
    };
  }

  if (uProfile) {
    const username = decodeURIComponent(uProfile[1]);
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, displayName: true, avatarUrl: true, settings: { select: { profilePublic: true } } },
    });
    if (!user) {
      return { kind: "generic", title: "Profile", subtitle: "User not found", href };
    }
    const isViewer = viewerId && viewerId === user.id;
    const profilePublic = user.settings?.profilePublic ?? true;
    if (!profilePublic && !isViewer) {
      return { kind: "generic", title: "Profile", subtitle: "Private profile", href };
    }
    return {
      kind: "profile",
      title: user.displayName ?? user.username,
      subtitle: `@${user.username}`,
      href,
      imageUrl: user.avatarUrl,
    };
  }

  if (uLib) {
    const username = decodeURIComponent(uLib[1]);
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true, displayName: true, avatarUrl: true, settings: { select: { profilePublic: true } } },
    });
    if (!user) {
      return { kind: "generic", title: "Library", subtitle: "User not found", href };
    }
    const isViewer = viewerId && viewerId === user.id;
    const profilePublicLib = user.settings?.profilePublic ?? true;
    if (!profilePublicLib && !isViewer) {
      return { kind: "generic", title: "Library", subtitle: "Private profile", href };
    }
    return {
      kind: "userLibrary",
      title: `${user.displayName ?? user.username}’s library`,
      subtitle: "Public shelves",
      href,
      imageUrl: user.avatarUrl,
    };
  }

  return null;
}
