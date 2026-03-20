import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostAttachmentParent } from "@prisma/client";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id, commentId } = await ctx.params;

  const row = await prisma.bookRecommendationComment.findFirst({
    where: { id: commentId, recommendationId: id, deletedAt: null },
    include: { recommendation: { select: { userId: true } } },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOp = row.recommendation.userId === session.user.id;
  const isAuthor = row.userId === session.user.id;
  if (!isOp && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.postAttachment.deleteMany({
      where: { parentType: PostAttachmentParent.book_recommendation_comment, parentId: commentId },
    });
    await tx.bookRecommendationComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    await tx.bookRecommendation.update({
      where: { id },
      data: { commentsCount: { decrement: 1 } },
    });
  });

  return NextResponse.json({ ok: true });
}
