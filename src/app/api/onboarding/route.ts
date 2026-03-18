import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { FEATURE_CATALOG } from "@/lib/features/catalog";

/**
 * GET /api/onboarding — Get onboarding state + available features for user's plan
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { plan: true, onboardingComplete: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    // Get features available for this plan from DB (admin-controlled)
    const dbPlanFeatures = await prisma.planFeature.findMany({
      where: { planId: user.plan },
      include: { feature: true },
    });

    let availableFeatures;
    if (dbPlanFeatures.length > 0) {
      // Use admin-configured features from DB
      availableFeatures = dbPlanFeatures.map((pf) => ({
        slug: pf.feature.slug,
        name: pf.feature.name,
        description: pf.feature.description,
        category: pf.feature.category,
        icon: pf.feature.icon,
        route: pf.feature.route,
        limit: pf.limitValue,
      }));
    } else {
      // Fallback to catalog defaults
      availableFeatures = FEATURE_CATALOG
        .filter((f) => f.plans[user.plan as keyof typeof f.plans])
        .map((f) => ({
          slug: f.slug,
          name: f.name,
          description: f.description,
          category: f.category,
          icon: f.icon,
          route: f.route,
          limit: typeof f.plans[user.plan as keyof typeof f.plans] === "string"
            ? f.plans[user.plan as keyof typeof f.plans] as string
            : null,
        }));
    }

    // Get user's currently activated features
    const userFeatures = await prisma.userFeature.findMany({
      where: { userId: session.userId, isActive: true },
      include: { feature: { select: { slug: true } } },
    });
    const activatedSlugs = userFeatures.map((uf) => uf.feature.slug);

    return NextResponse.json({
      success: true,
      data: {
        plan: user.plan,
        onboardingComplete: user.onboardingComplete,
        availableFeatures,
        activatedSlugs,
      },
    });
  } catch (error) {
    console.error("Onboarding GET error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * POST /api/onboarding — Complete onboarding with selected features
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await request.json();
    const { features: selectedSlugs } = body as { features: string[] };

    if (!Array.isArray(selectedSlugs) || selectedSlugs.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Select at least one feature" } },
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

    // Validate that selected features are available for user's plan
    const dbPlanFeatures = await prisma.planFeature.findMany({
      where: { planId: user.plan },
      include: { feature: { select: { slug: true } } },
    });

    let allowedSlugs: Set<string>;
    if (dbPlanFeatures.length > 0) {
      allowedSlugs = new Set(dbPlanFeatures.map((pf) => pf.feature.slug));
    } else {
      // Fallback to catalog
      allowedSlugs = new Set(
        FEATURE_CATALOG
          .filter((f) => f.plans[user.plan as keyof typeof f.plans])
          .map((f) => f.slug)
      );
    }

    const validSlugs = selectedSlugs.filter((s) => allowedSlugs.has(s));

    if (validSlugs.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "No valid features selected" } },
        { status: 400 }
      );
    }

    // Deactivate all existing features first
    await prisma.userFeature.updateMany({
      where: { userId: session.userId },
      data: { isActive: false },
    });

    // Get feature records
    const features = await prisma.feature.findMany({
      where: { slug: { in: validSlugs }, isActive: true },
      select: { id: true, slug: true },
    });

    // Activate selected features
    for (const feature of features) {
      await prisma.userFeature.upsert({
        where: { userId_featureId: { userId: session.userId, featureId: feature.id } },
        create: { userId: session.userId, featureId: feature.id, isActive: true },
        update: { isActive: true },
      });
    }

    // Mark onboarding complete
    await prisma.user.update({
      where: { id: session.userId },
      data: { onboardingComplete: true },
    });

    return NextResponse.json({
      success: true,
      data: { activatedCount: features.length },
    });
  } catch (error) {
    console.error("Onboarding POST error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
