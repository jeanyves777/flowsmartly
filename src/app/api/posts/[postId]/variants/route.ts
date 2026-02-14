import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";

const VARIANT_LABELS = ["A", "B", "C", "D", "E"];
const MAX_VARIANTS = 5;

// GET /api/posts/[postId]/variants - List all variants for a post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Verify the post exists and belongs to the user
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
        { success: false, error: { message: "Not authorized to view variants for this post" } },
        { status: 403 }
      );
    }

    const variants = await prisma.contentVariant.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls(variants),
    });
  } catch (error) {
    console.error("List variants error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch variants" } },
      { status: 500 }
    );
  }
}

// POST /api/posts/[postId]/variants - Create a new variant for the post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Verify the post exists and belongs to the user
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
        { success: false, error: { message: "Not authorized to create variants for this post" } },
        { status: 403 }
      );
    }

    // Check existing variant count
    const existingVariants = await prisma.contentVariant.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      select: { variantLabel: true },
    });

    if (existingVariants.length >= MAX_VARIANTS) {
      return NextResponse.json(
        { success: false, error: { message: `Maximum of ${MAX_VARIANTS} variants per post reached` } },
        { status: 400 }
      );
    }

    // Auto-assign next variant label
    const usedLabels = new Set(existingVariants.map((v: { variantLabel: string }) => v.variantLabel));
    const nextLabel = VARIANT_LABELS.find((label) => !usedLabels.has(label));

    if (!nextLabel) {
      return NextResponse.json(
        { success: false, error: { message: "No available variant labels" } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, headline, imageUrl } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "Content is required" } },
        { status: 400 }
      );
    }

    const variant = await prisma.contentVariant.create({
      data: {
        userId: session.userId,
        postId,
        variantLabel: nextLabel,
        content: content.trim(),
        headline: headline?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls(variant),
    });
  } catch (error) {
    console.error("Create variant error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create variant" } },
      { status: 500 }
    );
  }
}

// PATCH /api/posts/[postId]/variants - Update variant metrics or mark winner
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Verify the post exists and belongs to the user
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
        { success: false, error: { message: "Not authorized to update variants for this post" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { variantId, impressions, clicks, conversions, isWinner } = body;

    if (!variantId || typeof variantId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "variantId is required" } },
        { status: 400 }
      );
    }

    // Verify the variant belongs to this post
    const existingVariant = await prisma.contentVariant.findUnique({
      where: { id: variantId },
    });

    if (!existingVariant || existingVariant.postId !== postId) {
      return NextResponse.json(
        { success: false, error: { message: "Variant not found for this post" } },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (impressions !== undefined) {
      if (typeof impressions !== "number" || impressions < 0) {
        return NextResponse.json(
          { success: false, error: { message: "impressions must be a non-negative number" } },
          { status: 400 }
        );
      }
      updateData.impressions = impressions;
    }

    if (clicks !== undefined) {
      if (typeof clicks !== "number" || clicks < 0) {
        return NextResponse.json(
          { success: false, error: { message: "clicks must be a non-negative number" } },
          { status: 400 }
        );
      }
      updateData.clicks = clicks;
    }

    if (conversions !== undefined) {
      if (typeof conversions !== "number" || conversions < 0) {
        return NextResponse.json(
          { success: false, error: { message: "conversions must be a non-negative number" } },
          { status: 400 }
        );
      }
      updateData.conversions = conversions;
    }

    if (isWinner !== undefined) {
      if (typeof isWinner !== "boolean") {
        return NextResponse.json(
          { success: false, error: { message: "isWinner must be a boolean" } },
          { status: 400 }
        );
      }
      updateData.isWinner = isWinner;
    }

    // If marking a winner, set all other variants' isWinner to false
    if (isWinner === true) {
      await prisma.contentVariant.updateMany({
        where: {
          postId,
          id: { not: variantId },
        },
        data: { isWinner: false },
      });
    }

    // Recalculate engagementRate using the final values
    const finalImpressions = impressions !== undefined ? impressions : existingVariant.impressions;
    const finalClicks = clicks !== undefined ? clicks : existingVariant.clicks;
    updateData.engagementRate = (finalClicks / Math.max(finalImpressions, 1)) * 100;

    const variant = await prisma.contentVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: await presignAllUrls(variant),
    });
  } catch (error) {
    console.error("Update variant error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update variant" } },
      { status: 500 }
    );
  }
}

// DELETE /api/posts/[postId]/variants - Delete a variant
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { postId } = await params;
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Verify the post exists and belongs to the user
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
        { success: false, error: { message: "Not authorized to delete variants for this post" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { variantId } = body;

    if (!variantId || typeof variantId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "variantId is required" } },
        { status: 400 }
      );
    }

    // Verify the variant belongs to this post
    const existingVariant = await prisma.contentVariant.findUnique({
      where: { id: variantId },
    });

    if (!existingVariant || existingVariant.postId !== postId) {
      return NextResponse.json(
        { success: false, error: { message: "Variant not found for this post" } },
        { status: 404 }
      );
    }

    // Cannot delete if only 1 variant remains
    const variantCount = await prisma.contentVariant.count({
      where: { postId },
    });

    if (variantCount <= 1) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot delete the last remaining variant" } },
        { status: 400 }
      );
    }

    await prisma.contentVariant.delete({
      where: { id: variantId },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Delete variant error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete variant" } },
      { status: 500 }
    );
  }
}
