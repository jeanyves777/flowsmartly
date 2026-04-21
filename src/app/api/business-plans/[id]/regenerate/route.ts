import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { runBusinessPlanAgent } from "@/lib/ai/business-plan-agent";

/**
 * POST /api/business-plans/[id]/regenerate — rerun the agent with a
 * refinement prompt. Cheaper than the initial generation because we reuse
 * all the user's stored context (industry/stage/goals) and only add the
 * refinement on top.
 *
 * Body: { refinementPrompt: string } — free-form user instructions, e.g.
 *   "Make the financial projections more aggressive" or
 *   "Pivot the competitive analysis to focus on enterprise buyers".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const refinementPrompt = String(body.refinementPrompt || "").trim();

    if (!refinementPrompt) {
      return NextResponse.json(
        { success: false, error: { message: "refinementPrompt is required" } },
        { status: 400 },
      );
    }

    const plan = await prisma.businessPlan.findFirst({
      where: { id, userId: session.userId },
    });
    if (!plan) {
      return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    }

    const creditCost = await getDynamicCreditCost("AI_BUSINESS_PLAN_REGENERATE");
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
            message: `Regeneration costs ${creditCost} credits. You have ${user?.aiCredits || 0}.`,
            required: creditCost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 },
      );
    }

    const result = await runBusinessPlanAgent({
      userId: session.userId,
      name: plan.name,
      industry: plan.industry || "other",
      stage: (plan.stage as "idea" | "startup" | "growth" | "established") || "startup",
      goals: plan.goals || "",
      targetAudience: plan.targetAudience || "",
      fundingNeeded: plan.fundingNeeded || undefined,
      refinementPrompt,
    });

    await prisma.businessPlan.update({
      where: { id: plan.id },
      data: {
        brandSnapshot: JSON.stringify(result.brandSnapshot),
        sections: JSON.stringify(result.sections),
        generationCount: { increment: 1 },
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
            referenceType: "ai_business_plan_regenerate",
            referenceId: plan.id,
            description: `Business plan regeneration: ${plan.name}`,
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "business_plan_regenerate",
        model: "claude-opus-4-7",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costCents: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Regeneration failed";
    console.error("[BusinessPlan] Regenerate error:", error);
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 });
  }
}
