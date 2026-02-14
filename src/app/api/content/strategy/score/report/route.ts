import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateStrategyScore } from "@/lib/strategy/scoring";
import { ai } from "@/lib/ai/client";

// GET /api/content/strategy/score/report — Full monthly report data
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const listMode = searchParams.get("list") === "true";

    // Find user's ACTIVE strategy
    const strategy = await prisma.marketingStrategy.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { tasks: true },
    });

    if (!strategy) {
      return NextResponse.json({
        success: true,
        data: listMode ? { reports: [], currentMonth: null } : { report: null },
      });
    }

    // ── List mode: return all scored months ──
    if (listMode) {
      const scores = await prisma.strategyScore.findMany({
        where: { userId: session.userId, strategyId: strategy.id },
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: {
          id: true,
          month: true,
          year: true,
          overallScore: true,
          completionScore: true,
          onTimeScore: true,
          consistencyScore: true,
          adherenceScore: true,
          productionScore: true,
          previousScore: true,
        },
      });

      // Compute live current month
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const posts = await prisma.post.findMany({
        where: {
          userId: session.userId,
          deletedAt: null,
          publishedAt: { gte: periodStart, lte: periodEnd },
        },
        select: { id: true, caption: true, hashtags: true, publishedAt: true, createdAt: true },
      });

      const liveScore = strategy.tasks.length > 0
        ? calculateStrategyScore({ tasks: strategy.tasks, posts, periodStart, periodEnd })
        : null;

      // Get milestones count per month
      const milestones = await prisma.strategyMilestone.findMany({
        where: { userId: session.userId, strategyId: strategy.id },
        select: { achievedAt: true },
      });

      const milestoneCounts: Record<string, number> = {};
      for (const m of milestones) {
        const key = `${m.achievedAt.getFullYear()}-${m.achievedAt.getMonth() + 1}`;
        milestoneCounts[key] = (milestoneCounts[key] || 0) + 1;
      }

      // Previous month score for current month trend
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const prevScore = scores.find((s) => s.month === prevMonth && s.year === prevYear);

      return NextResponse.json({
        success: true,
        data: {
          reports: scores.map((s) => ({
            ...s,
            milestoneCount: milestoneCounts[`${s.year}-${s.month}`] || 0,
            trend: s.previousScore != null ? s.overallScore - s.previousScore : null,
          })),
          currentMonth: liveScore
            ? {
                month: now.getMonth() + 1,
                year: now.getFullYear(),
                overallScore: liveScore.overall,
                factors: liveScore.factors,
                trend: prevScore ? liveScore.overall - prevScore.overallScore : null,
                milestoneCount: milestoneCounts[`${now.getFullYear()}-${now.getMonth() + 1}`] || 0,
              }
            : null,
        },
      });
    }

    // ── Single month mode ──
    const monthParam = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const yearParam = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

    const periodStart = new Date(yearParam, monthParam - 1, 1);
    const periodEnd = new Date(yearParam, monthParam, 0, 23, 59, 59);

    // Try stored score first
    let stored = await prisma.strategyScore.findUnique({
      where: {
        userId_strategyId_month_year: {
          userId: session.userId,
          strategyId: strategy.id,
          month: monthParam,
          year: yearParam,
        },
      },
    });

    // Compute live if no stored score
    const posts = await prisma.post.findMany({
      where: {
        userId: session.userId,
        deletedAt: null,
        publishedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { id: true, caption: true, hashtags: true, publishedAt: true, createdAt: true },
    });

    const liveScore = calculateStrategyScore({
      tasks: strategy.tasks,
      posts,
      periodStart,
      periodEnd,
    });

    // Generate AI insights if not cached
    let aiInsights = stored?.aiInsights || null;
    let aiAreas: string[] = [];
    if (stored?.aiAreas) {
      try { aiAreas = JSON.parse(stored.aiAreas); } catch { aiAreas = []; }
    }

    if (!aiInsights && liveScore.rawData.completedTasks > 0) {
      try {
        const insightResponse = await ai.generateJSON<{
          summary: string;
          strength: string;
          improvement: string;
          tip: string;
          areas: string[];
        }>(
          `Analyze this marketing strategy performance and provide insights.

Score breakdown:
- Overall: ${liveScore.overall}/100
- Task Completion: ${liveScore.factors.completion}% (${liveScore.rawData.completedTasks}/${liveScore.rawData.totalTasks} tasks done)
- On-Time Delivery: ${liveScore.factors.onTime}% (${liveScore.rawData.onTimeTasks} on time, ${liveScore.rawData.lateTasks} late)
- Consistency: ${liveScore.factors.consistency}% (${liveScore.rawData.activeDays} active days, max gap: ${liveScore.rawData.maxGapDays} days)
- Plan Adherence: ${liveScore.factors.adherence}% (${liveScore.rawData.tasksCompletedInOrder}/${liveScore.rawData.totalOrderedTasks} in order)
- Content Production: ${liveScore.factors.production}% (${liveScore.rawData.postsCreated} posts, ${liveScore.rawData.postsAlignedWithStrategy} aligned)

Return JSON with: summary (2-3 sentences), strength (one top strength), improvement (biggest area to improve), tip (one specific actionable tip), areas (array of 2-3 improvement areas as short phrases)`,
          {
            maxTokens: 512,
            systemPrompt: "You are a supportive marketing performance coach. Be encouraging but honest. Keep responses concise.",
          }
        );

        if (insightResponse) {
          aiInsights = `${insightResponse.summary}\n\n**Top Strength:** ${insightResponse.strength}\n\n**Area to Improve:** ${insightResponse.improvement}\n\n**Tip:** ${insightResponse.tip}`;
          aiAreas = insightResponse.areas || [];
        }

        // Cache to stored record if it exists
        if (stored) {
          await prisma.strategyScore.update({
            where: { id: stored.id },
            data: { aiInsights, aiAreas: JSON.stringify(aiAreas) },
          });
        }
      } catch (err) {
        console.error("AI insights generation failed:", err);
        aiInsights = null;
      }
    }

    // Build timeline data: completed tasks grouped by day
    const timeline: Array<{ date: string; completed: number }> = [];
    const dayMap = new Map<string, number>();
    for (const task of strategy.tasks) {
      if (task.status === "DONE" && task.completedAt) {
        const d = new Date(task.completedAt);
        if (d >= periodStart && d <= periodEnd) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dayMap.set(key, (dayMap.get(key) || 0) + 1);
        }
      }
    }
    // Fill all days in the period
    const cursor = new Date(periodStart);
    while (cursor <= periodEnd) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      timeline.push({ date: key, completed: dayMap.get(key) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fetch milestones for the period
    const milestones = await prisma.strategyMilestone.findMany({
      where: {
        userId: session.userId,
        strategyId: strategy.id,
        achievedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { achievedAt: "asc" },
    });

    // Previous month score for trend
    const prevMonth = monthParam === 1 ? 12 : monthParam - 1;
    const prevYear = monthParam === 1 ? yearParam - 1 : yearParam;
    const previousScore = stored?.previousScore ?? (
      await prisma.strategyScore.findFirst({
        where: { userId: session.userId, strategyId: strategy.id, month: prevMonth, year: prevYear },
        select: { overallScore: true },
      })
    )?.overallScore ?? null;

    return NextResponse.json({
      success: true,
      data: {
        score: {
          overall: stored?.overallScore ?? liveScore.overall,
          factors: stored
            ? {
                completion: stored.completionScore,
                onTime: stored.onTimeScore,
                consistency: stored.consistencyScore,
                adherence: stored.adherenceScore,
                production: stored.productionScore,
              }
            : liveScore.factors,
          rawData: stored?.rawData ? JSON.parse(stored.rawData) : liveScore.rawData,
        },
        aiInsights,
        aiAreas,
        trend: previousScore != null ? (stored?.overallScore ?? liveScore.overall) - previousScore : null,
        previousScore,
        milestones: milestones.map((m) => ({
          id: m.id,
          key: m.milestoneKey,
          title: m.title,
          description: m.description,
          icon: m.icon,
          sharedToFeed: m.sharedToFeed,
          sharedPostId: m.sharedPostId,
          achievedAt: m.achievedAt.toISOString(),
        })),
        timeline,
        month: monthParam,
        year: yearParam,
        strategyName: strategy.name,
      },
    });
  } catch (error) {
    console.error("Get strategy report error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch report" } },
      { status: 500 }
    );
  }
}
