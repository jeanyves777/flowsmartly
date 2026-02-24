import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { runIntelligenceResearch } from "@/lib/ecommerce/intelligence-research";
import { sendIntelligenceWeeklyReport } from "@/lib/email/commerce";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";

/**
 * GET /api/cron/intelligence-weekly
 * Weekly cron endpoint that generates intelligence reports for all active stores
 * with at least one active product. Sends email summaries and in-app notifications.
 *
 * Protected with CRON_SECRET bearer token.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Authentication ──
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing cron secret" } },
        { status: 401 }
      );
    }

    // ── Find all active stores with at least one active product ──
    const activeStores = await prisma.store.findMany({
      where: {
        isActive: true,
        products: { some: { status: "ACTIVE" } },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
    });

    let processed = 0;
    let success = 0;
    let failed = 0;

    // ── Process each store ──
    for (const store of activeStores) {
      processed++;

      // Create the IntelligenceReport record
      const report = await prisma.intelligenceReport.create({
        data: {
          storeId: store.id,
          triggeredBy: "cron",
          status: "running",
        },
      });

      try {
        // Run research
        const result = await runIntelligenceResearch(store.id);

        // Update report with results
        await prisma.intelligenceReport.update({
          where: { id: report.id },
          data: {
            status: "completed",
            competitorData: JSON.stringify(result.competitorData),
            trendData: JSON.stringify(result.trendData),
            seoData: result.seoData ? JSON.stringify(result.seoData) : null,
            summary: JSON.stringify(result.summary),
            creditsUsed: 0, // cron is free
            completedAt: new Date(),
          },
        });

        // Send weekly report email
        await sendIntelligenceWeeklyReport({
          to: store.user.email,
          ownerName: store.user.name || "Store Owner",
          storeName: store.name,
          summary: result.summary,
          competitorData: result.competitorData,
          seoData: result.seoData,
        });

        // Create in-app notification
        await createNotification({
          userId: store.user.id,
          type: NOTIFICATION_TYPES.INTELLIGENCE_WEEKLY,
          title: "Weekly Intelligence Report",
          message: `Your weekly intelligence report is ready. ${result.summary.competitorsFound} competitors tracked, avg SEO: ${result.summary.avgSeoScore}/100.`,
          actionUrl: "/ecommerce/intelligence",
        });

        success++;
      } catch (error) {
        console.error(`[intelligence-weekly] Failed for store ${store.id}:`, error);

        // Update report as failed
        await prisma.intelligenceReport.update({
          where: { id: report.id },
          data: {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });

        failed++;
      }

      // 2s delay between stores to avoid rate limiting
      if (processed < activeStores.length) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return NextResponse.json({
      success: true,
      data: { processed, success, failed },
    });
  } catch (error) {
    console.error("Intelligence weekly cron error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Intelligence weekly cron failed" } },
      { status: 500 }
    );
  }
}
