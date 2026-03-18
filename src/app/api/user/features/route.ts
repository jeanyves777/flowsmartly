import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserFeatures } from "@/lib/features/access";
import { prisma } from "@/lib/db/client";
import { FEATURE_CATALOG } from "@/lib/features/catalog";

/**
 * GET /api/user/features — Get user's activated features (for sidebar rendering)
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const features = await getUserFeatures(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        features: features.map((f) => ({
          slug: f.slug,
          name: f.name,
          category: f.category,
          icon: f.icon,
          route: f.route,
          routes: JSON.parse(f.routes || "[]"),
        })),
      },
    });
  } catch (error) {
    console.error("User features GET error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * PUT /api/user/features — Update user's activated features (from settings/feature picker)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await request.json();
    const { features: selectedSlugs } = body as { features: string[] };

    if (!Array.isArray(selectedSlugs)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "features must be an array" } },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { plan: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    // Get allowed features for plan
    const dbPlanFeatures = await prisma.planFeature.findMany({
      where: { planId: user.plan },
      include: { feature: { select: { slug: true } } },
    });

    let allowedSlugs: Set<string>;
    if (dbPlanFeatures.length > 0) {
      allowedSlugs = new Set(dbPlanFeatures.map((pf) => pf.feature.slug));
    } else {
      allowedSlugs = new Set(
        FEATURE_CATALOG
          .filter((f) => f.plans[user.plan as keyof typeof f.plans])
          .map((f) => f.slug)
      );
    }

    const validSlugs = selectedSlugs.filter((s) => allowedSlugs.has(s));

    // Deactivate all, then activate selected
    await prisma.userFeature.updateMany({
      where: { userId: session.userId },
      data: { isActive: false },
    });

    const features = await prisma.feature.findMany({
      where: { slug: { in: validSlugs }, isActive: true },
      select: { id: true },
    });

    for (const feature of features) {
      await prisma.userFeature.upsert({
        where: { userId_featureId: { userId: session.userId, featureId: feature.id } },
        create: { userId: session.userId, featureId: feature.id, isActive: true },
        update: { isActive: true },
      });
    }

    return NextResponse.json({
      success: true,
      data: { activatedCount: features.length },
    });
  } catch (error) {
    console.error("User features PUT error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
