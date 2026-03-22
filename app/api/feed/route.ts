import { NextRequest, NextResponse } from "next/server";
import { progressPercentFromSessionSnapshot } from "@/lib/reading/workReadingProgress";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadAttachmentsGrouped } from "@/lib/social/postAttachments";
import { PostAttachmentParent } from "@prisma/client";

type Sort = "new" | "top" | "trending";

function net(up: number, down: number) {
  return up - down;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const sort = (req.nextUrl.searchParams.get("sort") ?? "new") as Sort;
  const valid: Sort[] = ["new", "top", "trending"];
  const s = valid.includes(sort) ? sort : "new";

  const scopeRaw = req.nextUrl.searchParams.get("scope") ?? "all";
  const scope = scopeRaw === "following" ? "following" : "all";

  let actorIds: string[] | null = null;
  if (scope === "following") {
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    actorIds = Array.from(new Set([viewerId, ...follows.map((f) => f.followingId)]));
  }

  const actorFilter = actorIds ? { userId: { in: actorIds } } : {};

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const reviewWhere =
    s === "trending" ? { deletedAt: null, createdAt: { gte: weekAgo } } : { deletedAt: null };

  const recWhere =
    s === "trending" ? { deletedAt: null, createdAt: { gte: weekAgo } } : { deletedAt: null };

  const feedPostWhere =
    s === "trending" ? { deletedAt: null, createdAt: { gte: weekAgo } } : { deletedAt: null };

  const [reviews, recommendations, feedPosts] = await Promise.all([
    prisma.review.findMany({
      where: { ...reviewWhere, ...actorFilter },
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
        work: { select: { id: true, title: true, coverUrl: true } },
      },
    }),
    prisma.bookRecommendation.findMany({
      where: { ...recWhere, ...actorFilter },
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
        work: { select: { id: true, title: true, coverUrl: true } },
        contextWork: { select: { id: true, title: true } },
      },
    }),
    prisma.feedPost.findMany({
      where: { ...feedPostWhere, ...actorFilter },
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
      },
    }),
  ]);

  type Item =
    | {
        kind: "review";
        id: string;
        createdAt: string;
        score: number;
        myVote: number;
        review: (typeof reviews)[0] & { attachments: unknown[] };
      }
    | {
        kind: "recommendation";
        id: string;
        createdAt: string;
        score: number;
        myVote: number;
        recommendation: (typeof recommendations)[0] & { attachments: unknown[] };
      }
    | {
        kind: "feed_post";
        id: string;
        createdAt: string;
        score: number;
        myVote: number;
        feedPost: (typeof feedPosts)[0] & {
          attachments: unknown[];
          readingLog?: {
            sessionId: string;
            readCycle: number;
            medium: string;
            periodStart: string;
            periodEnd: string | null;
            work: { id: string; title: string; coverUrl: string | null };
          };
        };
      };

  const reviewAtt = await loadAttachmentsGrouped(
    prisma,
    PostAttachmentParent.review,
    reviews.map((r) => r.id),
  );
  const recAtt = await loadAttachmentsGrouped(
    prisma,
    PostAttachmentParent.book_recommendation,
    recommendations.map((r) => r.id),
  );
  const fpAtt = await loadAttachmentsGrouped(
    prisma,
    PostAttachmentParent.feed_post,
    feedPosts.map((p) => p.id),
  );

  const readingSessionsForPosts = await prisma.readingSession.findMany({
    where: { feedPostId: { in: feedPosts.map((p) => p.id) } },
    select: {
      id: true,
      feedPostId: true,
      readCycle: true,
      medium: true,
      periodStart: true,
      periodEnd: true,
      pagesRead: true,
      readingTimeMinutes: true,
      percentComplete: true,
      endPage: true,
      pagesTotal: true,
      work: { select: { id: true, title: true, coverUrl: true } },
    },
  });
  const readingByFeedPostId = new Map(
    readingSessionsForPosts.filter((r) => r.feedPostId).map((r) => [r.feedPostId!, r]),
  );

  const [rVotes, recVotes, fpVotes] = viewerId
    ? await Promise.all([
        prisma.reviewVote.findMany({
          where: { userId: viewerId, reviewId: { in: reviews.map((x) => x.id) } },
          select: { reviewId: true, value: true },
        }),
        prisma.bookRecommendationVote.findMany({
          where: { userId: viewerId, recommendationId: { in: recommendations.map((x) => x.id) } },
          select: { recommendationId: true, value: true },
        }),
        prisma.feedPostVote.findMany({
          where: { userId: viewerId, feedPostId: { in: feedPosts.map((x) => x.id) } },
          select: { feedPostId: true, value: true },
        }),
      ])
    : [[], [], []];

  const rVoteMap = new Map(rVotes.map((v) => [v.reviewId, v.value]));
  const recVoteMap = new Map(recVotes.map((v) => [v.recommendationId, v.value]));
  const fpVoteMap = new Map(fpVotes.map((v) => [v.feedPostId, v.value]));

  const items: Item[] = [
    ...reviews.map((review) => ({
      kind: "review" as const,
      id: review.id,
      createdAt: review.createdAt.toISOString(),
      score: net(review.upvotesCount, review.downvotesCount),
      myVote: rVoteMap.get(review.id) ?? 0,
      review: {
        ...review,
        attachments: reviewAtt.get(review.id) ?? [],
      },
    })),
    ...recommendations.map((recommendation) => ({
      kind: "recommendation" as const,
      id: recommendation.id,
      createdAt: recommendation.createdAt.toISOString(),
      score: net(recommendation.upvotesCount, recommendation.downvotesCount),
      myVote: recVoteMap.get(recommendation.id) ?? 0,
      recommendation: {
        ...recommendation,
        attachments: recAtt.get(recommendation.id) ?? [],
      },
    })),
    ...feedPosts.map((feedPost) => {
      const rs = readingByFeedPostId.get(feedPost.id);
      return {
        kind: "feed_post" as const,
        id: feedPost.id,
        createdAt: feedPost.createdAt.toISOString(),
        score: net(feedPost.upvotesCount, feedPost.downvotesCount),
        myVote: fpVoteMap.get(feedPost.id) ?? 0,
        feedPost: {
          ...feedPost,
          attachments: fpAtt.get(feedPost.id) ?? [],
          readingLog: rs
            ? {
                sessionId: rs.id,
                readCycle: rs.readCycle,
                medium: rs.medium,
                periodStart: rs.periodStart.toISOString().slice(0, 10),
                periodEnd: rs.periodEnd ? rs.periodEnd.toISOString().slice(0, 10) : null,
                pagesRead: rs.pagesRead,
                readingTimeMinutes: rs.readingTimeMinutes,
                progressPercent: progressPercentFromSessionSnapshot(rs),
                work: rs.work,
              }
            : undefined,
        },
      };
    }),
  ];

  if (s === "new") {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  return NextResponse.json({
    sort: s,
    scope,
    items: items.slice(0, 60),
    ...(scope === "following" && viewerId
      ? {
          followingCount: actorIds ? Math.max(0, actorIds.length - 1) : 0,
        }
      : {}),
  });
}
