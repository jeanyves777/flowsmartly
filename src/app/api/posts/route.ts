import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";

// GET /api/posts - Get feed posts
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);

    const cursor = searchParams.get("cursor");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("userId"); // For profile pages
    const type = searchParams.get("type") || "feed"; // feed, following, trending

    const where: Record<string, unknown> = {
      status: "PUBLISHED",
      deletedAt: null,
    };

    // Filter by specific user if provided
    if (userId) {
      where.userId = userId;
    }

    // If type is "following" and user is logged in, only show posts from followed users
    if (type === "following" && session) {
      const following = await prisma.follow.findMany({
        where: { followerId: session.userId },
        select: { followingId: true },
      });
      const followingIds = following.map(f => f.followingId);
      // Include own posts in following feed
      followingIds.push(session.userId);
      where.userId = { in: followingIds };
    }

    // Fetch posts with pagination
    const posts = await prisma.post.findMany({
      where,
      orderBy: type === "trending"
        ? [{ likeCount: "desc" }, { createdAt: "desc" }]
        : { createdAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            plan: true,
          },
        },
        adCampaign: {
          select: {
            destinationUrl: true,
            cpvCents: true,
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
      },
    });

    // Check if there are more posts
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, -1) : posts;

    // Get user's likes, bookmarks, and ad view earnings if logged in
    let userLikes: Set<string> = new Set();
    let userBookmarks: Set<string> = new Set();
    let userEarnedPosts: Set<string> = new Set();

    if (session) {
      const postIds = postsToReturn.map(p => p.id);
      const promotedPostIds = postsToReturn.filter(p => p.isPromoted).map(p => p.id);

      const [likes, bookmarks, earnedViews] = await Promise.all([
        prisma.like.findMany({
          where: { userId: session.userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        prisma.bookmark.findMany({
          where: { userId: session.userId, postId: { in: postIds } },
          select: { postId: true },
        }),
        promotedPostIds.length > 0
          ? prisma.postView.findMany({
              where: {
                viewerUserId: session.userId,
                postId: { in: promotedPostIds },
                earnedCents: { gt: 0 },
              },
              select: { postId: true },
            })
          : [],
      ]);

      userLikes = new Set(likes.map(l => l.postId));
      userBookmarks = new Set(bookmarks.map(b => b.postId));
      userEarnedPosts = new Set(earnedViews.map(v => v.postId));
    }

    // Format posts for response
    const formattedPosts = postsToReturn.map(post => ({
      id: post.id,
      content: post.caption,
      mediaUrls: post.mediaMeta
        ? (() => { try { return JSON.parse(post.mediaMeta); } catch { return post.mediaUrl ? [post.mediaUrl] : []; } })()
        : post.mediaUrl ? [post.mediaUrl] : [],
      mediaType: post.mediaType,
      hashtags: JSON.parse(post.hashtags || "[]"),
      author: {
        id: post.user.id,
        name: post.user.name,
        username: post.user.username,
        avatarUrl: post.user.avatarUrl,
        isVerified: post.user.plan !== "STARTER",
      },
      likesCount: post.likeCount,
      commentsCount: post._count.comments,
      sharesCount: post.shareCount,
      viewCount: post.viewCount,
      isLiked: userLikes.has(post.id),
      isBookmarked: userBookmarks.has(post.id),
      isPromoted: post.isPromoted,
      hasEarned: userEarnedPosts.has(post.id),
      destinationUrl: post.adCampaign?.destinationUrl || null,
      cpvCents: post.adCampaign?.cpvCents || 0,
      createdAt: post.createdAt.toISOString(),
    }));

    // Fetch active non-post ad campaigns to intersperse in feed
    let adCampaigns: Array<{
      id: string;
      isAdCard: true;
      name: string;
      headline: string | null;
      description: string | null;
      mediaUrl: string | null;
      videoUrl: string | null;
      destinationUrl: string | null;
      ctaText: string | null;
      adType: string;
      adPage: { slug: string } | null;
    }> = [];

    try {
      const { getActiveAdCampaigns } = await import("@/lib/ads/placement-engine");
      const activeCampaigns = await getActiveAdCampaigns({
        excludeUserId: session?.userId,
        limit: 3,
      });
      adCampaigns = activeCampaigns.map(c => ({
        id: c.id,
        isAdCard: true as const,
        name: c.name,
        headline: c.headline,
        description: c.description,
        mediaUrl: c.mediaUrl,
        videoUrl: c.videoUrl,
        destinationUrl: c.destinationUrl,
        ctaText: c.ctaText,
        adType: c.adType,
        adPage: c.adPage,
      }));
    } catch {
      // Ad system failure shouldn't break the feed
    }

    // Interleave ad campaigns into the posts at every 5th position
    const feedItems: Array<(typeof formattedPosts)[number] | (typeof adCampaigns)[number]> = [...formattedPosts];
    for (let i = 0; i < adCampaigns.length; i++) {
      const insertAt = Math.min((i + 1) * 5, feedItems.length);
      feedItems.splice(insertAt, 0, adCampaigns[i]);
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        posts: feedItems,
        nextCursor: hasMore ? postsToReturn[postsToReturn.length - 1].id : null,
        hasMore,
      }),
    });
  } catch (error) {
    console.error("Get posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch posts" } },
      { status: 500 }
    );
  }
}

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { content, mediaUrl, mediaUrls, mediaType, hashtags = [], scheduledAt } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: { message: "Content is required" } },
        { status: 400 }
      );
    }

    // Support both single mediaUrl and array of mediaUrls
    const allMediaUrls: string[] = mediaUrls?.length ? mediaUrls : mediaUrl ? [mediaUrl] : [];
    const primaryMediaUrl = allMediaUrls[0] || null;
    const resolvedMediaType = allMediaUrls.length > 0 ? (mediaType || "image") : null;

    // Extract hashtags from content if not provided
    const extractedHashtags = content.match(/#\w+/g) || [];
    const allHashtags = [...new Set([...hashtags, ...extractedHashtags])];

    // Extract mentions from content
    const mentions = content.match(/@\w+/g) || [];

    const post = await prisma.post.create({
      data: {
        userId: session.userId,
        caption: content,
        mediaUrl: primaryMediaUrl,
        mediaType: resolvedMediaType,
        mediaMeta: allMediaUrls.length > 0 ? JSON.stringify(allMediaUrls) : null,
        hashtags: JSON.stringify(allHashtags),
        mentions: JSON.stringify(mentions),
        status: scheduledAt ? "SCHEDULED" : "PUBLISHED",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        publishedAt: scheduledAt ? null : new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatarUrl: true,
            plan: true,
          },
        },
      },
    });

    // Fire-and-forget: sync strategy tasks when user publishes a post
    if (!scheduledAt) {
      triggerActivitySyncForUser(session.userId).catch((err) =>
        console.error("Activity sync hook (post create) failed:", err)
      );
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        post: {
          id: post.id,
          content: post.caption,
          mediaUrls: allMediaUrls,
          mediaType: resolvedMediaType,
          hashtags: allHashtags,
          author: {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
            isVerified: post.user.plan !== "STARTER",
          },
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          viewCount: 0,
          isLiked: false,
          isBookmarked: false,
          createdAt: post.createdAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create post" } },
      { status: 500 }
    );
  }
}
