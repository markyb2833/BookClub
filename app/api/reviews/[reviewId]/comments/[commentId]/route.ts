import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PostAttachmentParent } from "@prisma/client";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ reviewId: string; commentId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { reviewId, commentId } = await ctx.params;

  const row = await prisma.reviewComment.findFirst({
    where: { id: commentId, reviewId, deletedAt: null },
    include: { review: { select: { userId: true } } },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOp = row.review.userId === session.user.id;
  const isAuthor = row.userId === session.user.id;
  if (!isOp && !isAuthor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.postAttachment.deleteMany({
      where: { parentType: PostAttachmentParent.review_comment, parentId: commentId },
    });
    await tx.reviewComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    await tx.review.update({
      where: { id: reviewId },
      data: { commentsCount: { decrement: 1 } },
    });
  });

  return NextResponse.json({ ok: true });
}
