import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDayUTC } from "@/lib/reading/readingSessionInput";

type DayEntry = {
  id: string;
  workId: string;
  title: string;
  coverUrl: string | null;
  medium: string;
  readCycle: number;
  periodStart: string;
  periodEnd: string | null;
  pagesRead: number;
  feedPostId: string | null;
};

/** GET ?year=2026&month=3 (month 1–12) */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const y = parseInt(req.nextUrl.searchParams.get("year") ?? "", 10);
  const m = parseInt(req.nextUrl.searchParams.get("month") ?? "", 10);
  if (!Number.isFinite(y) || y < 1970 || y > 2100 || !Number.isFinite(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: "Invalid year or month (month 1–12)" }, { status: 400 });
  }

  const mi = m - 1;
  const rangeStart = new Date(Date.UTC(y, mi, 1));
  const rangeEnd = new Date(Date.UTC(y, mi + 1, 0));

  const rows = await prisma.readingSession.findMany({
    where: {
      userId,
      periodStart: { lte: rangeEnd },
      OR: [{ periodEnd: null }, { periodEnd: { gte: rangeStart } }],
    },
    select: {
      id: true,
      workId: true,
      periodStart: true,
      periodEnd: true,
      pagesRead: true,
      medium: true,
      readCycle: true,
      feedPostId: true,
      work: { select: { title: true, coverUrl: true } },
    },
    orderBy: [{ periodStart: "asc" }, { readCycle: "asc" }],
  });

  const days: Record<string, DayEntry[]> = {};

  function addDay(ts: Date, entry: DayEntry) {
    const key = formatDayUTC(ts);
    if (!days[key]) days[key] = [];
    if (!days[key].some((e) => e.id === entry.id)) {
      days[key].push(entry);
    }
  }

  for (const r of rows) {
    const entry: DayEntry = {
      id: r.id,
      workId: r.workId,
      title: r.work.title,
      coverUrl: r.work.coverUrl,
      medium: r.medium,
      readCycle: r.readCycle,
      periodStart: formatDayUTC(r.periodStart),
      periodEnd: r.periodEnd ? formatDayUTC(r.periodEnd) : null,
      pagesRead: r.pagesRead,
      feedPostId: r.feedPostId,
    };

    const start = r.periodStart.getTime();
    const end = r.periodEnd ? r.periodEnd.getTime() : rangeEnd.getTime();
    const clipStart = Math.max(start, rangeStart.getTime());
    const clipEnd = Math.min(end, rangeEnd.getTime());
    if (clipEnd < clipStart) continue;

    const walk = new Date(clipStart);
    while (walk.getTime() <= clipEnd) {
      addDay(new Date(walk.getTime()), entry);
      walk.setUTCDate(walk.getUTCDate() + 1);
    }
  }

  return NextResponse.json({ year: y, month: m, days });
}
