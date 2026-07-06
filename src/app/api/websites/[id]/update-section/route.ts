import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getSiteDir } from "@/lib/website/site-builder";
import { detectSiteSections, applySectionRedesign } from "@/lib/website/site-editor";

// Default credit cost — admin-overridable via SystemSetting "section_update_credit_cost".
const DEFAULT_CREDIT_COST = 50;

async function getSectionCreditCost(): Promise<number> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "section_update_credit_cost" } });
    if (setting?.value) return parseInt(setting.value, 10) || DEFAULT_CREDIT_COST;
  } catch { /* ignore */ }
  return DEFAULT_CREDIT_COST;
}

/**
 * GET /api/websites/[id]/update-section — the editable sections + credit cost.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const siteDir = website.generatedPath || getSiteDir(id);
    return NextResponse.json({ sections: detectSiteSections(siteDir), creditCost: await getSectionCreditCost() });
  } catch (err) {
    console.error("GET update-section error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/websites/[id]/update-section — AI-powered section redesign.
 * Body: { section: string, prompt: string }. The redesign itself runs through
 * the shared `applySectionRedesign` engine so the flow-agent uses the same code.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const { section, prompt } = await request.json();
    if (!section || !prompt) return NextResponse.json({ error: "Section and prompt are required" }, { status: 400 });

    const creditCost = await getSectionCreditCost();
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { aiCredits: true } });
    if (!user || user.aiCredits < creditCost) {
      return NextResponse.json({ error: `Not enough credits. You need ${creditCost} credits. Current balance: ${user?.aiCredits || 0}` }, { status: 402 });
    }

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true, siteData: true, name: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await applySectionRedesign({ website, section, prompt });
    if (!result.ok) return NextResponse.json({ error: result.error || "Section update failed" }, { status: 404 });

    // Deduct credits + log.
    await prisma.user.update({ where: { id: session.userId }, data: { aiCredits: { decrement: creditCost } } });
    await prisma.creditTransaction.create({
      data: {
        userId: session.userId,
        type: "USAGE",
        amount: -creditCost,
        description: `Section update: ${section} — ${website.name}`,
        balanceAfter: user.aiCredits - creditCost,
      },
    });

    return NextResponse.json({ success: true, message: `${section} section updated! Click Rebuild to apply changes.`, creditCost, file: result.file });
  } catch (err: unknown) {
    console.error("POST update-section error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}
