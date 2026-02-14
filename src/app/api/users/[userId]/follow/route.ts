import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/users/[userId]/follow - Follow a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    if (session.userId === targetUserId) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot follow yourself" } },
        { status: 400 }
      );
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    });

    if (existingFollow) {
      return NextResponse.json(
        { success: false, error: { message: "Already following" } },
        { status: 400 }
      );
    }

    await prisma.follow.create({
      data: {
        followerId: session.userId,
        followingId: targetUserId,
      },
    });

    // Create notification for followed user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: "FOLLOW",
        title: "New Follower",
        message: `${session.user.name} started following you`,
        data: JSON.stringify({ userId: session.userId }),
        actionUrl: `/profile/${session.user.username}`,
      },
    }).catch(() => {
      // Ignore notification errors
    });

    return NextResponse.json({
      success: true,
      data: { following: true },
    });
  } catch (error) {
    console.error("Follow user error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to follow user" } },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[userId]/follow - Unfollow a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    });

    if (!existingFollow) {
      return NextResponse.json(
        { success: false, error: { message: "Not following" } },
        { status: 400 }
      );
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: targetUserId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { following: false },
    });
  } catch (error) {
    console.error("Unfollow user error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to unfollow user" } },
      { status: 500 }
    );
  }
}
