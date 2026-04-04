import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// PUT /api/listsmartly/reviews/[id] - Update a review
export async function PUT(
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

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const review = await prisma.listingReview.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!review) {
      return NextResponse.json(
        { success: false, error: { message: "Review not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.responseStatus !== undefined) updateData.responseStatus = body.responseStatus;
    if (body.postedResponse !== undefined) updateData.postedResponse = body.postedResponse;
    if (body.respondedAt !== undefined) updateData.respondedAt = body.respondedAt ? new Date(body.respondedAt) : null;
    if (body.isFlagged !== undefined) updateData.isFlagged = Boolean(body.isFlagged);
    if (body.isArchived !== undefined) updateData.isArchived = Boolean(body.isArchived);

    // Auto-set respondedAt when posting a response
    if (body.responseStatus === "posted" && body.postedResponse && !body.respondedAt) {
      updateData.respondedAt = new Date();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        data: { review: { ...review, keywords: JSON.parse(review.keywords) } },
      });
    }

    const updated = await prisma.listingReview.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        review: {
          ...updated,
          keywords: JSON.parse(updated.keywords),
        },
      },
    });
  } catch (error) {
    console.error("Update review error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update review" } },
      { status: 500 }
    );
  }
}
