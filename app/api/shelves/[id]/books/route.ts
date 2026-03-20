import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const addSchema = z.object({
  workId: z.string().uuid(),
  editionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const shelf = await prisma.shelf.findUnique({ where: { id } });
  if (!shelf || shelf.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { workId, editionId } = parsed.data;

  const before = await prisma.shelfBook.findUnique({
    where: { shelfId_workId: { shelfId: id, workId } },
  });

  const entry = await prisma.shelfBook.upsert({
    where: { shelfId_workId: { shelfId: id, workId } },
    create: { shelfId: id, workId, editionId },
    update: editionId ? { editionId } : {},
  });

  if (!before) {
    const cnt = await prisma.shelfBook.count({ where: { shelfId: id } });
    const idx = cnt - 1;
    await prisma.shelfBook.update({
      where: { shelfId_workId: { shelfId: id, workId } },
      data: {
        sortOrder: idx * 10,
        layoutXPct: 8 + (idx % 12) * (84 / 11),
        layoutYPct: 16 + Math.floor(idx / 12) * 26,
        layoutZ: 5,
      },
    });
    const refreshed = await prisma.shelfBook.findUnique({
      where: { shelfId_workId: { shelfId: id, workId } },
    });
    return NextResponse.json(refreshed ?? entry, { status: 201 });
  }

  return NextResponse.json(entry, { status: 201 });
}
