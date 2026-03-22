import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Minimal check for Railway (etc.): process up + Postgres reachable.
 * Full dependency status stays on GET /api/health (Redis + Meilisearch optional for product).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
