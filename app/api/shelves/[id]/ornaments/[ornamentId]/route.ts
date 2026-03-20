import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateOrnamentDataImageUrl } from "@/lib/shelves/ornamentImage";
import { z } from "zod";

const patchSchema = z
  .object({
    glyph: z.string().max(32).optional(),
    imageUrl: z.union([z.string().max(350_000), z.null()]).optional(),
    xPct: z.number().min(0).max(100).optional(),
    yPct: z.number().min(0).max(100).optional(),
    zIndex: z.number().int().min(1).max(999).optional(),
    scale: z.number().min(0.4).max(2.5).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.imageUrl === undefined) return;
    if (data.imageUrl === null) return;
    const err = validateOrnamentDataImageUrl(data.imageUrl);
    if (err) ctx.addIssue({ code: "custom", message: err, path: ["imageUrl"] });
  });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; ornamentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ornamentId } = await params;

  const ornament = await prisma.shelfOrnament.findFirst({
    where: { id: ornamentId, shelfId: id, shelf: { userId: session.user.id } },
  });
  if (!ornament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const patch = { ...parsed.data };
  if (patch.glyph !== undefined) patch.glyph = patch.glyph.trim().slice(0, 32);

  const updated = await prisma.shelfOrnament.update({
    where: { id: ornamentId },
    data: patch,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; ornamentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ornamentId } = await params;

  const ornament = await prisma.shelfOrnament.findFirst({
    where: { id: ornamentId, shelfId: id, shelf: { userId: session.user.id } },
  });
  if (!ornament) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.shelfOrnament.delete({ where: { id: ornamentId } });
  return NextResponse.json({ ok: true });
}
