import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/listsmartly - List all ListSmartly profiles
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [profiles, total, stats] = await Promise.all([
      prisma.listSmartlyProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
          _count: { select: { listings: true, reviews: true } },
        },
      }),
      prisma.listSmartlyProfile.count({ where }),
      Promise.all([
        prisma.listSmartlyProfile.count(),
        prisma.listSmartlyProfile.count({ where: { setupComplete: true } }),
        prisma.listSmartlyProfile.count({ where: { lsSubscriptionStatus: "active" } }),
        prisma.businessListing.count(),
        prisma.listSmartlyProfile.aggregate({ _avg: { citationScore: true, averageRating: true } }),
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profiles: profiles.map((p) => ({
          id: p.id,
          businessName: p.businessName,
          industry: p.industry,
          city: p.city,
          state: p.state,
          lsPlan: p.lsPlan,
          lsSubscriptionStatus: p.lsSubscriptionStatus,
          setupComplete: p.setupComplete,
          totalListings: p.totalListings,
          liveListings: p.liveListings,
          citationScore: p.citationScore,
          totalReviews: p.totalReviews,
          averageRating: p.averageRating,
          createdAt: p.createdAt.toISOString(),
          user: p.user,
          _count: p._count,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        stats: {
          totalProfiles: stats[0],
          setupComplete: stats[1],
          activeSubscriptions: stats[2],
          totalListings: stats[3],
          avgCitationScore: Math.round(stats[4]._avg.citationScore || 0),
          avgRating: Number((stats[4]._avg.averageRating || 0).toFixed(1)),
        },
      },
    });
  } catch (error) {
    console.error("Admin ListSmartly error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to fetch ListSmartly data" } }, { status: 500 });
  }
}
