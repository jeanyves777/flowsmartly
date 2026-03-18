/**
 * Seed features into the database from the catalog.
 * Run via: npx tsx src/lib/features/seed.ts
 * Or call seedFeatures() programmatically.
 */
import { PrismaClient } from "@prisma/client";
import { FEATURE_CATALOG } from "./catalog";

const prisma = new PrismaClient();

export async function seedFeatures() {
  console.log("Seeding features...");

  let created = 0;
  let updated = 0;

  for (let i = 0; i < FEATURE_CATALOG.length; i++) {
    const f = FEATURE_CATALOG[i];

    const existing = await prisma.feature.findUnique({ where: { slug: f.slug } });

    if (existing) {
      await prisma.feature.update({
        where: { slug: f.slug },
        data: {
          name: f.name,
          description: f.description,
          category: f.category,
          icon: f.icon,
          route: f.route,
          routes: JSON.stringify(f.routes),
          sortOrder: i,
        },
      });
      updated++;
    } else {
      await prisma.feature.create({
        data: {
          slug: f.slug,
          name: f.name,
          description: f.description,
          category: f.category,
          icon: f.icon,
          route: f.route,
          routes: JSON.stringify(f.routes),
          sortOrder: i,
          isActive: true,
        },
      });
      created++;
    }
  }

  console.log(`Features: ${created} created, ${updated} updated`);

  // Seed PlanFeature mappings
  const plans = ["STARTER", "NON_PROFIT", "PRO", "BUSINESS", "ENTERPRISE"];
  let pfCreated = 0;

  for (const planId of plans) {
    for (const f of FEATURE_CATALOG) {
      const planValue = f.plans[planId as keyof typeof f.plans];
      if (!planValue) continue;

      const feature = await prisma.feature.findUnique({ where: { slug: f.slug } });
      if (!feature) continue;

      const limitValue = typeof planValue === "string" ? planValue : null;

      const existing = await prisma.planFeature.findUnique({
        where: { planId_featureId: { planId, featureId: feature.id } },
      });

      if (!existing) {
        await prisma.planFeature.create({
          data: { planId, featureId: feature.id, limitValue },
        });
        pfCreated++;
      } else if (existing.limitValue !== limitValue) {
        await prisma.planFeature.update({
          where: { id: existing.id },
          data: { limitValue },
        });
      }
    }
  }

  console.log(`PlanFeature mappings: ${pfCreated} created`);
  console.log("Feature seed complete!");
}

// Run directly
if (require.main === module) {
  seedFeatures()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
