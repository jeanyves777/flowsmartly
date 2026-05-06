import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/content/schedule - Fetch all scheduled posts for a given month
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
    const month = searchParams.get("month"); // YYYY-MM format

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message:
              "month query parameter is required in YYYY-MM format (e.g. 2026-02)",
          },
        },
        { status: 400 }
      );
    }

    const [year, monthNum] = month.split("-").map(Number);
    const startOfMonth = new Date(year, monthNum - 1, 1);
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999);

    const [posts, strategyTasks] = await Promise.all([
      prisma.post.findMany({
        where: {
          userId: session.userId,
          status: "SCHEDULED",
          scheduledAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
          deletedAt: null,
        },
        orderBy: { scheduledAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.strategyTask.findMany({
        where: {
          OR: [
            {
              dueDate: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
            {
              startDate: {
                gte: startOfMonth,
                lte: endOfMonth,
              },
            },
          ],
          strategy: {
            userId: session.userId,
            status: "ACTIVE",
          },
        },
        orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const formattedPosts = posts.map((post) => ({
      id: post.id,
      itemType: "post",
      caption: post.caption,
      mediaUrl: post.mediaUrl,
      mediaUrls: post.mediaMeta
        ? (() => { try { return JSON.parse(post.mediaMeta); } catch { return post.mediaUrl ? [post.mediaUrl] : []; } })()
        : post.mediaUrl ? [post.mediaUrl] : [],
      mediaThumbnails: post.thumbnailUrl ? [post.thumbnailUrl] : [],
      mediaType: post.mediaType,
      status: "scheduled",
      platforms: (() => {
        try {
          return JSON.parse(post.platforms || "[]");
        } catch {
          return [];
        }
      })(),
      scheduledAt: post.scheduledAt?.toISOString() || null,
      user: {
        id: post.user.id,
        name: post.user.name,
        username: post.user.username,
        avatarUrl: post.user.avatarUrl,
      },
      createdAt: post.createdAt.toISOString(),
    }));

    const formattedStrategyItems = strategyTasks.map((task) => ({
      id: task.id,
      itemType: "strategy",
      caption: task.title,
      title: task.title,
      description: task.description || null,
      mediaUrl: null,
      mediaUrls: [],
      mediaThumbnails: [],
      mediaType: null,
      status: task.status.toLowerCase(),
      platforms: ["strategy"],
      scheduledAt: task.dueDate?.toISOString() || task.startDate?.toISOString() || null,
      publishedAt: null,
      createdAt: task.createdAt.toISOString(),
      startDate: task.startDate?.toISOString() || null,
      dueDate: task.dueDate?.toISOString() || null,
      priority: task.priority,
      category: task.category,
      strategyName: task.strategy.name,
      strategyId: task.strategy.id,
      progress: task.progress,
    }));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        posts: formattedPosts,
        strategyItems: formattedStrategyItems,
        items: [...formattedPosts, ...formattedStrategyItems].sort((a, b) => {
          const aTime = new Date(a.scheduledAt || a.createdAt).getTime();
          const bTime = new Date(b.scheduledAt || b.createdAt).getTime();
          return aTime - bTime;
        }),
        month,
        totalScheduled: formattedPosts.length,
        totalStrategyItems: formattedStrategyItems.length,
      }),
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch scheduled posts" } },
      { status: 500 }
    );
  }
}

// PATCH /api/content/schedule - Reschedule a post
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { postId, scheduledAt } = body;

    if (!postId) {
      return NextResponse.json(
        { success: false, error: { message: "postId is required" } },
        { status: 400 }
      );
    }

    if (!scheduledAt) {
      return NextResponse.json(
        { success: false, error: { message: "scheduledAt is required" } },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Invalid date format for scheduledAt" },
        },
        { status: 400 }
      );
    }

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "scheduledAt must be in the future" },
        },
        { status: 400 }
      );
    }

    // Find the post and validate ownership
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, status: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    if (post.userId !== session.userId) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Not authorized to reschedule this post" },
        },
        { status: 403 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        scheduledAt: scheduledDate,
        status: "SCHEDULED",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        post: {
          id: updatedPost.id,
          scheduledAt: updatedPost.scheduledAt?.toISOString() || null,
          status: updatedPost.status,
        },
      },
    });
  } catch (error) {
    console.error("Reschedule post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to reschedule post" } },
      { status: 500 }
    );
  }
}
