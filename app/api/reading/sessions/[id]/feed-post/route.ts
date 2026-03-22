import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAttachmentInput, replacePostAttachments } from "@/lib/social/postAttachments";
import { buildReadingFeedAppendixHtml } from "@/lib/reading/highlightHelpers";
import { richTextToPlain, sanitizeRichHtml } from "@/lib/sanitizeRichText";
import { PostAttachmentParent } from "@prisma/client";
import { z } from "zod";

const bodySchema = z.object({
  body: z.string().max(80_000).optional().nullable(),
  attachments: z.array(z.object({ url: z.string(), caption: z.string().max(500).optional() })).max(12).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: sessionId } = await params;

  const rs = await prisma.readingSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      feedPostId: true,
      pagesRead: true,
      readingTimeMinutes: true,
      percentComplete: true,
      endPage: true,
      pagesTotal: true,
      periodStart: true,
      periodEnd: true,
      medium: true,
      readCycle: true,
      notes: true,
      highlights: true,
      work: { select: { id: true, title: true, coverUrl: true } },
    },
  });
  if (!rs) {
    return NextResponse.json({ error: "Reading session not found" }, { status: 404 });
  }
  if (rs.feedPostId) {
    return NextResponse.json({ error: "This read already has a feed post" }, { status: 409 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const bodyHtml = sanitizeRichHtml(parsed.data.body ?? "");
  const plain = richTextToPlain(bodyHtml).trim();
  const attachmentRows = normalizeAttachmentInput(parsed.data.attachments);
  const hasUserText = plain.length >= 1;
  const appendix = buildReadingFeedAppendixHtml(rs.notes, rs.highlights);
  const mergedRaw = [hasUserText ? bodyHtml : "", appendix].filter(Boolean).join("<p></p>");
  const mergedHtml = mergedRaw ? sanitizeRichHtml(mergedRaw) : "";
  const mergedPlain = richTextToPlain(mergedHtml).trim();
  const postBody = mergedPlain.length >= 1 ? mergedHtml || null : null;

  const post = await prisma.$transaction(async (tx) => {
    const p = await tx.feedPost.create({
      data: {
        userId,
        body: postBody,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
      },
    });
    await replacePostAttachments(tx, PostAttachmentParent.feed_post, p.id, attachmentRows);
    await tx.readingSession.update({
      where: { id: sessionId },
      data: { feedPostId: p.id },
    });
    return p;
  });

  const attachments = await prisma.postAttachment.findMany({
    where: { parentType: PostAttachmentParent.feed_post, parentId: post.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    post: { ...post, attachments },
    readingSessionId: sessionId,
    workTitle: rs.work.title,
  });
}
