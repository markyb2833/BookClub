import { Job } from "bullmq";
import { prisma } from "../lib/prisma";

const WEIGHTS = {
  books: 0.2,
  reviews: 0.3,
  quality: 0.25,
  community: 0.15,
  longevity: 0.1,
};

const THRESHOLDS = {
  bookworm: { score: 40, minAgeDays: 30 },
  critic: { score: 65, minAgeDays: 90 },
};

/**
 * Tier Scoring Job
 * Runs nightly. Calculates a composite score for every active user
 * and upgrades tiers where thresholds are met.
 */
export async function tierScoringJob(_job: Job) {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const activeUsers = await prisma.user.findMany({
    where: {
      lastActiveAt: { gte: ninetyDaysAgo },
      tier: { notIn: ["ambassador", "founding_member"] },
    },
    include: {
      reviews: { where: { deletedAt: null } },
      readingSessions: true,
      clubPosts: { where: { deletedAt: null } },
      collections: { include: { followers: true } },
    },
  });

  let upgraded = 0;

  for (const user of activeUsers) {
    const accountAgeDays = Math.floor(
      (Date.now() - user.joinedAt.getTime()) / 86400000
    );

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentSessions = user.readingSessions.filter(
      (s) => s.createdAt >= sixMonthsAgo
    );
    const recentReviews = user.reviews.filter(
      (r) => r.createdAt >= sixMonthsAgo
    );

    // books_score: 0-100, 10 books in 6 months = 100
    const uniqueBooks = new Set(recentSessions.map((s) => s.workId)).size;
    const booksScore = Math.min((uniqueBooks / 10) * 100, 100);

    // reviews_score: 0-100, 15 reviews in 6 months = 100
    const reviewsScore = Math.min((recentReviews.length / 15) * 100, 100);

    // quality_score: avg upvotes per review, capped
    const totalUp = recentReviews.reduce((sum, r) => sum + r.upvotesCount, 0);
    const avgUp =
      recentReviews.length > 0 ? totalUp / recentReviews.length : 0;
    const qualityScore = Math.min((avgUp / 10) * 100, 100);

    // community_score: club posts + collection followers
    const clubPostCount = user.clubPosts.filter(
      (p) => p.createdAt >= sixMonthsAgo
    ).length;
    const collectionFollowers = user.collections.reduce(
      (sum, c) => sum + c.followers.length,
      0
    );
    const communityScore = Math.min(
      ((clubPostCount * 2 + collectionFollowers) / 50) * 100,
      100
    );

    // longevity_score: account age ratio
    const longevityScore = Math.min((accountAgeDays / 365) * 100, 100);

    const compositeScore =
      booksScore * WEIGHTS.books +
      reviewsScore * WEIGHTS.reviews +
      qualityScore * WEIGHTS.quality +
      communityScore * WEIGHTS.community +
      longevityScore * WEIGHTS.longevity;

    // Save score record
    await prisma.userTierScore.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        score: compositeScore,
        booksLogged: uniqueBooks,
        reviewsWritten: recentReviews.length,
        avgReviewLikes: avgLikes,
        reviewQualityScore: qualityScore,
        communityScore,
      },
      update: {
        score: compositeScore,
        booksLogged: uniqueBooks,
        reviewsWritten: recentReviews.length,
        avgReviewLikes: avgLikes,
        reviewQualityScore: qualityScore,
        communityScore,
        calculatedAt: new Date(),
      },
    });

    // Determine new tier
    let newTier = user.tier;
    if (
      compositeScore >= THRESHOLDS.critic.score &&
      accountAgeDays >= THRESHOLDS.critic.minAgeDays &&
      user.tier === "bookworm"
    ) {
      newTier = "critic";
    } else if (
      compositeScore >= THRESHOLDS.bookworm.score &&
      accountAgeDays >= THRESHOLDS.bookworm.minAgeDays &&
      user.tier === "reader"
    ) {
      newTier = "bookworm";
    }

    if (newTier !== user.tier) {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: newTier as never, tierScore: compositeScore },
      });
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "tier_upgrade",
          body: `Congratulations! You've been promoted to ${newTier}.`,
        },
      });
      upgraded++;
    }
  }

  return { processed: activeUsers.length, upgraded };
}
