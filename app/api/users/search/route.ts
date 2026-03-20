import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlockedPeerIds } from "@/lib/social/blocking";

/** Autocomplete / directory search for public profiles (for global search & group invites). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const session = await auth();
  const blocked = session?.user?.id ? await getBlockedPeerIds(session.user.id) : new Set<string>();
  const blockedIds = [...blocked];

  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
          ],
        },
        {
          OR: [{ settings: null }, { settings: { is: { profilePublic: true } } }],
        },
        ...(blockedIds.length > 0 ? [{ id: { notIn: blockedIds } }] : []),
      ],
    },
    take: 20,
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json({ users });
}
