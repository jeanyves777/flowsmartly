import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { notifyContentRemoved, notifyContentWarning } from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { flagId } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!["approve", "remove", "warn", "suspend"].includes(action)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid action" } },
        { status: 400 }
      );
    }

    // Get the flag with related content
    const flag = await prisma.contentFlag.findUnique({
      where: { id: flagId },
      include: {
        post: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        comment: {
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!flag) {
      return NextResponse.json(
        { success: false, error: { message: "Flag not found" } },
        { status: 404 }
      );
    }

    const contentOwner = flag.post?.user || flag.comment?.user;
    const contentUserId = flag.post?.userId || flag.comment?.userId;

    switch (action) {
      case "approve": {
        // Dismiss the flag — content is fine
        await prisma.contentFlag.update({
          where: { id: flagId },
          data: {
            status: "dismissed",
            resolution: "approved",
            reviewedBy: session.adminId,
            reviewedAt: new Date(),
          },
        });
        break;
      }

      case "remove": {
        // Mark flag as actioned, soft-delete the content
        await prisma.$transaction(async (tx) => {
          await tx.contentFlag.update({
            where: { id: flagId },
            data: {
              status: "actioned",
              resolution: "removed",
              reviewedBy: session.adminId,
              reviewedAt: new Date(),
            },
          });

          if (flag.contentType === "post" && flag.postId) {
            await tx.post.update({
              where: { id: flag.postId },
              data: { deletedAt: new Date() },
            });
          } else if (flag.contentType === "comment" && flag.commentId) {
            await tx.comment.update({
              where: { id: flag.commentId },
              data: { deletedAt: new Date() },
            });
          }
        });

        // Send notification to content owner
        if (contentOwner) {
          notifyContentRemoved({
            userId: contentOwner.id,
            email: contentOwner.email,
            name: contentOwner.name || "User",
            contentType: flag.contentType as "post" | "comment",
            reason: reason || flag.reason,
          }).catch((err) => console.error("Failed to notify content removed:", err));
        }
        break;
      }

      case "warn": {
        // Flag as actioned with warning
        await prisma.contentFlag.update({
          where: { id: flagId },
          data: {
            status: "actioned",
            resolution: "warned",
            reviewedBy: session.adminId,
            reviewedAt: new Date(),
          },
        });

        // Send warning notification
        if (contentOwner) {
          notifyContentWarning({
            userId: contentOwner.id,
            email: contentOwner.email,
            name: contentOwner.name || "User",
            reason: reason || flag.reason,
          }).catch((err) => console.error("Failed to notify content warning:", err));
        }
        break;
      }

      case "suspend": {
        // Flag as actioned, soft-delete content, suspend user
        await prisma.$transaction(async (tx) => {
          await tx.contentFlag.update({
            where: { id: flagId },
            data: {
              status: "actioned",
              resolution: "suspended",
              reviewedBy: session.adminId,
              reviewedAt: new Date(),
            },
          });

          // Soft-delete the content
          if (flag.contentType === "post" && flag.postId) {
            await tx.post.update({
              where: { id: flag.postId },
              data: { deletedAt: new Date() },
            });
          } else if (flag.contentType === "comment" && flag.commentId) {
            await tx.comment.update({
              where: { id: flag.commentId },
              data: { deletedAt: new Date() },
            });
          }

          // Suspend the user
          if (contentUserId) {
            await tx.user.update({
              where: { id: contentUserId },
              data: { deletedAt: new Date() },
            });
          }
        });

        // Notify about removal
        if (contentOwner) {
          notifyContentRemoved({
            userId: contentOwner.id,
            email: contentOwner.email,
            name: contentOwner.name || "User",
            contentType: flag.contentType as "post" | "comment",
            reason: reason || "Account suspended due to policy violations",
          }).catch((err) => console.error("Failed to notify suspension:", err));
        }
        break;
      }
    }

    // Create moderation log entry
    await prisma.moderationLog.create({
      data: {
        adminId: session.adminId,
        contentType: flag.contentType,
        postId: flag.postId,
        commentId: flag.commentId,
        userId: contentUserId || null,
        action,
        reason: reason || flag.reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin moderation action error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to process moderation action" } },
      { status: 500 }
    );
  }
}
