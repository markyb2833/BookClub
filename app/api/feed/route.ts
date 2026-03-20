import { NextRequest, NextResponse } from "next/server";
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
      where: reviewWhere,
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
        work: { select: { id: true, title: true, coverUrl: true } },
      },
    }),
    prisma.bookRecommendation.findMany({
      where: recWhere,
      take: 120,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, displayName: true, tier: true } },
        work: { select: { id: true, title: true, coverUrl: true } },
        contextWork: { select: { id: true, title: true } },
      },
    }),
    prisma.feedPost.findMany({
      where: feedPostWhere,
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
        feedPost: (typeof feedPosts)[0] & { attachments: unknown[] };
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
    ...feedPosts.map((feedPost) => ({
      kind: "feed_post" as const,
      id: feedPost.id,
      createdAt: feedPost.createdAt.toISOString(),
      score: net(feedPost.upvotesCount, feedPost.downvotesCount),
      myVote: fpVoteMap.get(feedPost.id) ?? 0,
      feedPost: {
        ...feedPost,
        attachments: fpAtt.get(feedPost.id) ?? [],
      },
    })),
  ];

  if (s === "new") {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    items.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  return NextResponse.json({ sort: s, items: items.slice(0, 60) });
}
