import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichHtml, richTextToPlain } from "@/lib/sanitizeRichText";
import { loadAttachmentsGrouped, normalizeAttachmentInput, replacePostAttachments } from "@/lib/social/postAttachments";
import { PostAttachmentParent } from "@prisma/client";
import { z } from "zod";

const postSchema = z.object({
  recommendedWorkId: z.string().uuid(),
  body: z.string().max(50_000),
  attachments: z.array(z.object({ url: z.string(), caption: z.string().max(500).optional() })).max(12).optional(),
});

/** `workId` in path = context (page you’re on). GET returns recommendations *of* this book and *from* this book. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ workId: string }> }) {
  const { workId } = await ctx.params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const baseInc = {
    user: { select: { id: true, username: true, displayName: true, tier: true } },
    work: { select: { id: true, title: true, coverUrl: true } },
    contextWork: { select: { id: true, title: true } },
  };
  const voteInc = viewerId
    ? { votes: { where: { userId: viewerId }, select: { value: true } as const } }
    : {};

  const [recommendingThisBook, fromThisBook] = await Promise.all([
    prisma.bookRecommendation.findMany({
      where: { workId, deletedAt: null },
      orderBy: [{ upvotesCount: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { ...baseInc, ...voteInc },
    }),
    prisma.bookRecommendation.findMany({
      where: { contextWorkId: workId, deletedAt: null },
      orderBy: [{ upvotesCount: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: { ...baseInc, ...voteInc },
    }),
  ]);

  const recIds = [...recommendingThisBook, ...fromThisBook].map((r) => r.id);
  const attMap = await loadAttachmentsGrouped(prisma, PostAttachmentParent.book_recommendation, recIds);

  const merge = (rows: typeof recommendingThisBook) =>
    rows.map((r) => ({ ...r, attachments: attMap.get(r.id) ?? [] }));

  return NextResponse.json({
    recommendingThisBook: merge(recommendingThisBook),
    fromThisBook: merge(fromThisBook),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ workId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { workId: contextWorkId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { recommendedWorkId, body: raw, attachments: rawAtt } = parsed.data;
  if (recommendedWorkId === contextWorkId) {
    return NextResponse.json({ error: "Pick a different book than the one you’re viewing" }, { status: 400 });
  }

  const [ctxW, recW] = await Promise.all([
    prisma.work.findUnique({ where: { id: contextWorkId }, select: { id: true } }),
    prisma.work.findUnique({ where: { id: recommendedWorkId }, select: { id: true } }),
  ]);
  if (!ctxW || !recW) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const bodyHtml = sanitizeRichHtml(raw);
  const plain = richTextToPlain(bodyHtml);
  const attachmentRows = normalizeAttachmentInput(rawAtt);
  if (plain.length < 12 && attachmentRows.length === 0) {
    return NextResponse.json({ error: "Explain your recommendation in text and/or add images" }, { status: 400 });
  }

  const rec = await prisma.$transaction(async (tx) => {
    const r = await tx.bookRecommendation.upsert({
      where: {
        userId_workId: { userId: session.user.id, workId: recommendedWorkId },
      },
      create: {
        userId: session.user.id,
        workId: recommendedWorkId,
        contextWorkId,
        body: bodyHtml,
      },
      update: {
        body: bodyHtml,
        contextWorkId,
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
        work: { select: { id: true, title: true, coverUrl: true } },
        contextWork: { select: { id: true, title: true } },
      },
    });
    await replacePostAttachments(tx, PostAttachmentParent.book_recommendation, r.id, attachmentRows);
    return r;
  });

  const attachments = await prisma.postAttachment.findMany({
    where: { parentType: PostAttachmentParent.book_recommendation, parentId: rec.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ recommendation: { ...rec, attachments } });
}
