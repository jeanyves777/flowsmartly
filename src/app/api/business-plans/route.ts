import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { runBusinessPlanAgent } from "@/lib/ai/business-plan-agent";

/**
 * GET /api/business-plans — list the current user's plans.
 * Returns id, name, industry, status, updatedAt — NOT the full sections
 * (kept slim so the list page loads fast).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const plans = await prisma.businessPlan.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      industry: true,
      stage: true,
      coverColor: true,
      status: true,
      generationCount: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, plans });
}

/**
 * POST /api/business-plans — generate a new business plan.
 * Requires a configured BrandKit — returns BRAND_NOT_CONFIGURED otherwise
 * so the UI can redirect to the BrandKit setup page.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await req.json();
    const { name, industry, stage, goals, targetAudience, fundingNeeded } = body as {
      name?: string;
      industry?: string;
      stage?: "idea" | "startup" | "growth" | "established";
      goals?: string;
      targetAudience?: string;
      fundingNeeded?: number;
    };

    if (!name || !industry || !stage) {
      return NextResponse.json(
        { success: false, error: { message: "name, industry, and stage are required" } },
        { status: 400 },
      );
    }

    // Brand-identity gate — agent also checks this but we short-circuit
    // before charging credits.
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      select: { id: true, isComplete: true, name: true },
    });
    if (!brandKit) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRAND_NOT_CONFIGURED",
            message: "Complete your Brand Identity first — the business plan is built from it.",
          },
        },
        { status: 409 },
      );
    }

    const creditCost = await getDynamicCreditCost("AI_BUSINESS_PLAN");
    const isAdmin = !!session.adminId;
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `This requires ${creditCost} credits. You have ${user?.aiCredits || 0}.`,
            required: creditCost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 },
      );
    }

    const result = await runBusinessPlanAgent({
      userId: session.userId,
      name,
      industry,
      stage,
      goals: goals || "",
      targetAudience: targetAudience || "",
      fundingNeeded,
    });

    const plan = await prisma.businessPlan.create({
      data: {
        userId: session.userId,
        name,
        industry,
        stage,
        goals: goals || null,
        targetAudience: targetAudience || null,
        fundingNeeded: typeof fundingNeeded === "number" ? fundingNeeded : null,
        brandSnapshot: JSON.stringify(result.brandSnapshot),
        sections: JSON.stringify(result.sections),
        coverColor:
          (result.brandSnapshot.colors as { primary?: string } | undefined)?.primary || "#6366f1",
        status: "draft",
        generationCount: 1,
      },
    });

    if (!isAdmin) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter: (user?.aiCredits || 0) - creditCost,
            referenceType: "ai_business_plan",
            referenceId: plan.id,
            description: `Business plan: ${name}`,
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "business_plan_generate",
        model: "claude-opus-4-7",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costCents: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: plan.id,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate business plan";
    console.error("[BusinessPlan] Generation error:", error);
    // BRAND_NOT_CONFIGURED surfaces as a thrown error from the agent — map
    // it to the same 409 the gate would return so the UI can react once.
    if (msg === "BRAND_NOT_CONFIGURED") {
      return NextResponse.json(
        { success: false, error: { code: "BRAND_NOT_CONFIGURED", message: "Complete your Brand Identity first." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 },
    );
  }
}
