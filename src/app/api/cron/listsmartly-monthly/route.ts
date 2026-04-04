import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { generatePresenceReport } from "@/lib/listsmartly/presence-report";
import { createNotification } from "@/lib/notifications";

/**
 * GET /api/cron/listsmartly-monthly
 * Monthly cron that generates presence reports for all active/trialing ListSmartly profiles.
 * No credit deduction for subscribed users.
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

    // ── Find all profiles with active or trialing subscriptions ──
    const profiles = await prisma.listSmartlyProfile.findMany({
      where: {
        lsSubscriptionStatus: { in: ["active", "trialing"] },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    let processed = 0;
    let success = 0;
    let failed = 0;

    // ── Process each profile ──
    for (const profile of profiles) {
      processed++;

      try {
        const report = await generatePresenceReport(profile.id, "cron");

        // Mark as cron-generated (no credits charged)
        await prisma.presenceReport.update({
          where: { id: report.reportId },
          data: { creditsUsed: 0 },
        });

        // Create in-app notification
        await createNotification({
          userId: profile.user.id,
          type: "SYSTEM",
          title: "Monthly Presence Report Ready",
          message: `Your ${profile.businessName} presence report is ready. Citation score: ${report.citationScore}/100.`,
          actionUrl: "/listsmartly/reports",
          data: {
            reportId: report.reportId,
            citationScore: report.citationScore,
            overallScore: report.overallScore,
          },
        });

        success++;
      } catch (error) {
        console.error(`[ListSmartly Cron] Failed for profile ${profile.id}:`, error);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed,
        success,
        failed,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[ListSmartly Cron] Monthly report error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Cron job failed" } },
      { status: 500 }
    );
  }
}
