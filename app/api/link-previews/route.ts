import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveChatLinkPreview } from "@/lib/social/resolveChatLinkPreview";
import { z } from "zod";

const bodySchema = z.object({
  urls: z.array(z.string().max(2000)).max(8),
});

function allowedHosts(req: NextRequest): Set<string> {
  const h = new Set<string>();
  const xf = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  for (const raw of [xf, host]) {
    if (!raw) continue;
    const first = raw.split(",")[0]?.trim();
    if (first) h.add(first.split(":")[0]!);
  }
  const nu = process.env.NEXTAUTH_URL;
  if (nu) {
    try {
      h.add(new URL(nu).hostname);
    } catch {
      /* ignore */
    }
  }
  return h;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const hosts = allowedHosts(req);
  const origin = req.nextUrl.origin;
  const viewerId = session.user.id;
  const previews: Record<string, Awaited<ReturnType<typeof resolveChatLinkPreview>>> = {};

  for (const raw of parsed.data.urls) {
    let u: URL;
    try {
      u = raw.startsWith("/") ? new URL(raw, origin) : new URL(raw);
    } catch {
      previews[raw] = null;
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      previews[raw] = null;
      continue;
    }
    if (!hosts.has(u.hostname)) {
      previews[raw] = null;
      continue;
    }

    try {
      previews[raw] = await resolveChatLinkPreview(prisma, u, viewerId);
    } catch {
      previews[raw] = null;
    }
  }

  return NextResponse.json({ previews });
}
