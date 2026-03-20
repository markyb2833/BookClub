-- AlterEnum
ALTER TYPE "PostAttachmentParent" ADD VALUE 'feed_post_comment';

-- AlterTable
ALTER TABLE "feed_posts" ADD COLUMN     "comments_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "feed_post_comments" (
    "id" TEXT NOT NULL,
    "feed_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "upvotes_count" INTEGER NOT NULL DEFAULT 0,
    "downvotes_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_post_comment_votes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_post_comment_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feed_post_comment_votes_comment_id_user_id_key" ON "feed_post_comment_votes"("comment_id", "user_id");

-- AddForeignKey
ALTER TABLE "feed_post_comments" ADD CONSTRAINT "feed_post_comments_feed_post_id_fkey" FOREIGN KEY ("feed_post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_comments" ADD CONSTRAINT "feed_post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_comment_votes" ADD CONSTRAINT "feed_post_comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "feed_post_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_comment_votes" ADD CONSTRAINT "feed_post_comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
