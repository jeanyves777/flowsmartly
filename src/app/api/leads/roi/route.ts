import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

/**
 * GET /api/leads/roi — real sales metrics for the Lead studio ROI view. Everything
 * is computed from the user's own data; "time saved" is an honest estimate from
 * volume (manual research/tracking a lead by hand vs. the agent doing it).
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
    const userId = session.userId;

    const [leads, enriched, opps, won, lost, open, pitchesSent, dealsRaw] = await Promise.all([
      prisma.savedLead.count({ where: { userId } }),
      prisma.savedLead.count({ where: { userId, enrichedAt: { not: null } } }),
      prisma.opportunity.count({ where: { userId } }),
      prisma.opportunity.aggregate({ where: { userId, status: "won" }, _sum: { value: true }, _count: true }),
      prisma.opportunity.count({ where: { userId, status: "lost" } }),
      prisma.opportunity.aggregate({ where: { userId, status: "open" }, _sum: { value: true } }),
      prisma.pitch.count({ where: { userId, status: "SENT" } }),
      prisma.opportunity.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 25,
        include: { company: { select: { name: true } }, savedLead: { select: { name: true } } },
      }),
    ]);

    const wonCount = won._count || 0;
    const wonRevenue = won._sum.value || 0;
    const openValue = open._sum.value || 0;
    const closedTotal = wonCount + lost;
    const winRate = closedTotal ? Math.round((wonCount / closedTotal) * 100) : 0;
    const avgDeal = wonCount ? Math.round(wonRevenue / wonCount) : 0;

    // Honest "time saved" estimate: hand-researching a lead ~8 min, enriching ~5 min,
    // tracking/moving a deal ~10 min — the agent does it instantly.
    const minutesSaved = leads * 8 + enriched * 5 + opps * 10;
    const hoursSaved = Math.round(minutesSaved / 60);
    const daysSaved = Math.round((minutesSaved / 60 / 8) * 10) / 10;

    const deals = dealsRaw.map((o) => ({
      id: o.id,
      company: o.company?.name || null,
      contact: o.savedLead?.name || null,
      title: o.title,
      status: o.status,
      value: o.value,
      createdAt: o.createdAt,
      closedAt: o.closedAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        salesRoi: { leads, opportunities: opps, wonRevenue },
        pipeline: { openValue, winRate, avgDeal, wonCount, lostCount: lost },
        timeSaved: { minutesSaved, hoursSaved, daysSaved },
        activity: { enriched, pitchesSent, dealsClosed: wonCount },
        deals,
      },
    });
  } catch (error) {
    console.error("Lead ROI error:", error);
    return NextResponse.json({ success: false, error: { message: "Failed to load ROI" } }, { status: 500 });
  }
}
