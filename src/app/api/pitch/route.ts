import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { parseDealBrief } from "@/lib/pitch/deal-brief-agent";
import { processPitch } from "@/lib/pitch/processor";

// Credit costs
const PITCH_COST_SUBSCRIBER = 15;   // paying plan users
const PITCH_COST_FREE_USER   = 500; // STARTER plan, after their 1 free trial run

function cleanText(value: unknown, max = 1000): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanUrl(value: unknown): string {
  const raw = cleanText(value, 400);
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

// GET /api/pitch - list pitches
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const docTypeParam = searchParams.get("documentType"); // "pitch" | "service_proposal"
    const savedLeadId = searchParams.get("savedLeadId"); // pitches/proposals under one lead
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId: session.userId };
    if (status && status !== "all") where.status = status;
    if (docTypeParam === "pitch" || docTypeParam === "service_proposal") where.documentType = docTypeParam;
    if (savedLeadId) where.savedLeadId = savedLeadId;

    // documentType is a first-class column now — no JSON parsing to tell pitches
    // from proposals, and proposalCount is a cheap COUNT (not load-all-and-parse).
    const [pitches, total, proposalCount, stats] = await Promise.all([
      prisma.pitch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          businessName: true,
          businessUrl: true,
          documentType: true,
          status: true,
          recipientEmail: true,
          recipientName: true,
          sentAt: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.pitch.count({ where }),
      prisma.pitch.count({ where: { userId: session.userId, documentType: "service_proposal" } }),
      prisma.pitch.groupBy({ by: ["status"], where: { userId: session.userId }, _count: { status: true } }),
    ]);

    const statMap = Object.fromEntries(stats.map((s) => [s.status, s._count.status]));

    return NextResponse.json({
      success: true,
      data: {
        pitches,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        stats: {
          total,
          pending: (statMap.PENDING || 0) + (statMap.RESEARCHING || 0),
          ready: statMap.READY || 0,
          sent: statMap.SENT || 0,
          failed: statMap.FAILED || 0,
          proposals: proposalCount,
        },
      },
    });
  } catch (error) {
    console.error("List pitches error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load pitches" } }, { status: 500 });
  }
}

// POST /api/pitch - create a new pitch + trigger research
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const brief = cleanText(body.brief, 4000);
    const inferred = brief ? await parseDealBrief({ mode: "pitch", brief }) : {};
    const businessName = cleanText(body.businessName || inferred.targetName, 180);
    const businessUrl = cleanUrl(body.businessUrl || inferred.targetWebsite);
    const recipientEmail = cleanText(body.recipientEmail || inferred.recipientEmail, 200);
    const recipientName = cleanText(body.recipientName || inferred.recipientName, 120);

    if (!businessName) {
      return NextResponse.json({ success: false, error: { message: "Tell the AI which business to research." } }, { status: 400 });
    }

    // Load user plan + credits + existing pitch count + brand kit (all in parallel)
    const [user, pitchCount, brandKit] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true, name: true, plan: true },
      }),
      prisma.pitch.count({ where: { userId: session.userId } }),
      prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true },
      }),
    ]);

    // Require brand identity before using pitch system
    if (!brandKit?.name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "BRAND_IDENTITY_REQUIRED",
            message: "Please set up your brand identity before creating pitches. Go to Settings > Brand Kit to get started.",
          },
        },
        { status: 403 }
      );
    }

    const isSubscriber = user?.plan && user.plan !== "STARTER";
    const isFreeRun    = !isSubscriber && pitchCount === 0;
    const creditCost   = isFreeRun ? 0 : isSubscriber ? PITCH_COST_SUBSCRIBER : PITCH_COST_FREE_USER;
    const totalCredits = user?.aiCredits || 0;

    if (!isFreeRun && totalCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: isSubscriber
              ? `Not enough AI credits. This action requires ${creditCost} credits.`
              : `Your free trial has been used. Additional pitches cost ${creditCost} credits. Please purchase credits or upgrade to a plan.`,
          },
        },
        { status: 403 }
      );
    }

    // Optional link to a saved lead (validate ownership).
    let savedLeadId: string | null = null;
    if (typeof body.savedLeadId === "string" && body.savedLeadId) {
      const sl = await prisma.savedLead.findFirst({ where: { id: body.savedLeadId, userId: session.userId }, select: { id: true } });
      savedLeadId = sl?.id ?? null;
    }

    // Create pitch record
    const pitch = await prisma.pitch.create({
      data: {
        userId: session.userId,
        businessName,
        businessUrl: businessUrl || null,
        savedLeadId,
        recipientEmail: recipientEmail || null,
        recipientName: recipientName || null,
        documentType: "pitch",
        status: "PENDING",
      },
    });

    // Deduct credits (skip if free trial run)
    if (creditCost > 0) {
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
            balanceAfter: totalCredits - creditCost,
            description: `AI Pitch: ${businessName}`,
          },
        }),
      ]);
    }

    // Fire-and-forget background research
    processPitch(pitch.id).catch((err) => {
      console.error("[POST /api/pitch] Background processing failed:", err);
    });

    return NextResponse.json({
      success: true,
      data: {
        pitch: { id: pitch.id, businessName: pitch.businessName, status: pitch.status },
        creditsUsed: creditCost,
        creditsRemaining: totalCredits - creditCost,
        isFreeRun,
      },
    });
  } catch (error) {
    console.error("Create pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create pitch" } }, { status: 500 });
  }
}
