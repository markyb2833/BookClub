import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clampWallCols, clampWallRows, type WallSlots } from "@/lib/shelves/libraryWall";
import { z } from "zod";

const schema = z.object({
  wallCols: z.number().int().min(1).max(4),
  wallRows: z.number().int().min(1).max(3),
  slots: z.array(z.union([z.string().uuid(), z.null()])),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });

  const wallCols = clampWallCols(parsed.data.wallCols);
  const wallRows = clampWallRows(parsed.data.wallRows);
  const need = wallCols * wallRows;
  let slots: WallSlots = parsed.data.slots.slice(0, need);
  while (slots.length < need) slots.push(null);
  if (slots.length > need) slots = slots.slice(0, need);

  const owned = await prisma.shelf.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });
  const allowed = new Set(owned.map((s) => s.id));
  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    if (id && !allowed.has(id)) slots[i] = null;
  }

  const seen = new Set<string>();
  for (let i = 0; i < slots.length; i++) {
    const id = slots[i];
    if (!id) continue;
    if (seen.has(id)) slots[i] = null;
    else seen.add(id);
  }

  await prisma.userSettings.update({
    where: { userId: session.user.id },
    data: { libraryWallCols: wallCols, libraryWallRows: wallRows, libraryWallSlots: slots },
  });

  return NextResponse.json({ wallCols, wallRows, slots });
}
