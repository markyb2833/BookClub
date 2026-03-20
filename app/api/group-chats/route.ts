import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyBlockBetween } from "@/lib/social/blocking";
import { areMutuallyFollowing } from "@/lib/social/friends";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  memberUsernames: z.array(z.string().min(1).max(30)).min(1).max(24),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const me = session.user.id;
  const { name, memberUsernames } = parsed.data;
  const uniqueNames = [...new Set(memberUsernames.map((u) => u.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return NextResponse.json({ error: "Add at least one member" }, { status: 400 });

  const members = await prisma.user.findMany({
    where: { username: { in: uniqueNames, mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (members.length !== uniqueNames.length) {
    return NextResponse.json({ error: "One or more usernames were not found" }, { status: 400 });
  }

  for (const m of members) {
    if (m.id === me) continue;
    if (await hasAnyBlockBetween(me, m.id)) {
      return NextResponse.json({ error: `Cannot add @${m.username} (blocked)` }, { status: 403 });
    }
    if (!(await areMutuallyFollowing(me, m.id))) {
      return NextResponse.json(
        { error: `You and @${m.username} must follow each other to be in a group` },
        { status: 403 }
      );
    }
  }

  const memberIds = [...new Set([me, ...members.map((m) => m.id)])];

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.groupChat.create({
      data: { name, createdById: me },
      select: { id: true, name: true, createdAt: true },
    });
    await tx.groupMember.createMany({
      data: memberIds.map((userId) => ({ groupId: g.id, userId })),
    });
    return g;
  });

  return NextResponse.json(group, { status: 201 });
}
