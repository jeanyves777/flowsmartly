import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { runServiceProposalAgent, type ProposalPreset } from "@/lib/pitch/proposal-agent";

const PRESETS = new Set<ProposalPreset>([
  "google-business-profile",
  "website-redesign",
  "local-seo",
  "custom",
]);

function cleanText(value: unknown, max = 2000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUrl(value: unknown): string | null {
  const raw = cleanText(value, 400);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function cleanMoney(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const targetName = cleanText(body.targetName, 180);
    const serviceTitle = cleanText(body.serviceTitle, 180);
    const serviceDescription = cleanText(body.serviceDescription, 3000);
    const presetRaw = cleanText(body.preset, 80) as ProposalPreset;
    const preset = PRESETS.has(presetRaw) ? presetRaw : "custom";

    if (!targetName || !serviceTitle || !serviceDescription) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Target client, service title, and service details are required." },
        },
        { status: 400 },
      );
    }

    const [brandKit, user] = await Promise.all([
      prisma.brandKit.findFirst({
        where: { userId: session.userId },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, plan: true },
      }),
    ]);

    if (!brandKit?.name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRAND_IDENTITY_REQUIRED",
            message: "Set up your brand identity first so the proposal uses your real services, logo, and contact details.",
          },
        },
        { status: 403 },
      );
    }

    const creditCost = await getDynamicCreditCost("AI_SERVICE_PROPOSAL");
    const isAdmin = !!session.adminId;
    const availableCredits = user?.aiCredits || 0;
    if (!isAdmin && availableCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `This proposal requires ${creditCost} credits. You have ${availableCredits}.`,
            required: creditCost,
            available: availableCredits,
          },
        },
        { status: 402 },
      );
    }

    const result = await runServiceProposalAgent({
      userId: session.userId,
      targetName,
      targetWebsite: cleanUrl(body.targetWebsite) || undefined,
      recipientName: cleanText(body.recipientName, 120) || undefined,
      recipientEmail: cleanText(body.recipientEmail, 200) || undefined,
      preset,
      serviceTitle,
      serviceDescription,
      goals: cleanText(body.goals, 2000) || undefined,
      price: cleanMoney(body.price),
      originalPrice: cleanMoney(body.originalPrice),
      billingInterval: cleanText(body.billingInterval, 60) || undefined,
      terms: cleanText(body.terms, 2000) || undefined,
    });

    const pitch = await prisma.pitch.create({
      data: {
        userId: session.userId,
        businessName: targetName,
        businessUrl: cleanUrl(body.targetWebsite),
        recipientEmail: cleanText(body.recipientEmail, 200) || null,
        recipientName: cleanText(body.recipientName, 120) || null,
        status: "READY",
        research: JSON.stringify({
          documentType: "service_proposal",
          preset,
          generatedAt: new Date().toISOString(),
          targetWebsite: cleanUrl(body.targetWebsite),
          serviceTitle,
        }),
        pitchContent: JSON.stringify(result.proposal),
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
            balanceAfter: availableCredits - creditCost,
            referenceType: "ai_service_proposal",
            referenceId: pitch.id,
            description: `Service proposal: ${targetName}`,
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "service_proposal_generate",
        model: "claude-opus-4-7",
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costCents: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: pitch.id,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : availableCredits - creditCost,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate proposal";
    console.error("[ProposalAgent] Generation error:", error);
    if (message === "BRAND_NOT_CONFIGURED") {
      return NextResponse.json(
        { success: false, error: { code: "BRAND_IDENTITY_REQUIRED", message: "Set up your brand identity first." } },
        { status: 403 },
      );
    }
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
