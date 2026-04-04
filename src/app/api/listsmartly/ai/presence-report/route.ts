import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generatePresenceReport } from "@/lib/listsmartly/presence-report";

/**
 * POST /api/listsmartly/ai/presence-report
 * Generate an AI-powered monthly presence report.
 *
 * Deducts 15 credits (AI_PRESENCE_REPORT).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Fetch profile
    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_PRESENCE_REPORT");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Insufficient credits" },
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Generate report
    const report = await generatePresenceReport(profile.id, "user");

    // Update report with credits used
    await prisma.presenceReport.update({
      where: { id: report.reportId },
      data: { creditsUsed: creditCost },
    });

    // Deduct credits
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditCost,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditCost,
          description: "AI presence report generation",
          referenceType: "ai_presence_report",
          referenceId: report.reportId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.reportId,
        citationScore: report.citationScore,
        overallScore: report.overallScore,
        summary: report.summary,
        recommendations: report.recommendations,
        creditsUsed: creditCost,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[ListSmartly] Presence report error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to generate presence report" } },
      { status: 500 }
    );
  }
}
