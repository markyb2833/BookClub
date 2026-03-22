-- CreateEnum
CREATE TYPE "ReadingMedium" AS ENUM ('paperback', 'hardcover', 'ebook', 'audiobook', 'other');

-- AlterTable
ALTER TABLE "reading_sessions" ADD COLUMN "period_start" DATE;
ALTER TABLE "reading_sessions" ADD COLUMN "period_end" DATE;
ALTER TABLE "reading_sessions" ADD COLUMN "start_page" INTEGER;
ALTER TABLE "reading_sessions" ADD COLUMN "end_page" INTEGER;
ALTER TABLE "reading_sessions" ADD COLUMN "medium" "ReadingMedium" NOT NULL DEFAULT 'paperback';
ALTER TABLE "reading_sessions" ADD COLUMN "medium_note" VARCHAR(120);
ALTER TABLE "reading_sessions" ADD COLUMN "highlights" JSONB;
ALTER TABLE "reading_sessions" ADD COLUMN "read_cycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "reading_sessions" ADD COLUMN "feed_post_id" TEXT;

UPDATE "reading_sessions" SET "period_start" = "date" WHERE "period_start" IS NULL;
ALTER TABLE "reading_sessions" ALTER COLUMN "period_start" SET NOT NULL;

CREATE UNIQUE INDEX "reading_sessions_feed_post_id_key" ON "reading_sessions"("feed_post_id");

ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_feed_post_id_fkey" FOREIGN KEY ("feed_post_id") REFERENCES "feed_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "reading_sessions_user_id_period_start_idx" ON "reading_sessions"("user_id", "period_start");
CREATE INDEX "reading_sessions_user_id_work_id_idx" ON "reading_sessions"("user_id", "work_id");

ALTER TABLE "reading_sessions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
