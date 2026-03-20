-- Review comments: vote tallies
ALTER TABLE "review_comments" ADD COLUMN "downvotes_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "review_comments" ADD COLUMN "upvotes_count" INTEGER NOT NULL DEFAULT 0;

-- Reviews: rename likes_count -> upvotes_count, add downvotes
ALTER TABLE "reviews" RENAME COLUMN "likes_count" TO "upvotes_count";
ALTER TABLE "reviews" ADD COLUMN "downvotes_count" INTEGER NOT NULL DEFAULT 0;

-- New vote table (migrate legacy likes as +1 votes)
CREATE TABLE "review_votes" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "review_votes" ("id", "review_id", "user_id", "value", "created_at")
SELECT gen_random_uuid()::text, "review_id", "user_id", 1, "created_at" FROM "review_likes";

ALTER TABLE "review_likes" DROP CONSTRAINT "review_likes_review_id_fkey";
ALTER TABLE "review_likes" DROP CONSTRAINT "review_likes_user_id_fkey";
DROP TABLE "review_likes";

CREATE UNIQUE INDEX "review_votes_review_id_user_id_key" ON "review_votes"("review_id", "user_id");
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment votes
CREATE TABLE "review_comment_votes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_comment_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_comment_votes_comment_id_user_id_key" ON "review_comment_votes"("comment_id", "user_id");
ALTER TABLE "review_comment_votes" ADD CONSTRAINT "review_comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "review_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_comment_votes" ADD CONSTRAINT "review_comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Book recommendations
CREATE TABLE "book_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "context_work_id" TEXT,
    "body" TEXT NOT NULL,
    "upvotes_count" INTEGER NOT NULL DEFAULT 0,
    "downvotes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "book_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "book_recommendation_votes" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_recommendation_votes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "book_recommendation_comments" (
    "id" TEXT NOT NULL,
    "recommendation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "upvotes_count" INTEGER NOT NULL DEFAULT 0,
    "downvotes_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "book_recommendation_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "book_recommendation_comment_votes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_recommendation_comment_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "book_recommendations_user_id_work_id_key" ON "book_recommendations"("user_id", "work_id");
CREATE UNIQUE INDEX "book_recommendation_votes_recommendation_id_user_id_key" ON "book_recommendation_votes"("recommendation_id", "user_id");
CREATE UNIQUE INDEX "book_recommendation_comment_votes_comment_id_user_id_key" ON "book_recommendation_comment_votes"("comment_id", "user_id");

ALTER TABLE "book_recommendations" ADD CONSTRAINT "book_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_recommendations" ADD CONSTRAINT "book_recommendations_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_recommendations" ADD CONSTRAINT "book_recommendations_context_work_id_fkey" FOREIGN KEY ("context_work_id") REFERENCES "works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "book_recommendation_votes" ADD CONSTRAINT "book_recommendation_votes_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "book_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_recommendation_votes" ADD CONSTRAINT "book_recommendation_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "book_recommendation_comments" ADD CONSTRAINT "book_recommendation_comments_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "book_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_recommendation_comments" ADD CONSTRAINT "book_recommendation_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "book_recommendation_comment_votes" ADD CONSTRAINT "book_recommendation_comment_votes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "book_recommendation_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_recommendation_comment_votes" ADD CONSTRAINT "book_recommendation_comment_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
