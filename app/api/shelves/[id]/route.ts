import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { z } from "zod";

const lightingValues = ["none", "warm", "cool", "lamp", "fairy", "midnight"] as const;

const bookDisplayValues = ["spine", "cover"] as const;

const editSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().max(10).nullable().optional(),
  isPublic: z.boolean().optional(),
  bgColour: z.string().max(20).nullable().optional(),
  accentColour: z.string().max(20).nullable().optional(),
  titleColour: z.string().max(20).nullable().optional(),
  lightingPreset: z.enum(lightingValues).nullable().optional(),
  sceneTierCount: z.number().int().min(2).max(5).optional(),
  sceneBookDisplay: z.enum(bookDisplayValues).optional(),
  sceneBookWidthMul: z.number().min(0.35).max(2).optional(),
  sceneBookHeightMul: z.number().min(0.35).max(2).optional(),
});

async function getOwnedShelf(id: string, userId: string) {
  const shelf = await prisma.shelf.findUnique({ where: { id } });
  if (!shelf || shelf.userId !== userId) return null;
  return shelf;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const shelf = await getOwnedShelf(id, session.user.id);
  if (!shelf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (shelf.isDefault) return NextResponse.json({ error: "Cannot delete a default shelf" }, { status: 400 });

  await prisma.shelf.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const shelf = await getOwnedShelf(id, session.user.id);
  if (!shelf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const {
    name,
    description,
    emoji,
    isPublic,
    bgColour,
    accentColour,
    titleColour,
    lightingPreset,
    sceneTierCount,
    sceneBookDisplay,
    sceneBookWidthMul,
    sceneBookHeightMul,
  } = parsed.data;
  const update: Record<string, unknown> = {};

  if (name !== undefined) {
    update.name = name;
    // Only update slug for custom shelves
    if (!shelf.isDefault) {
      let baseSlug = slugify(name);
      let slug = baseSlug;
      let attempt = 1;
      while (attempt <= 10) {
        const exists = await prisma.shelf.findUnique({ where: { userId_slug: { userId: session.user.id, slug } } });
        if (!exists || exists.id === id) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }
      update.slug = slug;
    }
  }
  if (description !== undefined) update.description = description;
  if (emoji !== undefined) update.emoji = emoji;
  if (isPublic !== undefined) update.isPublic = isPublic;
  if (bgColour !== undefined) update.bgColour = bgColour;
  if (accentColour !== undefined) update.accentColour = accentColour;
  if (titleColour !== undefined) update.titleColour = titleColour;
  if (lightingPreset !== undefined) update.lightingPreset = lightingPreset === "none" ? null : lightingPreset;
  if (sceneTierCount !== undefined) update.sceneTierCount = sceneTierCount;
  if (sceneBookDisplay !== undefined) update.sceneBookDisplay = sceneBookDisplay;
  if (sceneBookWidthMul !== undefined) update.sceneBookWidthMul = sceneBookWidthMul;
  if (sceneBookHeightMul !== undefined) update.sceneBookHeightMul = sceneBookHeightMul;

  const updated = await prisma.shelf.update({ where: { id }, data: update, include: { _count: { select: { books: true } } } });
  return NextResponse.json(updated);
}
