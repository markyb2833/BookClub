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
  if (target.id === session.user.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  if (await hasAnyBlockBetween(session.user.id, target.id)) {
    return NextResponse.json({ error: "Cannot follow this user" }, { status: 403 });
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: { followerId: session.user.id, followingId: target.id },
    },
    create: { followerId: session.user.id, followingId: target.id },
    update: {},
  });

  return NextResponse.json({ ok: true, following: true });
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

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: target.id },
  });

  return NextResponse.json({ ok: true, following: false });
}
