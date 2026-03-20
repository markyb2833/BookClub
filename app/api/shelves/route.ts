import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  isPublic: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workId = req.nextUrl.searchParams.get("workId");

  const shelves = await prisma.shelf.findMany({
    where: { userId: session.user.id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { books: true } } },
  });

  if (workId) {
    const onShelves = await prisma.shelfBook.findMany({
      where: { workId, shelf: { userId: session.user.id } },
      select: { shelfId: true },
    });
    const onShelfIds = new Set(onShelves.map((s) => s.shelfId));
    return NextResponse.json(shelves.map((s) => ({ ...s, containsWork: onShelfIds.has(s.id) })));
  }

  return NextResponse.json(shelves);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { name, description, emoji, isPublic } = parsed.data;

  // Generate unique slug
  let baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 1;
  while (attempt <= 10) {
    const exists = await prisma.shelf.findUnique({ where: { userId_slug: { userId: session.user.id, slug } } });
    if (!exists) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Next sort order
  const agg = await prisma.shelf.aggregate({ _max: { sortOrder: true }, where: { userId: session.user.id } });
  const sortOrder = (agg._max.sortOrder ?? 0) + 1;

  const shelf = await prisma.shelf.create({
    data: { userId: session.user.id, name, emoji, slug, description, isPublic, sortOrder, isDefault: false },
    include: { _count: { select: { books: true } } },
  });

  return NextResponse.json(shelf, { status: 201 });
}
