import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  layoutXPct: z.number().min(0).max(100).optional(),
  layoutYPct: z.number().min(0).max(100).optional(),
  layoutZ: z.number().int().min(1).max(999).optional(),
  sceneDisplay: z.enum(["spine", "cover"]).nullable().optional(),
  sceneWidthMul: z.number().min(0.35).max(2).nullable().optional(),
  sceneHeightMul: z.number().min(0.35).max(2).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; workId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workId } = await params;
  const shelf = await prisma.shelf.findUnique({ where: { id } });
  if (!shelf || shelf.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const row = await prisma.shelfBook.findUnique({
    where: { shelfId_workId: { shelfId: id, workId } },
  });
  if (!row) return NextResponse.json({ error: "Not on shelf" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const p = parsed.data;
  if (p.layoutXPct !== undefined) data.layoutXPct = p.layoutXPct;
  if (p.layoutYPct !== undefined) data.layoutYPct = p.layoutYPct;
  if (p.layoutZ !== undefined) data.layoutZ = p.layoutZ;
  if (p.sceneDisplay !== undefined) data.sceneDisplay = p.sceneDisplay;
  if (p.sceneWidthMul !== undefined) data.sceneWidthMul = p.sceneWidthMul;
  if (p.sceneHeightMul !== undefined) data.sceneHeightMul = p.sceneHeightMul;

  const updated = await prisma.shelfBook.update({
    where: { shelfId_workId: { shelfId: id, workId } },
    data,
    include: {
      work: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          averageRating: true,
          workAuthors: { select: { author: { select: { name: true } } }, take: 3 },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; workId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workId } = await params;
  const shelf = await prisma.shelf.findUnique({ where: { id } });
  if (!shelf || shelf.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.shelfBook.delete({ where: { shelfId_workId: { shelfId: id, workId } } });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return NextResponse.json({ error: "Not on shelf" }, { status: 404 });
    throw e;
  }

  return NextResponse.json({ ok: true });
}
