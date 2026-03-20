import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; workId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workId } = await params;
  const shelf = await prisma.shelf.findUnique({ where: { id } });
  if (!shelf || shelf.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.shelfBook.delete({ where: { shelfId_workId: { shelfId: id, workId } } });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2025") return NextResponse.json({ error: "Not on shelf" }, { status: 404 });
    throw e;
  }

  return NextResponse.json({ ok: true });
}
