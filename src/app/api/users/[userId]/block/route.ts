import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

// POST /api/users/[userId]/block — Block a user.
// Idempotent: blocking an already-blocked user is a 200 (not 409). Side effect:
// any Follow rows in either direction are removed so the block also implies an
// unfollow. The blocked user is never notified (silent block — standard pattern).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { userId: blockedId } = await params;

    if (!blockedId || typeof blockedId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Invalid user id" } },
        { status: 400 }
      );
    }

    if (session.userId === blockedId) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot block yourself" } },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: blockedId },
      select: { id: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      return NextResponse.json(
        { success: false, error: { message: "User not found" } },
        { status: 404 }
      );
    }

    // Upsert + tear down follow rows in BOTH directions in a single transaction
    // so a block always leaves a consistent state (block exists, no follow rows).
    const [block] = await prisma.$transaction([
      prisma.userBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: session.userId,
            blockedId,
          },
        },
        create: {
          blockerId: session.userId,
          blockedId,
        },
        update: {}, // idempotent — no-op if already blocked
      }),
      prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: session.userId, followingId: blockedId },
            { followerId: blockedId, followingId: session.userId },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        block: {
          id: block.id,
          blockerId: block.blockerId,
          blockedId: block.blockedId,
          createdAt: block.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to block user" } },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[userId]/block — Unblock a user. Idempotent (200 even if
// no block existed).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { userId: blockedId } = await params;

    if (!blockedId || typeof blockedId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "Invalid user id" } },
        { status: 400 }
      );
    }

    await prisma.userBlock.deleteMany({
      where: {
        blockerId: session.userId,
        blockedId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unblock user error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to unblock user" } },
      { status: 500 }
    );
  }
}
