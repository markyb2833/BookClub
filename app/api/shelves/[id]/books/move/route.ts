import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  workId: z.string(),
  fromShelfId: z.string(),
  sortOrder: z.number().int().optional(),
  layoutXPct: z.number().min(0).max(100).optional(),
  layoutYPct: z.number().min(0).max(100).optional(),
  layoutZ: z.number().int().min(1).max(999).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: toShelfId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { workId, fromShelfId, sortOrder, layoutXPct, layoutYPct, layoutZ } = parsed.data;

  // Verify both shelves belong to the user
  const [fromShelf, toShelf] = await Promise.all([
    prisma.shelf.findUnique({ where: { id: fromShelfId }, select: { userId: true } }),
    prisma.shelf.findUnique({ where: { id: toShelfId }, select: { userId: true } }),
  ]);
  if (!fromShelf || fromShelf.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!toShelf || toShelf.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (fromShelfId === toShelfId) return NextResponse.json({ ok: true });

  const countOnTarget = await prisma.shelfBook.count({ where: { shelfId: toShelfId } });
  const idx = countOnTarget;
  const defaultX = 8 + (idx % 12) * (84 / 11);
  const defaultY = 16 + Math.floor(idx / 12) * 26;

  await prisma.$transaction([
    prisma.shelfBook.delete({ where: { shelfId_workId: { shelfId: fromShelfId, workId } } }),
    prisma.shelfBook.upsert({
      where: { shelfId_workId: { shelfId: toShelfId, workId } },
      create: {
        shelfId: toShelfId,
        workId,
        sortOrder: sortOrder ?? idx * 10,
        layoutXPct: layoutXPct ?? defaultX,
        layoutYPct: layoutYPct ?? defaultY,
        layoutZ: layoutZ ?? 5,
      },
      update: {
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(layoutXPct !== undefined ? { layoutXPct } : {}),
        ...(layoutYPct !== undefined ? { layoutYPct } : {}),
        ...(layoutZ !== undefined ? { layoutZ } : {}),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
