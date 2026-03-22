import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDayUTC, parseDay } from "@/lib/reading/readingSessionInput";
import { countHighlightEntries } from "@/lib/reading/highlightHelpers";
import { splitIntegerEvenly, utcDayKeysInOverlap } from "@/lib/reading/splitReadingMinutes";

const WEEKDAY_LABELS_MON0 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function calendarDaysInclusive(from: Date, to: Date): number {
  let n = 0;
  const walk = new Date(from.getTime());
  while (walk.getTime() <= to.getTime()) {
    n++;
    walk.setUTCDate(walk.getUTCDate() + 1);
  }
  return n;
}

function utcDayKey(d: Date): string {
  return formatDayUTC(d);
}

/** Monday = 0 … Sunday = 6 (UTC) */
function weekdayMon0FromDate(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = req.nextUrl;
  const fromS = searchParams.get("from");
  const toS = searchParams.get("to");
  const workId = searchParams.get("workId");
  const authorQ = searchParams.get("author")?.trim() ?? "";

  let rangeStart: Date;
  let rangeEnd: Date;
  try {
    const toD = toS ? parseDay(toS) : new Date();
    rangeEnd = new Date(Date.UTC(toD.getUTCFullYear(), toD.getUTCMonth(), toD.getUTCDate()));
    if (fromS) {
      rangeStart = parseDay(fromS);
      rangeStart = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
    } else {
      const back = new Date(rangeEnd.getTime());
      back.setUTCDate(back.getUTCDate() - 89);
      rangeStart = back;
    }
  } catch {
    return NextResponse.json({ error: "Invalid from or to date (YYYY-MM-DD)" }, { status: 400 });
  }

  if (rangeEnd < rangeStart) {
    return NextResponse.json({ error: "to must be on or after from" }, { status: 400 });
  }

  if (workId && !/^[0-9a-f-]{36}$/i.test(workId)) {
    return NextResponse.json({ error: "Invalid workId" }, { status: 400 });
  }

  const rows = await prisma.readingSession.findMany({
    where: {
      userId,
      ...(workId ? { workId } : {}),
      periodStart: { lte: rangeEnd },
      OR: [{ periodEnd: null }, { periodEnd: { gte: rangeStart } }],
    },
    include: {
      work: {
        select: {
          id: true,
          title: true,
          workAuthors: {
            include: { author: { select: { id: true, name: true } } },
          },
          workGenres: {
            include: { genre: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: [{ periodStart: "desc" }, { readCycle: "desc" }],
    take: 2_000,
  });

  const authorNeedle = authorQ.length > 0 ? authorQ.toLowerCase() : "";

  const filtered = rows.filter((r) => {
    if (!authorNeedle) return true;
    const names = r.work.workAuthors.map((wa) => wa.author.name.toLowerCase());
    return names.some((n) => n.includes(authorNeedle));
  });

  let totalPages = 0;
  let totalMinutes = 0;
  let minutesKnown = 0;
  const activeDates = new Set<string>();
  /** Per UTC day: minutes from each session split evenly across that session’s period (clipped to the stats range). */
  const minutesByDay = new Map<string, number>();
  const weekdayPages = new Map<number, number>();
  const genrePages = new Map<string, number>();
  const authorPages = new Map<string, number>();
  let totalHighlightEntries = 0;
  let sessionsWithHighlights = 0;
  const highlightsByWork = new Map<string, { title: string; count: number }>();

  for (const r of filtered) {
    const hlCount = countHighlightEntries(r.highlights);
    if (hlCount > 0) {
      totalHighlightEntries += hlCount;
      sessionsWithHighlights += 1;
      const prev = highlightsByWork.get(r.workId);
      highlightsByWork.set(r.workId, {
        title: r.work.title,
        count: (prev?.count ?? 0) + hlCount,
      });
    }

    totalPages += r.pagesRead;
    if (r.readingTimeMinutes != null && r.readingTimeMinutes > 0) {
      totalMinutes += r.readingTimeMinutes;
      minutesKnown += 1;
      const dayKeys = utcDayKeysInOverlap(r.periodStart, r.periodEnd, rangeStart, rangeEnd);
      if (dayKeys.length > 0) {
        const splits = splitIntegerEvenly(r.readingTimeMinutes, dayKeys.length);
        for (let i = 0; i < dayKeys.length; i++) {
          const k = dayKeys[i]!;
          minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + splits[i]!);
        }
      }
    }

    const act = utcDayKey(r.date);
    if (act >= formatDayUTC(rangeStart) && act <= formatDayUTC(rangeEnd)) {
      activeDates.add(act);
    }

    const wd = weekdayMon0FromDate(r.date);
    weekdayPages.set(wd, (weekdayPages.get(wd) ?? 0) + r.pagesRead);

    const genres = r.work.workGenres.map((wg) => wg.genre.name).sort();
    if (genres.length > 0) {
      const share = r.pagesRead / genres.length;
      for (const g of genres) {
        genrePages.set(g, (genrePages.get(g) ?? 0) + share);
      }
    }

    const authors = [...r.work.workAuthors]
      .map((wa) => ({ id: wa.author.id, name: wa.author.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (authors.length > 0) {
      const primary = authors[0]!.name;
      authorPages.set(primary, (authorPages.get(primary) ?? 0) + r.pagesRead);
    }
  }

  const spanDays = calendarDaysInclusive(rangeStart, rangeEnd);
  const activeDayCount = activeDates.size;
  const distinctReadingDaysWithMinutes = [...minutesByDay.entries()].filter(([, v]) => v > 0).length;
  const sumMinutesAllocated = [...minutesByDay.values()].reduce((a, b) => a + b, 0);
  const avgMinutesPerReadingDay =
    distinctReadingDaysWithMinutes > 0 && sumMinutesAllocated > 0
      ? Math.round((sumMinutesAllocated / distinctReadingDaysWithMinutes) * 10) / 10
      : 0;

  function topEntry(m: Map<string, number>): { name: string; pages: number } | null {
    let best: { name: string; pages: number } | null = null;
    for (const [name, pages] of m) {
      if (!best || pages > best.pages) best = { name, pages: Math.round(pages * 10) / 10 };
    }
    return best;
  }

  function pickTopWeekday(): { label: string; index: number; pages: number } | null {
    let bestI: number | null = null;
    let bestP = 0;
    for (let i = 0; i < 7; i++) {
      const p = weekdayPages.get(i) ?? 0;
      if (p > bestP) {
        bestP = p;
        bestI = i;
      }
    }
    if (bestI == null || bestP <= 0) return null;
    return { label: WEEKDAY_LABELS_MON0[bestI], index: bestI, pages: Math.round(bestP * 10) / 10 };
  }

  const topGenre = topEntry(genrePages);
  const topAuthor = topEntry(authorPages);
  const topWeekday = pickTopWeekday();

  let topBookByHighlights: { workId: string; title: string; highlights: number } | null = null;
  for (const [workId, v] of highlightsByWork) {
    if (!topBookByHighlights || v.count > topBookByHighlights.highlights) {
      topBookByHighlights = { workId, title: v.title, highlights: v.count };
    }
  }
  const booksWithHighlights = highlightsByWork.size;
  const avgHighlightsPerSession =
    filtered.length > 0 ? Math.round((totalHighlightEntries / filtered.length) * 10) / 10 : 0;

  const overlapWhere = {
    userId,
    periodStart: { lte: rangeEnd },
    OR: [{ periodEnd: null }, { periodEnd: { gte: rangeStart } }],
  };

  /** Distinct works in this date range (for searchable filter UI). */
  const workIdsInRange = await prisma.readingSession.groupBy({
    by: ["workId"],
    where: overlapWhere,
  });

  const workIdList = workIdsInRange.map((g) => g.workId);
  const worksInRange =
    workIdList.length === 0
      ? []
      : await prisma.work.findMany({
          where: { id: { in: workIdList } },
          select: {
            id: true,
            title: true,
            workAuthors: { include: { author: { select: { name: true } } } },
          },
        });

  const workOptions = worksInRange
    .map((w) => ({ id: w.id, title: w.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const authorSet = new Set<string>();
  for (const w of worksInRange) {
    for (const wa of w.workAuthors) {
      authorSet.add(wa.author.name);
    }
  }
  const authorOptions = [...authorSet].sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    from: formatDayUTC(rangeStart),
    to: formatDayUTC(rangeEnd),
    filters: {
      workId: workId || null,
      author: authorQ || null,
    },
    sessionCount: filtered.length,
    totalHighlightEntries,
    sessionsWithHighlights,
    booksWithHighlights,
    avgHighlightsPerSession,
    topBookByHighlights,
    totalPages,
    totalMinutesLogged: totalMinutes,
    sessionsWithMinutes: minutesKnown,
    calendarSpanDays: spanDays,
    distinctActivityDays: activeDayCount,
    distinctReadingDaysWithMinutes,
    avgPagesPerCalendarDay: spanDays > 0 ? Math.round((totalPages / spanDays) * 10) / 10 : 0,
    avgPagesPerActivityDay: activeDayCount > 0 ? Math.round((totalPages / activeDayCount) * 10) / 10 : 0,
    avgMinutesPerReadingDay,
    favouriteGenre: topGenre,
    favouriteAuthor: topAuthor,
    favouriteWeekday: topWeekday,
    workOptions,
    authorOptions,
  });
}
