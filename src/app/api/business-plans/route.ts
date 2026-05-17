import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { runBusinessPlanAgent } from "@/lib/ai/business-plan-agent";

const ALLOWED_STAGES = new Set(["idea", "startup", "growth", "established"]);

function cleanText(value: unknown, max = 2000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeIndustry(value: unknown): string {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other";
}

function normalizeFunding(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(999999999, Math.round(n));
}

/**
 * GET /api/business-plans - list the current user's plans.
 * Returns id, name, industry, status, updatedAt - NOT the full sections
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
 * POST /api/business-plans - generate a new business plan.
 * Requires a configured BrandKit - returns BRAND_NOT_CONFIGURED otherwise
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

    const planName = cleanText(name, 180);
    const normalizedIndustry = normalizeIndustry(industry);
    const normalizedStage = ALLOWED_STAGES.has(String(stage)) ? stage : undefined;
    const normalizedGoals = cleanText(goals, 2000);
    const normalizedAudience = cleanText(targetAudience, 1200);
    const normalizedFunding = normalizeFunding(fundingNeeded);

    if (!planName || !normalizedIndustry || !normalizedStage) {
      return NextResponse.json(
        { success: false, error: { message: "name, industry, and stage are required" } },
        { status: 400 },
      );
    }

    // Brand-identity gate; agent also checks this but we short-circuit.
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
            message: "Complete your Brand Identity first - the business plan is built from it.",
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
      name: planName,
      industry: normalizedIndustry,
      stage: normalizedStage,
      goals: normalizedGoals,
      targetAudience: normalizedAudience,
      fundingNeeded: normalizedFunding,
    });

    const plan = await prisma.businessPlan.create({
      data: {
        userId: session.userId,
        name: planName,
        industry: normalizedIndustry,
        stage: normalizedStage,
        goals: normalizedGoals || null,
        targetAudience: normalizedAudience || null,
        fundingNeeded: normalizedFunding ?? null,
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
            description: `Business plan: ${planName}`,
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
    // BRAND_NOT_CONFIGURED surfaces as a thrown error from the agent; map
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
