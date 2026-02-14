import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    // Fetch active plans from database, ordered by sortOrder
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    // Fetch active credit packages from database, ordered by sortOrder
    const creditPackages = await prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: {
        plans: plans.map((plan) => ({
          id: plan.planId,
          name: plan.name,
          description: plan.description,
          monthlyCredits: plan.monthlyCredits,
          priceCentsMonthly: plan.priceCentsMonthly,
          priceCentsYearly: plan.priceCentsYearly,
          features: JSON.parse(plan.features),
          isPopular: plan.isPopular,
          color: plan.color,
          icon: plan.icon,
          // Include Stripe IDs for checkout (but don't expose to client unnecessarily)
          hasStripeMonthly: !!plan.stripePriceIdMonthly,
          hasStripeYearly: !!plan.stripePriceIdYearly,
        })),
        creditPackages: creditPackages.map((pkg) => ({
          id: pkg.packageId,
          name: pkg.name,
          description: pkg.description,
          credits: pkg.credits,
          bonus: pkg.bonusCredits,
          priceCents: pkg.priceCents,
          label: pkg.name,
          priceFormatted: `$${(pkg.priceCents / 100).toFixed(2)}`,
          isPopular: pkg.isPopular,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch packages:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch packages" } },
      { status: 500 }
    );
  }
}
