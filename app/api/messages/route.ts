import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasAnyBlockBetween } from "@/lib/social/blocking";
import { areMutuallyFollowing } from "@/lib/social/friends";
import { getInboxPayload } from "@/lib/social/inbox";
import { z } from "zod";

const postSchema = z.object({
  recipientUsername: z.string().min(1).max(30),
  body: z.string().min(1).max(8000),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withUser = req.nextUrl.searchParams.get("with");
  const me = session.user.id;

  if (withUser) {
    const partner = await prisma.user.findFirst({
      where: { username: { equals: withUser, mode: "insensitive" } },
      select: { id: true, username: true, displayName: true },
    });
    if (!partner) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (partner.id === me) return NextResponse.json({ error: "Invalid" }, { status: 400 });
    if (await hasAnyBlockBetween(me, partner.id)) {
      return NextResponse.json({ error: "Unavailable" }, { status: 403 });
    }
    if (!(await areMutuallyFollowing(me, partner.id))) {
      return NextResponse.json({ error: "Mutual follow required" }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: me, recipientId: partner.id, deletedBySender: false },
          { senderId: partner.id, recipientId: me, deletedByRecipient: false },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        body: true,
        createdAt: true,
        senderId: true,
        isRead: true,
      },
    });

    await prisma.message.updateMany({
      where: { senderId: partner.id, recipientId: me, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ partner, messages });
  }

  const payload = await getInboxPayload(me);
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { recipientUsername, body: text } = parsed.data;
  const recipient = await prisma.user.findFirst({
    where: { username: { equals: recipientUsername, mode: "insensitive" } },
    select: { id: true },
  });
  if (!recipient) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (recipient.id === session.user.id) return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });

  if (await hasAnyBlockBetween(session.user.id, recipient.id)) {
    return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
  }
  if (!(await areMutuallyFollowing(session.user.id, recipient.id))) {
    return NextResponse.json({ error: "Mutual follow required" }, { status: 403 });
  }

  const msg = await prisma.message.create({
    data: {
      senderId: session.user.id,
      recipientId: recipient.id,
      body: text.trim(),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderId: true,
    },
  });

  return NextResponse.json(msg, { status: 201 });
}
