import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadMessageCount } from "@/lib/social/messageUnread";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await getUnreadMessageCount(session.user.id);
  return NextResponse.json({ count });
}
