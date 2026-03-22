import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestReadingMetaByWorkIds } from "@/lib/reading/workReadingProgress";

/** Books on the user’s “Currently Reading” shelf — for quick read-session logging. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shelf = await prisma.shelf.findUnique({
    where: {
      userId_slug: { userId: session.user.id, slug: "currently-reading" },
    },
    include: {
      books: {
        orderBy: [{ sortOrder: "asc" }, { addedAt: "desc" }],
        take: 80,
        select: {
          editionId: true,
          addedAt: true,
          work: { select: { id: true, title: true, coverUrl: true } },
        },
      },
    },
  });

  if (!shelf) {
    return NextResponse.json({ books: [] });
  }

  const workIds = shelf.books.map((b) => b.work.id);
  const metaByWork = await getLatestReadingMetaByWorkIds(prisma, session.user.id, workIds);

  const sorted = [...shelf.books].sort((a, b) => {
    const ta = metaByWork.get(a.work.id)?.lastActivityAt.getTime() ?? 0;
    const tb = metaByWork.get(b.work.id)?.lastActivityAt.getTime() ?? 0;
    if (tb !== ta) return tb - ta;
    return b.addedAt.getTime() - a.addedAt.getTime();
  });

  return NextResponse.json({
    books: sorted.map((b) => ({
      workId: b.work.id,
      title: b.work.title,
      coverUrl: b.work.coverUrl,
      editionId: b.editionId,
    })),
  });
}
