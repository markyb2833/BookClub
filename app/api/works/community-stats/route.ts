import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWorksCommunityStatsMap, ZERO_COMMUNITY_STATS, type WorkCommunityStats } from "@/lib/social/workCommunityStats";
import { z } from "zod";

const bodySchema = z.object({
  workIds: z.array(z.string().uuid()).max(100),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const map = await getWorksCommunityStatsMap(prisma, parsed.data.workIds);
  const byId: Record<string, WorkCommunityStats> = {};
  for (const id of parsed.data.workIds) {
    byId[id] = map.get(id) ?? ZERO_COMMUNITY_STATS;
  }

  return NextResponse.json({ byId });
}
