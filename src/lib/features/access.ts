import { prisma } from "@/lib/db/client";

/**
 * Get all active feature slugs for a user
 */
export async function getUserFeatureSlugs(userId: string): Promise<string[]> {
  const userFeatures = await prisma.userFeature.findMany({
    where: { userId, isActive: true },
    include: { feature: { select: { slug: true } } },
  });
  return userFeatures.map((uf) => uf.feature.slug);
}

/**
 * Get all active features for a user (with full feature data)
 */
export async function getUserFeatures(userId: string) {
  const userFeatures = await prisma.userFeature.findMany({
    where: { userId, isActive: true },
    include: {
      feature: true,
    },
    orderBy: { feature: { sortOrder: "asc" } },
  });
  return userFeatures.map((uf) => uf.feature);
}

/**
 * Check if a user has access to a specific feature
 */
export async function hasFeature(userId: string, featureSlug: string): Promise<boolean> {
  const count = await prisma.userFeature.count({
    where: {
      userId,
      isActive: true,
      feature: { slug: featureSlug },
    },
  });
  return count > 0;
}

/**
 * Check if a user has access to a route based on their activated features
 */
export async function hasRouteAccess(userId: string, pathname: string): Promise<boolean> {
  const userFeatures = await prisma.userFeature.findMany({
    where: { userId, isActive: true },
    include: { feature: { select: { route: true, routes: true } } },
  });

  for (const uf of userFeatures) {
    const routes: string[] = JSON.parse(uf.feature.routes || "[]");
    if (uf.feature.route && (pathname === uf.feature.route || pathname.startsWith(uf.feature.route + "/"))) {
      return true;
    }
    for (const r of routes) {
      if (pathname === r || pathname.startsWith(r + "/")) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Activate features for a user based on their plan.
 * Only activates features that are included in their plan.
 */
export async function activateFeatures(userId: string, featureSlugs: string[]): Promise<void> {
  // First deactivate all existing features
  await prisma.userFeature.updateMany({
    where: { userId },
    data: { isActive: false },
  });

  if (featureSlugs.length === 0) return;

  // Get feature IDs for the requested slugs
  const features = await prisma.feature.findMany({
    where: { slug: { in: featureSlugs }, isActive: true },
    select: { id: true, slug: true },
  });

  // Upsert each feature activation
  for (const feature of features) {
    await prisma.userFeature.upsert({
      where: { userId_featureId: { userId, featureId: feature.id } },
      create: { userId, featureId: feature.id, isActive: true },
      update: { isActive: true },
    });
  }
}

/**
 * Get features available for a plan from the database (admin-controlled)
 */
export async function getPlanFeatures(planId: string) {
  const planFeatures = await prisma.planFeature.findMany({
    where: { planId },
    include: { feature: true },
    orderBy: { feature: { sortOrder: "asc" } },
  });
  return planFeatures;
}
