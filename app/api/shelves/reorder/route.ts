import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  order: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const { order } = parsed.data;
  const ids = order.map((o) => o.id);

  // Verify all shelves belong to this user
  const shelves = await prisma.shelf.findMany({ where: { id: { in: ids }, userId: session.user.id }, select: { id: true } });
  if (shelves.length !== ids.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(order.map((o) => prisma.shelf.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })));

  return NextResponse.json({ ok: true });
}
