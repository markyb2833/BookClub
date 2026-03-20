import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizePlainContent } from "@/lib/sanitizeRichText";
import { loadAttachmentsGrouped, normalizeAttachmentInput, replacePostAttachments } from "@/lib/social/postAttachments";
import { PostAttachmentParent } from "@prisma/client";
import { z } from "zod";

const postSchema = z.object({
  body: z.string().max(8000).optional().default(""),
  attachments: z.array(z.object({ url: z.string(), caption: z.string().max(500).optional() })).max(6).optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const parent = await prisma.bookRecommendation.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comments = await prisma.bookRecommendationComment.findMany({
    where: { recommendationId: id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      ...(viewerId
        ? { votes: { where: { userId: viewerId }, select: { value: true } } }
        : {}),
    },
  });

  const attMap = await loadAttachmentsGrouped(
    prisma,
    PostAttachmentParent.book_recommendation_comment,
    comments.map((c) => c.id),
  );

  return NextResponse.json({
    comments: comments.map((c) => ({ ...c, attachments: attMap.get(c.id) ?? [] })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const parent = await prisma.bookRecommendation.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const body = sanitizePlainContent(parsed.data.body ?? "");
  const attachmentRows = normalizeAttachmentInput(parsed.data.attachments, 6);
  if (!body && attachmentRows.length === 0) {
    return NextResponse.json({ error: "Write something or attach an image" }, { status: 400 });
  }

  const comment = await prisma.$transaction(async (tx) => {
    const c = await tx.bookRecommendationComment.create({
      data: { recommendationId: id, userId: session.user.id, body },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });
    await replacePostAttachments(tx, PostAttachmentParent.book_recommendation_comment, c.id, attachmentRows);
    await tx.bookRecommendation.update({
      where: { id },
      data: { commentsCount: { increment: 1 } },
    });
    return c;
  });

  const attachments = await prisma.postAttachment.findMany({
    where: { parentType: PostAttachmentParent.book_recommendation_comment, parentId: comment.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ comment: { ...comment, attachments } });
}
