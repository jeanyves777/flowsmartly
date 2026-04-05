import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { runWebsiteAgent } from "@/lib/website/website-agent";

// POST /api/websites/[id]/generate — Claude Agent builds the website
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Check credits
    const cost = await getDynamicCreditCost("AI_WEBSITE_GENERATE");
    const check = await checkCreditsForFeature(session.userId, "AI_WEBSITE_GENERATE");
    if (check) {
      return NextResponse.json({ error: check.message, required: cost }, { status: 402 });
    }

    const body = await request.json();
    const questionnaire = body.questionnaire;
    if (!questionnaire) return NextResponse.json({ error: "Questionnaire data required" }, { status: 400 });

    console.log(`[WebsiteGen] Starting V3 agent for website ${id}`);

    // Run the agent (writes real .tsx files to disk)
    const result = await runWebsiteAgent(
      id,
      website.slug,
      session.userId,
      questionnaire,
      (progress) => {
        console.log(`[WebsiteGen] ${progress.step}${progress.detail ? ` — ${progress.detail}` : ""} (${progress.toolCalls} calls)`);
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Generation failed" }, { status: 500 });
    }

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `AI website generation: ${website.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/websites/[id]/generate error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
