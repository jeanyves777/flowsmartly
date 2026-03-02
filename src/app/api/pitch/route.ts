import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { processPitch } from "@/lib/pitch/processor";

const PITCH_CREDIT_COST = 15;

// GET /api/pitch — list pitches
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { userId: session.userId };
    if (status && status !== "all") where.status = status;

    const [pitches, total] = await Promise.all([
      prisma.pitch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          businessName: true,
          businessUrl: true,
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
    ]);

    const stats = await prisma.pitch.groupBy({
      by: ["status"],
      where: { userId: session.userId },
      _count: { status: true },
    });

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
        },
      },
    });
  } catch (error) {
    console.error("List pitches error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load pitches" } }, { status: 500 });
  }
}

// POST /api/pitch — create a new pitch + trigger research
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    }

    const body = await request.json();
    const { businessName, businessUrl, recipientEmail, recipientName } = body;

    if (!businessName?.trim()) {
      return NextResponse.json({ success: false, error: { message: "Business name is required" } }, { status: 400 });
    }

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true, freeCredits: true, name: true },
    });

    const purchasedCredits = Math.max(0, (user?.aiCredits || 0) - (user?.freeCredits || 0));
    if (purchasedCredits < PITCH_CREDIT_COST) {
      return NextResponse.json(
        { success: false, error: { code: "INSUFFICIENT_CREDITS", message: `Not enough AI credits. This action requires ${PITCH_CREDIT_COST} credits.` } },
        { status: 403 }
      );
    }

    // Create pitch record
    const pitch = await prisma.pitch.create({
      data: {
        userId: session.userId,
        businessName: businessName.trim(),
        businessUrl: businessUrl?.trim() || null,
        recipientEmail: recipientEmail?.trim() || null,
        recipientName: recipientName?.trim() || null,
        status: "PENDING",
      },
    });

    // Deduct credits upfront
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: PITCH_CREDIT_COST } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -PITCH_CREDIT_COST,
          balanceAfter: (user?.aiCredits || 0) - PITCH_CREDIT_COST,
          description: `AI Pitch: ${businessName}`,
        },
      }),
    ]);

    // Fire-and-forget background research
    processPitch(pitch.id).catch((err) => {
      console.error("[POST /api/pitch] Background processing failed:", err);
    });

    return NextResponse.json({
      success: true,
      data: {
        pitch: { id: pitch.id, businessName: pitch.businessName, status: pitch.status },
        creditsUsed: PITCH_CREDIT_COST,
        creditsRemaining: (user?.aiCredits || 0) - PITCH_CREDIT_COST,
      },
    });
  } catch (error) {
    console.error("Create pitch error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to create pitch" } }, { status: 500 });
  }
}
