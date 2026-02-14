import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// GET /api/feed/trending - Get trending topics and suggested users
export async function GET() {
  try {
    const session = await getSession();

    // Get trending hashtags from recent posts
    const recentPosts = await prisma.post.findMany({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      select: { hashtags: true },
    });

    // Count hashtag occurrences
    const hashtagCounts: Record<string, number> = {};
    recentPosts.forEach(post => {
      const hashtags = JSON.parse(post.hashtags || "[]");
      hashtags.forEach((tag: string) => {
        const normalizedTag = tag.toLowerCase();
        hashtagCounts[normalizedTag] = (hashtagCounts[normalizedTag] || 0) + 1;
      });
    });

    // Sort by count and take top 10
    const trendingTopics = Object.entries(hashtagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({
        tag: tag.startsWith("#") ? tag : `#${tag}`,
        postCount: count,
      }));

    // Get suggested users (users with most followers that current user doesn't follow)
    let suggestedUsers: Array<{
      id: string;
      name: string;
      username: string;
      avatarUrl: string | null;
      bio: string | null;
      followersCount: number;
      isFollowing: boolean;
    }> = [];

    if (session) {
      // Get users the current user is already following
      const following = await prisma.follow.findMany({
        where: { followerId: session.userId },
        select: { followingId: true },
      });
      const followingIds = new Set(following.map(f => f.followingId));
      followingIds.add(session.userId); // Exclude self

      // Get top users by follower count
      const users = await prisma.user.findMany({
        where: {
          id: { notIn: Array.from(followingIds) },
          deletedAt: null,
        },
        orderBy: {
          followers: { _count: "desc" },
        },
        take: 5,
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          bio: true,
          _count: { select: { followers: true } },
        },
      });

      suggestedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user._count.followers,
        isFollowing: false,
      }));
    } else {
      // For logged out users, just show popular users
      const users = await prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: {
          followers: { _count: "desc" },
        },
        take: 5,
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          bio: true,
          _count: { select: { followers: true } },
        },
      });

      suggestedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followersCount: user._count.followers,
        isFollowing: false,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        trendingTopics,
        suggestedUsers,
      },
    });
  } catch (error) {
    console.error("Get trending error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch trending data" } },
      { status: 500 }
    );
  }
}
