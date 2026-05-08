import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

type DayStats = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  posts: number;
  boostedViews: number;
  organicViews: number;
};

function getRangeStart(range: string, now: Date) {
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
}

function dayKey(value: Date) {
  return value.toISOString().split("T")[0];
}

function emptyDayStats(): DayStats {
  return {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
    posts: 0,
    boostedViews: 0,
    organicViews: 0,
  };
}

function calcGrowth(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function parseJsonArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parsePublishResults(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.entries(parsed)
      .filter(([, result]) => {
        if (!result || typeof result !== "object") return false;
        const record = result as Record<string, unknown>;
        return record.success === true || record.status === "success" || record.published === true;
      })
      .map(([platform]) => platform);
  } catch {
    return [];
  }
}

function getPublishedPlatforms(platforms: string, publishResults: string | null) {
  const selected = parseJsonArray(platforms);
  const successful = parsePublishResults(publishResults);
  const next = new Set<string>();

  if (selected.includes("feed") || successful.length === 0) {
    next.add("feed");
  }
  for (const platform of successful.length ? successful : selected) {
    next.add(platform);
  }

  return Array.from(next);
}

function createDayMap(startDate: Date, now: Date) {
  const map = new Map<string, DayStats>();
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    map.set(dayKey(cursor), emptyDayStats());
    cursor.setDate(cursor.getDate() + 1);
  }

  return map;
}

function incrementDay(map: Map<string, DayStats>, date: Date, updater: (stats: DayStats) => void) {
  const key = dayKey(date);
  const current = map.get(key) || emptyDayStats();
  updater(current);
  map.set(key, current);
}

function extractPostIdFromEvent(properties: string) {
  try {
    const parsed = JSON.parse(properties || "{}");
    return typeof parsed.postId === "string" ? parsed.postId : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";
    const now = new Date();
    const startDate = getRangeStart(range, now);
    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));

    const ownedPostFilter = {
      userId: session.userId,
      status: "PUBLISHED",
      deletedAt: null,
    };
    const currentDateFilter = { gte: startDate };
    const previousDateFilter = { gte: previousStartDate, lt: startDate };

    const [
      trackedViews,
      previousTrackedViews,
      legacyViews,
      previousLegacyViews,
      totalLikes,
      previousLikes,
      totalComments,
      previousComments,
      totalShares,
      previousShares,
      totalClicks,
      previousClicks,
      totalFollowers,
      previousFollowers,
      postsThisPeriod,
      boostedPostCount,
      organicPostCount,
      activeCampaigns,
      totalAdSpent,
      totalImpressions,
      totalAdEarnings,
      topPosts,
      postsForPlatforms,
      viewEvents,
      likeEvents,
      commentEvents,
      shareEvents,
      clickEvents,
      postEvents,
    ] = await Promise.all([
      prisma.postView.count({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
      }),
      prisma.postView.count({
        where: { createdAt: previousDateFilter, post: ownedPostFilter },
      }),
      prisma.post.aggregate({
        where: { ...ownedPostFilter, createdAt: currentDateFilter },
        _sum: { viewCount: true },
      }),
      prisma.post.aggregate({
        where: { ...ownedPostFilter, createdAt: previousDateFilter },
        _sum: { viewCount: true },
      }),
      prisma.like.count({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
      }),
      prisma.like.count({
        where: { createdAt: previousDateFilter, post: ownedPostFilter },
      }),
      prisma.comment.count({
        where: { createdAt: currentDateFilter, deletedAt: null, post: ownedPostFilter },
      }),
      prisma.comment.count({
        where: { createdAt: previousDateFilter, deletedAt: null, post: ownedPostFilter },
      }),
      prisma.share.count({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
      }),
      prisma.share.count({
        where: { createdAt: previousDateFilter, post: ownedPostFilter },
      }),
      prisma.trackingEvent.count({
        where: { userId: session.userId, eventName: "post_click", createdAt: currentDateFilter },
      }),
      prisma.trackingEvent.count({
        where: { userId: session.userId, eventName: "post_click", createdAt: previousDateFilter },
      }),
      prisma.follow.count({
        where: { followingId: session.userId, createdAt: currentDateFilter },
      }),
      prisma.follow.count({
        where: { followingId: session.userId, createdAt: previousDateFilter },
      }),
      prisma.post.count({
        where: { ...ownedPostFilter, createdAt: currentDateFilter },
      }),
      prisma.post.count({
        where: { ...ownedPostFilter, createdAt: currentDateFilter, isPromoted: true },
      }),
      prisma.post.count({
        where: { ...ownedPostFilter, createdAt: currentDateFilter, isPromoted: false },
      }),
      prisma.adCampaign.count({ where: { userId: session.userId, status: "ACTIVE" } }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { spentCents: true },
      }),
      prisma.adCampaign.aggregate({
        where: { userId: session.userId },
        _sum: { impressions: true },
      }),
      prisma.earning.aggregate({
        where: { userId: session.userId, source: "AD_VIEW" },
        _sum: { amountCents: true },
      }),
      prisma.post.findMany({
        where: ownedPostFilter,
        orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
        take: 6,
        select: {
          id: true,
          caption: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          createdAt: true,
          _count: { select: { postViews: true } },
        },
      }),
      prisma.post.findMany({
        where: { ...ownedPostFilter, createdAt: currentDateFilter },
        select: {
          id: true,
          createdAt: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
          isPromoted: true,
          platforms: true,
          publishResults: true,
        },
      }),
      prisma.postView.findMany({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
        select: { createdAt: true, postId: true, post: { select: { isPromoted: true } } },
      }),
      prisma.like.findMany({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
        select: { createdAt: true, postId: true },
      }),
      prisma.comment.findMany({
        where: { createdAt: currentDateFilter, deletedAt: null, post: ownedPostFilter },
        select: { createdAt: true, postId: true },
      }),
      prisma.share.findMany({
        where: { createdAt: currentDateFilter, post: ownedPostFilter },
        select: { createdAt: true, postId: true },
      }),
      prisma.trackingEvent.findMany({
        where: { userId: session.userId, eventName: "post_click", createdAt: currentDateFilter },
        select: { createdAt: true, properties: true },
      }),
      prisma.post.findMany({
        where: { ...ownedPostFilter, createdAt: currentDateFilter },
        select: { createdAt: true },
      }),
    ]);

    const viewsTotal = trackedViews || legacyViews._sum.viewCount || 0;
    const viewsPrevious = previousTrackedViews || previousLegacyViews._sum.viewCount || 0;
    const totalActions = totalLikes + totalComments + totalShares + totalClicks;
    const engagementRate = viewsTotal > 0
      ? Math.round((totalActions / viewsTotal) * 100 * 10) / 10
      : 0;

    const [
      boostedViews,
      organicViews,
      boostedLikes,
      organicLikes,
      boostedComments,
      organicComments,
      boostedShares,
      organicShares,
    ] = await Promise.all([
      prisma.postView.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: true } },
      }),
      prisma.postView.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: false } },
      }),
      prisma.like.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: true } },
      }),
      prisma.like.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: false } },
      }),
      prisma.comment.count({
        where: { createdAt: currentDateFilter, deletedAt: null, post: { ...ownedPostFilter, isPromoted: true } },
      }),
      prisma.comment.count({
        where: { createdAt: currentDateFilter, deletedAt: null, post: { ...ownedPostFilter, isPromoted: false } },
      }),
      prisma.share.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: true } },
      }),
      prisma.share.count({
        where: { createdAt: currentDateFilter, post: { ...ownedPostFilter, isPromoted: false } },
      }),
    ]);

    const dayMap = createDayMap(startDate, now);
    for (const event of viewEvents) {
      incrementDay(dayMap, event.createdAt, (stats) => {
        stats.views += 1;
        if (event.post.isPromoted) stats.boostedViews += 1;
        else stats.organicViews += 1;
      });
    }
    for (const event of likeEvents) {
      incrementDay(dayMap, event.createdAt, (stats) => {
        stats.likes += 1;
      });
    }
    for (const event of commentEvents) {
      incrementDay(dayMap, event.createdAt, (stats) => {
        stats.comments += 1;
      });
    }
    for (const event of shareEvents) {
      incrementDay(dayMap, event.createdAt, (stats) => {
        stats.shares += 1;
      });
    }
    for (const event of clickEvents) {
      incrementDay(dayMap, event.createdAt, (stats) => {
        stats.clicks += 1;
      });
    }
    for (const post of postEvents) {
      incrementDay(dayMap, post.createdAt, (stats) => {
        stats.posts += 1;
      });
    }

    const chartData = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        ...data,
      }));

    const postPlatformMap = new Map<string, string[]>();
    const platformMap = new Map<string, {
      posts: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      clicks: number;
      boostedPosts: number;
      lastPostAt: Date | null;
    }>();

    for (const post of postsForPlatforms) {
      const publishedPlatforms = getPublishedPlatforms(post.platforms, post.publishResults);
      postPlatformMap.set(post.id, publishedPlatforms);

      for (const platform of publishedPlatforms) {
        const current = platformMap.get(platform) || {
          posts: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          clicks: 0,
          boostedPosts: 0,
          lastPostAt: null,
        };
        current.posts += 1;
        current.views += post.viewCount;
        current.likes += post.likeCount;
        current.comments += post.commentCount;
        current.shares += post.shareCount;
        if (post.isPromoted) current.boostedPosts += 1;
        if (!current.lastPostAt || post.createdAt > current.lastPostAt) current.lastPostAt = post.createdAt;
        platformMap.set(platform, current);
      }
    }

    const clickCountByPost = new Map<string, number>();
    for (const event of clickEvents) {
      const postId = extractPostIdFromEvent(event.properties);
      if (!postId) continue;
      clickCountByPost.set(postId, (clickCountByPost.get(postId) || 0) + 1);
      const platforms = postPlatformMap.get(postId) || ["feed"];
      for (const platform of platforms) {
        const current = platformMap.get(platform);
        if (current) current.clicks += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          views: viewsTotal,
          viewsChange: calcGrowth(viewsTotal, viewsPrevious),
          likes: totalLikes,
          likesChange: calcGrowth(totalLikes, previousLikes),
          comments: totalComments,
          commentsChange: calcGrowth(totalComments, previousComments),
          shares: totalShares,
          sharesChange: calcGrowth(totalShares, previousShares),
          clicks: totalClicks,
          clicksChange: calcGrowth(totalClicks, previousClicks),
          followers: totalFollowers,
          followersChange: calcGrowth(totalFollowers, previousFollowers),
          engagementRate,
          postsThisPeriod,
        },
        boostedVsOrganic: {
          boosted: {
            posts: boostedPostCount,
            views: boostedViews,
            likes: boostedLikes,
            comments: boostedComments,
            shares: boostedShares,
          },
          organic: {
            posts: organicPostCount,
            views: organicViews,
            likes: organicLikes,
            comments: organicComments,
            shares: organicShares,
          },
        },
        adStats: {
          activeCampaigns,
          totalSpent: (totalAdSpent._sum.spentCents || 0) / 100,
          totalImpressions: totalImpressions._sum.impressions || 0,
          totalEarned: (totalAdEarnings._sum.amountCents || 0) / 100,
        },
        chartData,
        platformStats: Array.from(platformMap.entries())
          .map(([platform, data]) => ({
            platform,
            ...data,
            lastPostAt: data.lastPostAt?.toISOString() || null,
          }))
          .sort((a, b) => b.views + b.clicks - (a.views + a.clicks)),
        topPosts: topPosts.map(post => ({
          id: post.id,
          content: post.caption?.substring(0, 100) + (post.caption && post.caption.length > 100 ? "..." : ""),
          views: post._count.postViews || post.viewCount,
          likes: post.likeCount,
          comments: post.commentCount,
          shares: post.shareCount,
          clicks: clickCountByPost.get(post.id) || 0,
          createdAt: post.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch analytics" } },
      { status: 500 }
    );
  }
}
