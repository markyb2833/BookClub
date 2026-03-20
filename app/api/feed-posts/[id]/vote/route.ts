import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setFeedPostVote } from "@/lib/social/binaryVote";
import { z } from "zod";

const bodySchema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const row = await prisma.feedPost.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await setFeedPostVote(prisma, id, session.user.id, parsed.data.value);

  const fresh = await prisma.feedPost.findUnique({
    where: { id },
    select: {
      upvotesCount: true,
      downvotesCount: true,
      votes: { where: { userId: session.user.id }, select: { value: true } },
    },
  });

  return NextResponse.json({
    upvotesCount: fresh?.upvotesCount ?? 0,
    downvotesCount: fresh?.downvotesCount ?? 0,
    myVote: fresh?.votes[0]?.value ?? 0,
  });
}
