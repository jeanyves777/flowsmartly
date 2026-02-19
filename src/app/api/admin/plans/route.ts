import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/admin/auth";

// GET /api/admin/plans - List all plans
export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const plans = await prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
    });

    const activePlans = plans.filter((p) => p.isActive);

    return NextResponse.json({
      success: true,
      data: {
        plans,
        stats: {
          total: plans.length,
          active: activePlans.length,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch plans" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/plans - Update a plan
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      name,
      description,
      monthlyCredits,
      priceCentsMonthly,
      priceCentsYearly,
      stripePriceIdMonthly,
      stripePriceIdYearly,
      stripeProductId,
      features,
      isPopular,
      isActive,
      sortOrder,
      color,
      icon,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { message: "Plan ID is required" } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (monthlyCredits !== undefined) updateData.monthlyCredits = parseInt(String(monthlyCredits), 10);
    if (priceCentsMonthly !== undefined) updateData.priceCentsMonthly = parseInt(String(priceCentsMonthly), 10);
    if (priceCentsYearly !== undefined) updateData.priceCentsYearly = parseInt(String(priceCentsYearly), 10);
    if (stripePriceIdMonthly !== undefined) updateData.stripePriceIdMonthly = stripePriceIdMonthly || null;
    if (stripePriceIdYearly !== undefined) updateData.stripePriceIdYearly = stripePriceIdYearly || null;
    if (stripeProductId !== undefined) updateData.stripeProductId = stripeProductId || null;
    if (features !== undefined) updateData.features = typeof features === "string" ? features : JSON.stringify(features);
    if (isPopular !== undefined) updateData.isPopular = isPopular;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(String(sortOrder), 10);
    if (color !== undefined) updateData.color = color;
    if (icon !== undefined) updateData.icon = icon;

    const plan = await prisma.plan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to update plan" } },
      { status: 500 }
    );
  }
}

// POST /api/admin/plans - Create a new plan
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session?.adminId) {
      return NextResponse.json(
        { success: false, error: { message: "Admin access required" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      planId,
      name,
      description,
      monthlyCredits,
      priceCentsMonthly,
      priceCentsYearly,
      stripePriceIdMonthly,
      stripePriceIdYearly,
      stripeProductId,
      features,
      isPopular,
      sortOrder,
      color,
      icon,
    } = body;

    if (!planId || !name) {
      return NextResponse.json(
        { success: false, error: { message: "planId and name are required" } },
        { status: 400 }
      );
    }

    const existing = await prisma.plan.findUnique({ where: { planId } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { message: "Plan ID already exists" } },
        { status: 409 }
      );
    }

    const plan = await prisma.plan.create({
      data: {
        planId,
        name,
        description: description || null,
        monthlyCredits: parseInt(String(monthlyCredits || 0), 10),
        priceCentsMonthly: parseInt(String(priceCentsMonthly || 0), 10),
        priceCentsYearly: parseInt(String(priceCentsYearly || 0), 10),
        stripePriceIdMonthly: stripePriceIdMonthly || null,
        stripePriceIdYearly: stripePriceIdYearly || null,
        stripeProductId: stripeProductId || null,
        features: typeof features === "string" ? features : JSON.stringify(features || []),
        isPopular: isPopular || false,
        sortOrder: sortOrder !== undefined ? parseInt(String(sortOrder), 10) : 0,
        color: color || "#0ea5e9",
        icon: icon || "Sparkles",
      },
    });

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Error creating plan:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create plan" } },
      { status: 500 }
    );
  }
}
