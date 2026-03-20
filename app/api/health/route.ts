import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { meili } from "@/lib/meilisearch";
import { setupBooksIndex } from "@/lib/meilisearch-setup";

export async function GET() {
  const checks = {
    postgres: false,
    redis: false,
    meilisearch: false,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = true;
  } catch {}

  try {
    await redis.ping();
    checks.redis = true;
  } catch {}

  try {
    await meili.health();
    checks.meilisearch = true;
    // Ensure index settings are up to date
    setupBooksIndex().catch(() => null);
  } catch {}

  const allHealthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    { status: allHealthy ? "ok" : "degraded", checks },
    { status: allHealthy ? 200 : 503 }
  );
}
