import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";
import { FEATURE_CATALOG } from "@/lib/features/catalog";

/**
 * GET /api/admin/features — Get all features with plan mappings
 */
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    const features = await prisma.feature.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      include: {
        planFeatures: true,
        _count: { select: { userFeatures: { where: { isActive: true } } } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        features: features.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          description: f.description,
          category: f.category,
          icon: f.icon,
          route: f.route,
          isActive: f.isActive,
          sortOrder: f.sortOrder,
          activeUsers: f._count.userFeatures,
          planMappings: f.planFeatures.map((pf) => ({
            planId: pf.planId,
            limitValue: pf.limitValue,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Admin features GET error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * POST /api/admin/features — Seed/sync features from catalog
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === "seed") {
      // Import and run seed
      const { seedFeatures } = await import("@/lib/features/seed");
      await seedFeatures();
      return NextResponse.json({ success: true, data: { message: "Features seeded successfully" } });
    }

    if (action === "toggle") {
      const { featureId, isActive } = body;
      await prisma.feature.update({
        where: { id: featureId },
        data: { isActive },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "update-plan-mapping") {
      const { featureId, planId, enabled, limitValue } = body;
      if (enabled) {
        await prisma.planFeature.upsert({
          where: { planId_featureId: { planId, featureId } },
          create: { planId, featureId, limitValue: limitValue || null },
          update: { limitValue: limitValue || null },
        });
      } else {
        await prisma.planFeature.deleteMany({
          where: { planId, featureId },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: { code: "INVALID_ACTION" } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Admin features POST error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
