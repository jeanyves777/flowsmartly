import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { parseDealBrief } from "@/lib/pitch/deal-brief-agent";
import { runServiceProposalAgent, type ProposalPreset } from "@/lib/pitch/proposal-agent";
import { attachProposalLibraryVisuals } from "@/lib/pitch/proposal-asset-library";
import { runServiceProposalDeckAgent } from "@/lib/pitch/proposal-deck-agent";

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
    const brief = cleanText(body.brief, 4000);
    const inferred = brief ? await parseDealBrief({ mode: "proposal", brief }) : {};
    const targetName = cleanText(body.targetName || inferred.targetName, 180);
    const serviceTitle = cleanText(body.serviceTitle || inferred.serviceTitle, 180);
    const serviceDescription = cleanText(body.serviceDescription || inferred.serviceDescription || brief, 3000);
    const presetRaw = cleanText(body.preset || inferred.preset, 80) as ProposalPreset;
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
        select: {
          id: true,
          name: true,
          tagline: true,
          description: true,
          industry: true,
          niche: true,
          targetAudience: true,
          voiceTone: true,
          uniqueValue: true,
          colors: true,
          fonts: true,
        },
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
      targetWebsite: cleanUrl(body.targetWebsite || inferred.targetWebsite) || undefined,
      recipientName: cleanText(body.recipientName || inferred.recipientName, 120) || undefined,
      recipientEmail: cleanText(body.recipientEmail || inferred.recipientEmail, 200) || undefined,
      preset,
      serviceTitle,
      serviceDescription,
      goals: cleanText(body.goals || inferred.goals, 2000) || undefined,
      price: cleanMoney(body.price ?? inferred.price),
      originalPrice: cleanMoney(body.originalPrice ?? inferred.originalPrice),
      billingInterval: cleanText(body.billingInterval || inferred.billingInterval, 60) || undefined,
      terms: cleanText(body.terms || inferred.terms, 2000) || undefined,
    });

    let proposal = result.proposal;
    let usage = { ...result.usage };
    try {
      proposal = await attachProposalLibraryVisuals({
        preset,
        targetName,
        serviceTitle,
        proposal,
        brandKit,
      });
    } catch (visualError) {
      console.warn("[ProposalAgent] Visual asset selection failed:", visualError);
    }

    try {
      const deck = await runServiceProposalDeckAgent({
        proposal,
        request: {
          userId: session.userId,
          targetName,
          targetWebsite: cleanUrl(body.targetWebsite || inferred.targetWebsite) || undefined,
          recipientName: cleanText(body.recipientName || inferred.recipientName, 120) || undefined,
          recipientEmail: cleanText(body.recipientEmail || inferred.recipientEmail, 200) || undefined,
          preset,
          serviceTitle,
          serviceDescription,
          goals: cleanText(body.goals || inferred.goals, 2000) || undefined,
          price: cleanMoney(body.price ?? inferred.price),
          originalPrice: cleanMoney(body.originalPrice ?? inferred.originalPrice),
          billingInterval: cleanText(body.billingInterval || inferred.billingInterval, 60) || undefined,
          terms: cleanText(body.terms || inferred.terms, 2000) || undefined,
        },
        brandKit: brandKit as unknown as Record<string, unknown>,
      });
      proposal = { ...proposal, deckPlan: deck.plan };
      usage = {
        inputTokens: usage.inputTokens + deck.usage.inputTokens,
        outputTokens: usage.outputTokens + deck.usage.outputTokens,
      };
    } catch (deckError) {
      console.warn("[ProposalAgent] Claude Haiku deck planning failed, using renderer fallback:", deckError);
    }

    const pitch = await prisma.pitch.create({
      data: {
        userId: session.userId,
        businessName: targetName,
        businessUrl: cleanUrl(body.targetWebsite || inferred.targetWebsite),
        recipientEmail: cleanText(body.recipientEmail || inferred.recipientEmail, 200) || null,
        recipientName: cleanText(body.recipientName || inferred.recipientName, 120) || null,
        status: "READY",
        research: JSON.stringify({
          documentType: "service_proposal",
          preset,
          generatedAt: new Date().toISOString(),
          targetWebsite: cleanUrl(body.targetWebsite || inferred.targetWebsite),
          serviceTitle,
        }),
        pitchContent: JSON.stringify(proposal),
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
        model: "claude-haiku-4-5-20251001+proposal-deck-agent+visual-library",
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
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
