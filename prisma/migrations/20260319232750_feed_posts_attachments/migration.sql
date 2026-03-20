-- CreateEnum
CREATE TYPE "PostAttachmentParent" AS ENUM ('review', 'book_recommendation', 'review_comment', 'book_recommendation_comment', 'feed_post');

-- CreateTable
CREATE TABLE "post_attachments" (
    "id" TEXT NOT NULL,
    "parent_type" "PostAttachmentParent" NOT NULL,
    "parent_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT,
    "upvotes_count" INTEGER NOT NULL DEFAULT 0,
    "downvotes_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_post_votes" (
    "id" TEXT NOT NULL,
    "feed_post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_post_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_attachments_parent_type_parent_id_idx" ON "post_attachments"("parent_type", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "feed_post_votes_feed_post_id_user_id_key" ON "feed_post_votes"("feed_post_id", "user_id");

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_votes" ADD CONSTRAINT "feed_post_votes_feed_post_id_fkey" FOREIGN KEY ("feed_post_id") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_post_votes" ADD CONSTRAINT "feed_post_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
