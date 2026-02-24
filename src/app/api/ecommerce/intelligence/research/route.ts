import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { runIntelligenceResearch } from "@/lib/ecommerce/intelligence-research";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";

// ── GET /api/ecommerce/intelligence/research ──
// Returns whether research has been done and the latest report

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    const latestReport = await prisma.intelligenceReport.findFirst({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
    });

    if (!latestReport) {
      return NextResponse.json({
        success: true,
        data: { hasResearched: false, latestReport: null },
      });
    }

    // Parse JSON fields
    const parsedReport = {
      id: latestReport.id,
      status: latestReport.status,
      summary: latestReport.summary ? JSON.parse(latestReport.summary) : null,
      competitorData: latestReport.competitorData ? JSON.parse(latestReport.competitorData) : null,
      trendData: latestReport.trendData ? JSON.parse(latestReport.trendData) : null,
      seoData: latestReport.seoData ? JSON.parse(latestReport.seoData) : null,
      recommendationData: latestReport.recommendationData ? JSON.parse(latestReport.recommendationData) : null,
      completedAt: latestReport.completedAt?.toISOString() || null,
      createdAt: latestReport.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: {
        hasResearched: latestReport.status === "completed",
        latestReport: parsedReport,
      },
    });
  } catch (error) {
    console.error("Get intelligence research error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get research data" } },
      { status: 500 }
    );
  }
}

// ── POST /api/ecommerce/intelligence/research ──
// Runs the full intelligence research pipeline

export async function POST(request: NextRequest) {
  let reportId: string | null = null;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    // Credit check
    const creditError = await checkCreditsForFeature(session.userId, "AI_INTELLIGENCE_RESEARCH");
    if (creditError) {
      return NextResponse.json(
        { success: false, error: creditError },
        { status: 402 }
      );
    }

    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });

    if (!store) {
      return NextResponse.json(
        { success: false, error: { code: "NO_STORE", message: "You don't have a store" } },
        { status: 404 }
      );
    }

    // Create report record
    const report = await prisma.intelligenceReport.create({
      data: {
        storeId: store.id,
        triggeredBy: "manual",
        status: "running",
      },
    });
    reportId = report.id;

    // Run pipeline
    const result = await runIntelligenceResearch(store.id);

    // Update report with results
    await prisma.intelligenceReport.update({
      where: { id: report.id },
      data: {
        status: "completed",
        competitorData: JSON.stringify(result.competitorData),
        trendData: JSON.stringify(result.trendData),
        seoData: JSON.stringify(result.seoData),
        recommendationData: JSON.stringify(result.recommendationData),
        summary: JSON.stringify(result.summary),
        completedAt: new Date(),
      },
    });

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_INTELLIGENCE_RESEARCH");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: "AI intelligence research",
      referenceType: "intelligence_report",
      referenceId: report.id,
    });

    // Return parsed report
    const parsedReport = {
      id: report.id,
      status: "completed",
      summary: result.summary,
      competitorData: result.competitorData,
      trendData: result.trendData,
      seoData: result.seoData,
      recommendationData: result.recommendationData,
      completedAt: new Date().toISOString(),
      createdAt: report.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: { report: parsedReport },
    });
  } catch (error) {
    console.error("Run intelligence research error:", error);

    // Update report with error status
    if (reportId) {
      try {
        await prisma.intelligenceReport.update({
          where: { id: reportId },
          data: {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
      } catch {
        // Ignore update error
      }
    }

    const message = error instanceof Error ? error.message : "Failed to run intelligence research";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
