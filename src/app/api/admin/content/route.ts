import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (search) {
      where.caption = { contains: search };
    }

    if (status !== "all") {
      where.status = status.toUpperCase();
    }

    // Fetch posts with user info
    const [posts, total, stats] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.post.count({ where }),
      // Get stats
      Promise.all([
        prisma.post.count({ where: { deletedAt: null } }),
        prisma.post.count({ where: { deletedAt: null, status: "PUBLISHED" } }),
        prisma.post.count({ where: { deletedAt: null, status: "DRAFT" } }),
        prisma.post.count({ where: { deletedAt: null, status: "SCHEDULED" } }),
      ]),
    ]);

    // Format posts
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      title: post.caption || "Untitled Post",
      type: post.mediaType || "text",
      status: post.status.toLowerCase(),
      author: post.user.name || post.user.email,
      authorId: post.user.id,
      createdAt: post.createdAt.toISOString().split("T")[0],
      updatedAt: post.updatedAt.toISOString().split("T")[0],
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
    }));

    return NextResponse.json({
      success: true,
      data: {
        content: formattedPosts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          total: stats[0],
          published: stats[1],
          drafts: stats[2],
          scheduled: stats[3],
        },
      },
    });
  } catch (error) {
    console.error("Admin content error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch content" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Post ID required" } },
        { status: 400 }
      );
    }

    await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete content error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete content" } },
      { status: 500 }
    );
  }
}
