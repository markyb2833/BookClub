import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml, richTextToPlain } from "@/lib/sanitizeRichText";
import { loadAttachmentsGrouped, normalizeAttachmentInput, replacePostAttachments } from "@/lib/social/postAttachments";
import { PostAttachmentParent } from "@prisma/client";
import { z } from "zod";

const halfStarRating = z
  .number()
  .min(0.5)
  .max(5)
  .refine((n) => Number.isInteger(n * 2), { message: "Rating must use half-star steps (e.g. 3.5)" });

const postSchema = z.object({
  rating: z.union([halfStarRating, z.null()]).optional(),
  body: z.string().max(50_000).optional().nullable(),
  containsSpoilers: z.boolean().optional(),
  attachments: z.array(z.object({ url: z.string(), caption: z.string().max(500).optional() })).max(12).optional(),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ workId: string }> },
) {
  const { workId } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const reviews = await prisma.review.findMany({
    where: { workId, deletedAt: null },
    orderBy: [{ isFeatured: "desc" }, { upvotesCount: "desc" }, { createdAt: "desc" }],
    take: 50,
    include: {
      user: { select: { id: true, username: true, displayName: true, tier: true } },
      ...(viewerId ? { votes: { where: { userId: viewerId }, select: { value: true } } } : {}),
    },
  });

  const attMap = await loadAttachmentsGrouped(
    prisma,
    PostAttachmentParent.review,
    reviews.map((r) => r.id),
  );

  return NextResponse.json({
    reviews: reviews.map((r) => ({ ...r, attachments: attMap.get(r.id) ?? [] })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ workId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { workId } = await ctx.params;
  const work = await prisma.work.findUnique({ where: { id: workId }, select: { id: true } });
  if (!work) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { rating, body: rawBody, containsSpoilers, attachments: rawAtt } = parsed.data;
  const bodyHtml = sanitizeRichHtml(rawBody ?? "");
  const plain = richTextToPlain(bodyHtml);
  const attachmentRows = normalizeAttachmentInput(rawAtt);
  if (!rating && plain.length < 8 && attachmentRows.length === 0) {
    return NextResponse.json({ error: "Add a rating, some text, and/or images" }, { status: 400 });
  }

  const existing = await prisma.review.findUnique({
    where: { userId_workId: { userId: session.user.id, workId } },
  });

  const review = await prisma.$transaction(async (tx) => {
    const r = await tx.review.upsert({
      where: { userId_workId: { userId: session.user.id, workId } },
      create: {
        userId: session.user.id,
        workId,
        rating: rating != null ? rating : null,
        body: bodyHtml || null,
        containsSpoilers: containsSpoilers ?? false,
      },
      update: {
        rating: rating != null ? rating : null,
        body: bodyHtml || null,
        containsSpoilers: containsSpoilers ?? false,
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
      },
    });
    await replacePostAttachments(tx, PostAttachmentParent.review, r.id, attachmentRows);
    return r;
  });

  if (!existing) {
    await prisma.work.update({
      where: { id: workId },
      data: { reviewsCount: { increment: 1 } },
    });
  }

  const attachments = await prisma.postAttachment.findMany({
    where: { parentType: PostAttachmentParent.review, parentId: review.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ review: { ...review, attachments } });
}
