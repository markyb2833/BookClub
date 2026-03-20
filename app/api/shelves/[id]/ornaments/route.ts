import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateOrnamentDataImageUrl } from "@/lib/shelves/ornamentImage";
import { z } from "zod";

async function assertOwnShelf(shelfId: string, userId: string) {
  const shelf = await prisma.shelf.findUnique({ where: { id: shelfId }, select: { userId: true } });
  if (!shelf || shelf.userId !== userId) return null;
  return shelf;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwnShelf(id, session.user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ornaments = await prisma.shelfOrnament.findMany({ where: { shelfId: id }, orderBy: { zIndex: "asc" } });
  return NextResponse.json(ornaments);
}

const createSchema = z
  .object({
    glyph: z.string().max(32).optional(),
    imageUrl: z.string().max(350_000).optional(),
    xPct: z.number().min(0).max(100),
    yPct: z.number().min(0).max(100),
    zIndex: z.number().int().min(1).max(999).optional(),
    scale: z.number().min(0.4).max(2.5).optional(),
  })
  .superRefine((data, ctx) => {
    const g = (data.glyph ?? "").trim();
    const img = (data.imageUrl ?? "").trim();
    if (!img && !g) {
      ctx.addIssue({ code: "custom", message: "Add an emoji or an image", path: ["glyph"] });
    }
    if (img) {
      const err = validateOrnamentDataImageUrl(img);
      if (err) ctx.addIssue({ code: "custom", message: err, path: ["imageUrl"] });
    }
  });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await assertOwnShelf(id, session.user.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const glyph = (parsed.data.glyph ?? "").trim().slice(0, 32);
  const imageUrl = parsed.data.imageUrl?.trim() || null;
  const { xPct, yPct, zIndex, scale } = parsed.data;

  const ornament = await prisma.shelfOrnament.create({
    data: {
      shelfId: id,
      glyph,
      imageUrl,
      xPct,
      yPct,
      zIndex: zIndex ?? 32,
      scale: scale ?? 1,
    },
  });

  return NextResponse.json(ornament, { status: 201 });
}
