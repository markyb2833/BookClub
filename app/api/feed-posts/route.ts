import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeAttachmentInput, replacePostAttachments } from "@/lib/social/postAttachments";
import { richTextToPlain, sanitizeRichHtml } from "@/lib/sanitizeRichText";
import { PostAttachmentParent } from "@prisma/client";
import { z } from "zod";

const postSchema = z.object({
  body: z.string().max(80_000).optional().nullable(),
  attachments: z.array(z.object({ url: z.string(), caption: z.string().max(500).optional() })).max(12).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

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

  const bodyHtml = sanitizeRichHtml(parsed.data.body ?? "");
  const plain = richTextToPlain(bodyHtml);
  const attachmentRows = normalizeAttachmentInput(parsed.data.attachments);
  if (plain.length < 2 && attachmentRows.length === 0) {
    return NextResponse.json({ error: "Add some text and/or at least one image" }, { status: 400 });
  }

  const userId = session.user.id;

  const post = await prisma.$transaction(async (tx) => {
    const p = await tx.feedPost.create({
      data: {
        userId,
        body: bodyHtml || null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
      },
    });
    await replacePostAttachments(tx, PostAttachmentParent.feed_post, p.id, attachmentRows);
    return p;
  });

  const attachments = await prisma.postAttachment.findMany({
    where: { parentType: PostAttachmentParent.feed_post, parentId: post.id },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ post: { ...post, attachments } });
}
