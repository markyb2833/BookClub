import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyBlockBetween } from "@/lib/social/blocking";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await params;
  const target = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === session.user.id) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });

  if (await hasAnyBlockBetween(session.user.id, target.id)) {
    return NextResponse.json({ ok: true, already: true });
  }

  await prisma.$transaction([
    prisma.userBlock.create({
      data: { blockerId: session.user.id, blockedId: target.id },
    }),
    prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followingId: target.id },
          { followerId: target.id, followingId: session.user.id },
        ],
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username } = await params;
  const target = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.userBlock.deleteMany({
    where: { blockerId: session.user.id, blockedId: target.id },
  });

  return NextResponse.json({ ok: true });
}
