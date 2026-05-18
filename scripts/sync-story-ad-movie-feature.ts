import { PrismaClient } from "@prisma/client";
import { ALL_PLAN_IDS, FEATURE_CATALOG, getFeaturePlanValue } from "../src/lib/features/catalog";

const prisma = new PrismaClient();

async function main() {
  const definition = FEATURE_CATALOG.find((feature) => feature.slug === "story-ad-movie");
  if (!definition) {
    throw new Error("story-ad-movie feature definition is missing from the catalog");
  }

  const existing = await prisma.feature.findUnique({ where: { slug: definition.slug } });
  const legacy = await prisma.feature.findUnique({ where: { slug: "cartoon-maker" } });

  let featureId = existing?.id;

  if (!featureId && legacy) {
    const migrated = await prisma.feature.update({
      where: { slug: "cartoon-maker" },
      data: {
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        icon: definition.icon,
        route: definition.route,
        routes: JSON.stringify(definition.routes),
        isActive: true,
      },
    });
    featureId = migrated.id;
  }

  if (!featureId) {
    const created = await prisma.feature.create({
      data: {
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        category: definition.category,
        icon: definition.icon,
        route: definition.route,
        routes: JSON.stringify(definition.routes),
        isActive: true,
      },
    });
    featureId = created.id;
  } else {
    await prisma.feature.update({
      where: { id: featureId },
      data: {
        name: definition.name,
        description: definition.description,
        category: definition.category,
        icon: definition.icon,
        route: definition.route,
        routes: JSON.stringify(definition.routes),
        isActive: true,
      },
    });
  }

  for (const planId of ALL_PLAN_IDS) {
    const planValue = getFeaturePlanValue(definition, planId);
    if (!planValue) {
      await prisma.planFeature.deleteMany({ where: { planId, featureId } });
      continue;
    }

    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId, featureId } },
      create: {
        planId,
        featureId,
        limitValue: typeof planValue === "string" ? planValue : null,
      },
      update: {
        limitValue: typeof planValue === "string" ? planValue : null,
      },
    });
  }

  const users = await prisma.user.findMany({ select: { id: true } });
  let activated = 0;
  for (const user of users) {
    await prisma.userFeature.upsert({
      where: { userId_featureId: { userId: user.id, featureId } },
      create: { userId: user.id, featureId, isActive: true },
      update: { isActive: true },
    });
    activated++;
  }

  console.log(`Story Ad Movie feature ready for ${activated} users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
