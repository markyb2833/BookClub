import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  formatDayUTC,
  parseDay,
  patchReadingSessionSchema,
  highlightsSchema,
} from "@/lib/reading/readingSessionInput";
import { Prisma } from "@prisma/client";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const row = await prisma.readingSession.findFirst({
    where: { id, userId: session.user.id },
    include,
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session: serialize(row) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.readingSession.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      workId: true,
      periodStart: true,
      periodEnd: true,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchReadingSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  const data: Prisma.ReadingSessionUpdateInput = {};

  if (b.date !== undefined) {
    try {
      data.date = parseDay(b.date);
    } catch {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
  }
  if (b.periodStart !== undefined) {
    try {
      data.periodStart = parseDay(b.periodStart);
    } catch {
      return NextResponse.json({ error: "Invalid periodStart" }, { status: 400 });
    }
  }
  if (b.periodEnd !== undefined) {
    if (b.periodEnd === null) {
      data.periodEnd = null;
    } else {
      try {
        data.periodEnd = parseDay(b.periodEnd);
      } catch {
        return NextResponse.json({ error: "Invalid periodEnd" }, { status: 400 });
      }
    }
  }
  if (b.pagesRead !== undefined) data.pagesRead = b.pagesRead;
  if (b.pagesTotal !== undefined) data.pagesTotal = b.pagesTotal;
  if (b.startPage !== undefined) data.startPage = b.startPage;
  if (b.endPage !== undefined) data.endPage = b.endPage;
  if (b.percentComplete !== undefined) data.percentComplete = b.percentComplete;
  if (b.notes !== undefined) data.notes = b.notes;
  if (b.readingTimeMinutes !== undefined) data.readingTimeMinutes = b.readingTimeMinutes;
  if (b.medium !== undefined) data.medium = b.medium;
  if (b.mediumNote !== undefined) data.mediumNote = b.mediumNote;
  if (b.readCycle !== undefined) data.readCycle = b.readCycle;

  if (b.highlights !== undefined) {
    if (b.highlights === null) {
      data.highlights = Prisma.DbNull;
    } else {
      const hl = highlightsSchema.safeParse(b.highlights);
      if (!hl.success) {
        return NextResponse.json({ error: "Invalid highlights" }, { status: 400 });
      }
      data.highlights = hl.data as unknown as Prisma.InputJsonValue;
    }
  }

  if (b.editionId !== undefined) {
    if (b.editionId === null) {
      data.edition = { disconnect: true };
    } else {
      const ed = await prisma.edition.findFirst({
        where: { id: b.editionId, workId: existing.workId },
        select: { id: true },
      });
      if (!ed) {
        return NextResponse.json({ error: "Edition not found for this work" }, { status: 400 });
      }
      data.edition = { connect: { id: b.editionId } };
    }
  }

  let nextStart = existing.periodStart;
  let nextEnd = existing.periodEnd;
  if (b.periodStart !== undefined) {
    try {
      nextStart = parseDay(b.periodStart);
    } catch {
      return NextResponse.json({ error: "Invalid periodStart" }, { status: 400 });
    }
  }
  if (b.periodEnd !== undefined) {
    if (b.periodEnd === null) nextEnd = null;
    else {
      try {
        nextEnd = parseDay(b.periodEnd);
      } catch {
        return NextResponse.json({ error: "Invalid periodEnd" }, { status: 400 });
      }
    }
  }
  if (nextEnd && nextEnd < nextStart) {
    return NextResponse.json({ error: "periodEnd before periodStart" }, { status: 400 });
  }

  const row = await prisma.readingSession.update({
    where: { id },
    data,
    include,
  });

  return NextResponse.json({ session: serialize(row) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const del = await prisma.readingSession.deleteMany({
    where: { id, userId: session.user.id },
  });
  if (del.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
