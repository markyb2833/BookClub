import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createReadingSessionSchema,
  formatDayUTC,
  parseDay,
  highlightsSchema,
} from "@/lib/reading/readingSessionInput";
import type { Prisma } from "@prisma/client";

const include = {
  work: { select: { id: true, title: true, coverUrl: true } },
  edition: { select: { id: true, title: true, format: true } },
} as const;

function serialize(s: Prisma.ReadingSessionGetPayload<{ include: typeof include }>) {
  return {
    id: s.id,
    userId: s.userId,
    workId: s.workId,
    editionId: s.editionId,
    date: formatDayUTC(s.date),
    periodStart: formatDayUTC(s.periodStart),
    periodEnd: s.periodEnd ? formatDayUTC(s.periodEnd) : null,
    pagesRead: s.pagesRead,
    pagesTotal: s.pagesTotal,
    startPage: s.startPage,
    endPage: s.endPage,
    percentComplete: s.percentComplete,
    notes: s.notes,
    readingTimeMinutes: s.readingTimeMinutes,
    medium: s.medium,
    mediumNote: s.mediumNote,
    highlights: s.highlights,
    readCycle: s.readCycle,
    feedPostId: s.feedPostId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    work: s.work,
    edition: s.edition,
  };
}

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&workId= */
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

  const where: Prisma.ReadingSessionWhereInput = { userId };
  if (workId) {
    if (!/^[0-9a-f-]{36}$/i.test(workId)) {
      return NextResponse.json({ error: "Invalid workId" }, { status: 400 });
    }
    where.workId = workId;
  }
  if (fromS && toS) {
    try {
      const fromD = parseDay(fromS);
      const toD = parseDay(toS);
      where.AND = [
        { periodStart: { lte: toD } },
        { OR: [{ periodEnd: null }, { periodEnd: { gte: fromD } }] },
      ];
    } catch {
      return NextResponse.json({ error: "Invalid from/to date" }, { status: 400 });
    }
  }

  const rows = await prisma.readingSession.findMany({
    where,
    include,
    orderBy: [{ periodStart: "desc" }, { readCycle: "desc" }],
    take: 500,
  });

  return NextResponse.json({ sessions: rows.map(serialize) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createReadingSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  let periodStart: Date;
  let periodEnd: Date | null;
  let dateD: Date;
  try {
    periodStart = parseDay(b.periodStart);
    periodEnd = b.periodEnd === undefined || b.periodEnd === null ? null : parseDay(b.periodEnd);
    if (periodEnd && periodEnd < periodStart) {
      return NextResponse.json({ error: "periodEnd before periodStart" }, { status: 400 });
    }
    dateD = b.date ? parseDay(b.date) : new Date();
    dateD = new Date(Date.UTC(dateD.getUTCFullYear(), dateD.getUTCMonth(), dateD.getUTCDate()));
  } catch {
    return NextResponse.json({ error: "Invalid date fields" }, { status: 400 });
  }

  const hl = b.highlights !== undefined ? highlightsSchema.safeParse(b.highlights) : { success: true as const, data: undefined };
  if (!hl.success) {
    return NextResponse.json({ error: "Invalid highlights" }, { status: 400 });
  }
  const highlightsJson =
    hl.data !== undefined ? (hl.data as unknown as Prisma.InputJsonValue) : undefined;

  const work = await prisma.work.findUnique({ where: { id: b.workId }, select: { id: true } });
  if (!work) {
    return NextResponse.json({ error: "Work not found" }, { status: 404 });
  }

  if (b.editionId) {
    const ed = await prisma.edition.findFirst({
      where: { id: b.editionId, workId: b.workId },
      select: { id: true },
    });
    if (!ed) {
      return NextResponse.json({ error: "Edition not found for this work" }, { status: 400 });
    }
  }

  const readCycle =
    b.readCycle ??
    (await (async () => {
      const agg = await prisma.readingSession.aggregate({
        where: { userId, workId: b.workId },
        _max: { readCycle: true },
      });
      return (agg._max.readCycle ?? 0) + 1;
    })());

  const row = await prisma.readingSession.create({
    data: {
      userId,
      workId: b.workId,
      editionId: b.editionId ?? null,
      date: dateD,
      periodStart,
      periodEnd,
      pagesRead: b.pagesRead ?? 0,
      pagesTotal: b.pagesTotal ?? null,
      startPage: b.startPage ?? null,
      endPage: b.endPage ?? null,
      percentComplete: b.percentComplete ?? null,
      notes: b.notes ?? null,
      readingTimeMinutes: b.readingTimeMinutes ?? null,
      medium: b.medium ?? "paperback",
      mediumNote: b.mediumNote ?? null,
      highlights: highlightsJson ?? undefined,
      readCycle,
    },
    include,
  });

  return NextResponse.json({ session: serialize(row) });
}
