import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

async function assertMember(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { userId: true },
  });
  return !!m;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await context.params;
  if (!(await assertMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const group = await prisma.groupChat.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  const messages = await prisma.groupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId: session.user.id } },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ group: { name: group?.name ?? "Group" }, messages });
}

const postSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await context.params;
  if (!(await assertMember(groupId, session.user.id))) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const msg = await prisma.groupMessage.create({
    data: {
      groupId,
      senderId: session.user.id,
      body: parsed.data.body,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
