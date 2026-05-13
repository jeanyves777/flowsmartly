import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { importReviews } from "@/lib/listsmartly/review-aggregator";

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
    const responded = searchParams.get("responded");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      profileId: profile.id,
      isArchived: false,
    };
    if (platform && platform !== "all") where.platform = platform;
    if (sentiment && sentiment !== "all") where.sentiment = sentiment;
    if (responseStatus) where.responseStatus = responseStatus;
    if (responded === "true") where.responseStatus = { not: "none" };
    if (responded === "false") where.responseStatus = "none";

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
          hasResponse: r.responseStatus !== "none",
          responseText: r.postedResponse || r.aiDraftResponse || null,
          createdAt: (r.publishedAt || r.createdAt).toISOString(),
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

    const result = await importReviews(profile.id, reviews);
    const totalReviews = await prisma.listingReview.count({ where: { profileId: profile.id } });

    return NextResponse.json({
      success: true,
      data: { ...result, totalReviews },
    });
  } catch (error) {
    console.error("Import reviews error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to import reviews" } },
      { status: 500 }
    );
  }
}
