import type { PostAttachment, PostAttachmentParent, PrismaClient } from "@prisma/client";
import { isTrustedUploadUrl } from "@/lib/uploads/trustedUrl";

const MAX_ATTACHMENTS = 12;

export type AttachmentInput = { url: string; caption?: string | null };

export function normalizeAttachmentInput(items: unknown, max: number = MAX_ATTACHMENTS): AttachmentInput[] {
  const cap = Math.min(max, MAX_ATTACHMENTS);
  if (!Array.isArray(items)) return [];
  const out: AttachmentInput[] = [];
  for (const raw of items.slice(0, cap)) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { url?: unknown; caption?: unknown };
    const url = typeof o.url === "string" ? o.url : "";
    const caption = typeof o.caption === "string" ? o.caption.slice(0, 500) : null;
    if (!isTrustedUploadUrl(url)) continue;
    out.push({ url, caption: caption?.trim() ? caption.trim() : null });
  }
  return out;
}

export async function replacePostAttachments(
  tx: Pick<PrismaClient, "postAttachment">,
  parentType: PostAttachmentParent,
  parentId: string,
  items: AttachmentInput[],
) {
  await tx.postAttachment.deleteMany({ where: { parentType, parentId } });
  let order = 0;
  for (const it of items.slice(0, MAX_ATTACHMENTS)) {
    if (!isTrustedUploadUrl(it.url)) continue;
    await tx.postAttachment.create({
      data: {
        parentType,
        parentId,
        url: it.url,
        caption: it.caption?.trim() ? it.caption.trim().slice(0, 500) : null,
        sortOrder: order++,
      },
    });
  }
}

export async function loadAttachmentsGrouped(
  prisma: Pick<PrismaClient, "postAttachment">,
  parentType: PostAttachmentParent,
  parentIds: string[],
): Promise<Map<string, PostAttachment[]>> {
  const map = new Map<string, PostAttachment[]>();
  if (parentIds.length === 0) return map;
  const rows = await prisma.postAttachment.findMany({
    where: { parentType, parentId: { in: parentIds } },
    orderBy: { sortOrder: "asc" },
  });
  for (const r of rows) {
    const list = map.get(r.parentId) ?? [];
    list.push(r);
    map.set(r.parentId, list);
  }
  return map;
}
