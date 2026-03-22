import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getHighlightEntries } from "@/lib/reading/highlightHelpers";

/** Latest highlight passages across your logs (newest sessions first). GET ?limit=10 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const lim = Math.min(30, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10));

  const rows = await prisma.readingSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 120,
    select: {
      id: true,
      updatedAt: true,
      workId: true,
      highlights: true,
      work: { select: { title: true } },
    },
  });

  type Item = {
    sessionId: string;
    workId: string;
    workTitle: string;
    text: string;
    page?: number;
    note?: string;
    updatedAt: string;
  };
  const out: Item[] = [];

  for (const r of rows) {
    const entries = getHighlightEntries(r.highlights);
    for (const e of entries) {
      if (!e.text.trim()) continue;
      out.push({
        sessionId: r.id,
        workId: r.workId,
        workTitle: r.work.title,
        text: e.text.trim(),
        ...(e.page !== undefined ? { page: e.page } : {}),
        ...(e.note?.trim() ? { note: e.note.trim() } : {}),
        updatedAt: r.updatedAt.toISOString(),
      });
      if (out.length >= lim) break;
    }
    if (out.length >= lim) break;
  }

  return NextResponse.json({ highlights: out });
}
