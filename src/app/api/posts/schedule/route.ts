import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/posts/schedule - Schedule a post for future publishing
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
    const { postId, scheduledAt } = body as {
      postId: string;
      scheduledAt: string;
    };

    if (!postId || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: { message: "postId and scheduledAt are required" } },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);

    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid date format for scheduledAt" } },
        { status: 400 }
      );
    }

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: { message: "scheduledAt must be in the future" } },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    if (post.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "Not authorized to schedule this post" } },
        { status: 403 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        status: "SCHEDULED",
        scheduledAt: scheduledDate,
        publishedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { post: updatedPost },
    });
  } catch (error) {
    console.error("Schedule post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to schedule post" } },
      { status: 500 }
    );
  }
}

// PATCH /api/posts/schedule - Publish all scheduled posts that are due (called by cron or admin)
export async function PATCH() {
  try {
    const now = new Date();

    const duePosts = await prisma.post.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { lte: now },
      },
      select: { id: true },
    });

    if (duePosts.length === 0) {
      return NextResponse.json({
        success: true,
        data: { publishedCount: 0 },
      });
    }

    await prisma.post.updateMany({
      where: {
        id: { in: duePosts.map((p) => p.id) },
      },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      data: { publishedCount: duePosts.length },
    });
  } catch (error) {
    console.error("Publish scheduled posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to publish scheduled posts" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/schedule - Cancel a scheduled post (postId via search params)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json(
        { success: false, error: { message: "postId search parameter is required" } },
        { status: 400 }
      );
    }

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
        { success: false, error: { message: "Not authorized to cancel this scheduled post" } },
        { status: 403 }
      );
    }

    if (post.status !== "SCHEDULED") {
      return NextResponse.json(
        { success: false, error: { message: "Post is not currently scheduled" } },
        { status: 400 }
      );
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        status: "DRAFT",
        scheduledAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { post: updatedPost },
    });
  } catch (error) {
    console.error("Cancel scheduled post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to cancel scheduled post" } },
      { status: 500 }
    );
  }
}

// GET /api/posts/schedule - Get the current user's scheduled posts
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const scheduledPosts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        status: "SCHEDULED",
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: { posts: scheduledPosts },
    });
  } catch (error) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch scheduled posts" } },
      { status: 500 }
    );
  }
}
