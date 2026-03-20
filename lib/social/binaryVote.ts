import type { PrismaClient } from "@prisma/client";

/** Apply or clear a ±1 vote; keeps denormalised up/down counts in sync. */
export async function setReviewVote(prisma: PrismaClient, reviewId: string, userId: string, value: 0 | 1 | -1) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId } } });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.reviewVote.create({ data: { reviewId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.reviewVote.delete({ where: { reviewId_userId: { reviewId, userId } } });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.reviewVote.update({
        where: { reviewId_userId: { reviewId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.review.update({
        where: { id: reviewId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}

export async function setReviewCommentVote(
  prisma: PrismaClient,
  commentId: string,
  userId: string,
  value: 0 | 1 | -1,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reviewCommentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.reviewCommentVote.delete({ where: { commentId_userId: { commentId, userId } } });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.reviewCommentVote.create({ data: { commentId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.reviewCommentVote.delete({ where: { commentId_userId: { commentId, userId } } });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.reviewCommentVote.update({
        where: { commentId_userId: { commentId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.reviewComment.update({
        where: { id: commentId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}

export async function setBookRecommendationVote(
  prisma: PrismaClient,
  recommendationId: string,
  userId: string,
  value: 0 | 1 | -1,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bookRecommendationVote.findUnique({
      where: { recommendationId_userId: { recommendationId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.bookRecommendationVote.delete({
        where: { recommendationId_userId: { recommendationId, userId } },
      });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.bookRecommendationVote.create({ data: { recommendationId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.bookRecommendationVote.delete({
        where: { recommendationId_userId: { recommendationId, userId } },
      });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.bookRecommendationVote.update({
        where: { recommendationId_userId: { recommendationId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.bookRecommendation.update({
        where: { id: recommendationId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}

export async function setBookRecommendationCommentVote(
  prisma: PrismaClient,
  commentId: string,
  userId: string,
  value: 0 | 1 | -1,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bookRecommendationCommentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.bookRecommendationCommentVote.delete({
        where: { commentId_userId: { commentId, userId } },
      });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.bookRecommendationCommentVote.create({ data: { commentId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.bookRecommendationCommentVote.delete({
        where: { commentId_userId: { commentId, userId } },
      });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.bookRecommendationCommentVote.update({
        where: { commentId_userId: { commentId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.bookRecommendationComment.update({
        where: { id: commentId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}

export async function setFeedPostVote(prisma: PrismaClient, feedPostId: string, userId: string, value: 0 | 1 | -1) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feedPostVote.findUnique({
      where: { feedPostId_userId: { feedPostId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.feedPostVote.delete({ where: { feedPostId_userId: { feedPostId, userId } } });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.feedPostVote.create({ data: { feedPostId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.feedPostVote.delete({ where: { feedPostId_userId: { feedPostId, userId } } });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.feedPostVote.update({
        where: { feedPostId_userId: { feedPostId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.feedPost.update({
        where: { id: feedPostId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}

export async function setFeedPostCommentVote(
  prisma: PrismaClient,
  commentId: string,
  userId: string,
  value: 0 | 1 | -1,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.feedPostCommentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    let dUp = 0;
    let dDown = 0;
    if (value === 0) {
      if (!existing) return;
      if (existing.value === 1) dUp = -1;
      else dDown = -1;
      await tx.feedPostCommentVote.delete({ where: { commentId_userId: { commentId, userId } } });
    } else if (!existing) {
      if (value === 1) dUp = 1;
      else dDown = 1;
      await tx.feedPostCommentVote.create({ data: { commentId, userId, value } });
    } else if (existing.value === value) {
      if (value === 1) dUp = -1;
      else dDown = -1;
      await tx.feedPostCommentVote.delete({ where: { commentId_userId: { commentId, userId } } });
    } else {
      if (existing.value === 1) {
        dUp = -1;
        dDown = 1;
      } else {
        dUp = 1;
        dDown = -1;
      }
      await tx.feedPostCommentVote.update({
        where: { commentId_userId: { commentId, userId } },
        data: { value },
      });
    }
    if (dUp !== 0 || dDown !== 0) {
      await tx.feedPostComment.update({
        where: { id: commentId },
        data: { upvotesCount: { increment: dUp }, downvotesCount: { increment: dDown } },
      });
    }
  });
}
