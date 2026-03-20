import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setBookRecommendationCommentVote } from "@/lib/social/binaryVote";
import { z } from "zod";

const schema = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ commentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { commentId } = await ctx.params;
  const comment = await prisma.bookRecommendationComment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { id: true },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "value must be 1, -1, or 0" }, { status: 400 });
  }

  await setBookRecommendationCommentVote(prisma, commentId, session.user.id, parsed.data.value);

  const next = await prisma.bookRecommendationComment.findUnique({
    where: { id: commentId },
    select: {
      upvotesCount: true,
      downvotesCount: true,
      votes: { where: { userId: session.user.id }, select: { value: true } },
    },
  });

  return NextResponse.json({
    upvotesCount: next?.upvotesCount ?? 0,
    downvotesCount: next?.downvotesCount ?? 0,
    myVote: next?.votes[0]?.value ?? 0,
  });
}
