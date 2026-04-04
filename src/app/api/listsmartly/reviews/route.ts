import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

// GET /api/listsmartly/reviews - List reviews for profile
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get("platform");
    const sentiment = searchParams.get("sentiment");
    const responseStatus = searchParams.get("responseStatus");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      profileId: profile.id,
      isArchived: false,
    };
    if (platform) where.platform = platform;
    if (sentiment) where.sentiment = sentiment;
    if (responseStatus) where.responseStatus = responseStatus;

    const [reviews, total] = await Promise.all([
      prisma.listingReview.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.listingReview.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reviews: reviews.map((r) => ({
          ...r,
          keywords: JSON.parse(r.keywords),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch reviews" } },
      { status: 500 }
    );
  }
}

// POST /api/listsmartly/reviews - Manual import of reviews
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { reviews } = body;

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: "reviews must be a non-empty array" } },
        { status: 400 }
      );
    }

    let imported = 0;
    let skipped = 0;

    for (const review of reviews) {
      const { platform, authorName, rating, text, publishedAt, externalId } = review;

      if (!platform || !authorName || rating === undefined) {
        skipped++;
        continue;
      }

      // Deduplicate via profileId + platform + externalId
      const dedupeId = externalId || `manual_${authorName}_${rating}_${publishedAt || ""}`;

      try {
        await prisma.listingReview.upsert({
          where: {
            profileId_platform_externalId: {
              profileId: profile.id,
              platform,
              externalId: dedupeId,
            },
          },
          update: {
            authorName,
            rating: parseInt(String(rating), 10),
            text: text || null,
            publishedAt: publishedAt ? new Date(publishedAt) : null,
          },
          create: {
            profileId: profile.id,
            platform,
            externalId: dedupeId,
            authorName,
            rating: parseInt(String(rating), 10),
            text: text || null,
            publishedAt: publishedAt ? new Date(publishedAt) : null,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    // Update profile review stats
    const allReviews = await prisma.listingReview.findMany({
      where: { profileId: profile.id },
      select: { rating: true },
    });
    const totalReviews = allReviews.length;
    const averageRating = totalReviews > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

    await prisma.listSmartlyProfile.update({
      where: { id: profile.id },
      data: { totalReviews, averageRating },
    });

    return NextResponse.json({
      success: true,
      data: { imported, skipped, totalReviews },
    });
  } catch (error) {
    console.error("Import reviews error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to import reviews" } },
      { status: 500 }
    );
  }
}
