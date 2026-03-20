import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const placementSchema = z.object({
  workId: z.string().uuid(),
  sortOrder: z.number().int(),
  layoutXPct: z.number().min(0).max(100).optional(),
  layoutYPct: z.number().min(0).max(100).optional(),
  layoutZ: z.number().int().min(1).max(999).optional(),
});

const schema = z.object({
  order: z.array(placementSchema),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify shelf belongs to user
  const shelf = await prisma.shelf.findUnique({ where: { id }, select: { userId: true } });
  if (!shelf || shelf.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { order } = parsed.data;

  await prisma.$transaction(
    order.map((o) =>
      prisma.shelfBook.update({
        where: { shelfId_workId: { shelfId: id, workId: o.workId } },
        data: {
          sortOrder: o.sortOrder,
          ...(o.layoutXPct !== undefined ? { layoutXPct: o.layoutXPct } : {}),
          ...(o.layoutYPct !== undefined ? { layoutYPct: o.layoutYPct } : {}),
          ...(o.layoutZ !== undefined ? { layoutZ: o.layoutZ } : {}),
        },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
