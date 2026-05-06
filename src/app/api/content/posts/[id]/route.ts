import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { extractS3Key, presignAllUrls } from "@/lib/utils/s3-client";

const parseJsonArray = (value: unknown, fallback: string[] = []) => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : fallback;
  } catch {
    return fallback;
  }
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const existing = await prisma.post.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, mediaUrl: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.caption !== undefined) {
      updateData.caption = typeof body.caption === "string" ? body.caption.trim() : null;
    }

    if (body.platforms !== undefined) {
      updateData.platforms = JSON.stringify(parseJsonArray(body.platforms, ["feed"]));
    }

    if (body.mediaUrls !== undefined) {
      const mediaUrls = parseJsonArray(body.mediaUrls);
      const mediaKeys = mediaUrls.map((url) => extractS3Key(url)).filter(Boolean);
      updateData.mediaMeta = mediaKeys.length > 0 ? JSON.stringify(mediaKeys) : null;
      updateData.mediaUrl = mediaKeys[0] || null;
      updateData.mediaType = mediaKeys.length > 0 && body.mediaType === "video" ? "video" : mediaKeys.length > 0 ? "image" : null;
    }

    if (body.scheduledAt !== undefined) {
      const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
      if (body.scheduledAt && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
        return NextResponse.json(
          { success: false, error: { message: "scheduledAt must be a valid date" } },
          { status: 400 }
        );
      }
      updateData.scheduledAt = scheduledAt;
      if (scheduledAt && scheduledAt > new Date()) {
        updateData.status = "SCHEDULED";
        updateData.publishedAt = null;
      }
    }

    if (typeof body.status === "string") {
      const status = body.status.toUpperCase();
      if (["PUBLISHED", "SCHEDULED", "DRAFT"].includes(status)) {
        updateData.status = status;
      }
    }

    const post = await prisma.post.update({
      where: { id },
      data: updateData,
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
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        post: {
          id: post.id,
          caption: post.caption,
          mediaUrls: parseJsonArray(post.mediaMeta, post.mediaUrl ? [post.mediaUrl] : []),
          mediaType: post.mediaType,
          platforms: parseJsonArray(post.platforms, ["feed"]),
          status: post.status,
          scheduledAt: post.scheduledAt?.toISOString() || null,
          publishedAt: post.publishedAt?.toISOString() || null,
          author: {
            id: post.user.id,
            name: post.user.name,
            username: post.user.username,
            avatarUrl: post.user.avatarUrl,
          },
          updatedAt: post.updatedAt.toISOString(),
        },
      }),
    });
  } catch (error) {
    console.error("Update content post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update post" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const post = await prisma.post.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true },
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: { message: "Post not found" } },
        { status: 404 }
      );
    }

    await prisma.post.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete content post error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete post" } },
      { status: 500 }
    );
  }
}
