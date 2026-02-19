import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET — fetch reviews for an agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { agentId } = await params;

    const reviews = await prisma.agentReview.findMany({
      where: { agentProfileId: agentId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Check if current user already reviewed
    const userReview = reviews.find((r) => r.reviewerUserId === session.userId);

    // Average rating
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        avgRating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        userReview: userReview || null,
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}

// POST — create or update a review
export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { agentId } = await params;
    const body = await request.json();
    const { rating, comment } = body;

    // Validate
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: { message: "Rating must be between 1 and 5" } },
        { status: 400 }
      );
    }
    if (!comment || typeof comment !== "string" || comment.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: { message: "Review must be at least 10 characters" } },
        { status: 400 }
      );
    }
    if (comment.trim().length > 500) {
      return NextResponse.json(
        { success: false, error: { message: "Review must be under 500 characters" } },
        { status: 400 }
      );
    }

    // Check agent exists
    const agent = await prisma.agentProfile.findUnique({
      where: { id: agentId, status: "APPROVED" },
    });
    if (!agent) {
      return NextResponse.json(
        { success: false, error: { message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Can't review yourself
    if (agent.userId === session.userId) {
      return NextResponse.json(
        { success: false, error: { message: "You cannot review yourself" } },
        { status: 400 }
      );
    }

    // Upsert review (one per user per agent)
    const review = await prisma.agentReview.upsert({
      where: {
        agentProfileId_reviewerUserId: {
          agentProfileId: agentId,
          reviewerUserId: session.userId,
        },
      },
      create: {
        agentProfileId: agentId,
        reviewerUserId: session.userId,
        rating: Math.round(rating),
        comment: comment.trim(),
      },
      update: {
        rating: Math.round(rating),
        comment: comment.trim(),
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { review },
    });
  } catch (error) {
    console.error("Create review error:", error);
    return NextResponse.json(
      { success: false, error: { message: "An error occurred" } },
      { status: 500 }
    );
  }
}
