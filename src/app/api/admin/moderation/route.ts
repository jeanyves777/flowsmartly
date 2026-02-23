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
    const status = searchParams.get("status") || "all";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { post: { caption: { contains: search } } },
        { comment: { content: { contains: search } } },
        { reporter: { name: { contains: search } } },
        { reporter: { email: { contains: search } } },
      ];
    }

    // Fetch flags with related data
    const [flags, total, statsData] = await Promise.all([
      prisma.contentFlag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: { id: true, name: true, email: true },
          },
          post: {
            select: {
              id: true,
              caption: true,
              userId: true,
              deletedAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
              userId: true,
              deletedAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.contentFlag.count({ where }),
      // Get stats
      Promise.all([
        prisma.contentFlag.count({ where: { status: "pending" } }),
        prisma.contentFlag.count({
          where: {
            reviewedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.contentFlag.count({ where: { resolution: "removed" } }),
        prisma.contentFlag.count(),
      ]),
    ]);

    // Format flags for the frontend
    const formattedFlags = flags.map((flag) => {
      const author = flag.post?.user || flag.comment?.user;
      const content = flag.contentType === "post"
        ? flag.post?.caption || "No content"
        : flag.comment?.content || "No content";
      const isDeleted = flag.contentType === "post"
        ? !!flag.post?.deletedAt
        : !!flag.comment?.deletedAt;

      return {
        id: flag.id,
        contentType: flag.contentType,
        postId: flag.postId,
        commentId: flag.commentId,
        content: content.length > 120 ? content.substring(0, 120) + "..." : content,
        author: author ? { id: author.id, name: author.name, email: author.email } : null,
        reporter: { id: flag.reporter.id, name: flag.reporter.name, email: flag.reporter.email },
        reason: flag.reason,
        description: flag.description,
        status: flag.status,
        resolution: flag.resolution,
        reviewedBy: flag.reviewedBy,
        reviewedAt: flag.reviewedAt?.toISOString() || null,
        createdAt: flag.createdAt.toISOString(),
        isDeleted,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        flags: formattedFlags,
        stats: {
          pending: statsData[0],
          reviewedToday: statsData[1],
          autoRemoved: statsData[2],
          total: statsData[3],
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Admin moderation list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch moderation flags" } },
      { status: 500 }
    );
  }
}
