import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateStrategyScore } from "@/lib/strategy/scoring";
import { ai } from "@/lib/ai/client";

type ScoreRow = {
  id: string;
  month: number;
  year: number;
  overallScore: number;
  completionScore: number;
  onTimeScore: number;
  consistencyScore: number;
  adherenceScore: number;
  productionScore: number;
  previousScore: number | null;
};

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function getMonthPeriod(year: number, month: number) {
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59),
  };
}

function isFutureMonth(year: number, month: number, now: Date) {
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
}

function getPreviousPeriod(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

async function generateInsights(score: ReturnType<typeof calculateStrategyScore>) {
  if (score.rawData.completedTasks <= 0) {
    return { aiInsights: null as string | null, aiAreas: [] as string[] };
  }

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
- Overall: ${score.overall}/100
- Task Completion: ${score.factors.completion}% (${score.rawData.completedTasks}/${score.rawData.totalTasks} tasks done)
- On-Time Delivery: ${score.factors.onTime}% (${score.rawData.onTimeTasks} on time, ${score.rawData.lateTasks} late)
- Consistency: ${score.factors.consistency}% (${score.rawData.activeDays} active days, max gap: ${score.rawData.maxGapDays} days)
- Plan Adherence: ${score.factors.adherence}% (${score.rawData.tasksCompletedInOrder}/${score.rawData.totalOrderedTasks} in order)
- Content Production: ${score.factors.production}% (${score.rawData.postsCreated} posts, ${score.rawData.postsAlignedWithStrategy} aligned)

Return JSON with: summary (2-3 sentences), strength (one top strength), improvement (biggest area to improve), tip (one specific actionable tip), areas (array of 2-3 improvement areas as short phrases)`,
      {
        maxTokens: 512,
        systemPrompt:
          "You are a supportive marketing performance coach. Be encouraging but honest. Keep responses concise.",
      }
    );

    if (!insightResponse) {
      return { aiInsights: null, aiAreas: [] };
    }

    return {
      aiInsights: `${insightResponse.summary}\n\n**Top Strength:** ${insightResponse.strength}\n\n**Area to Improve:** ${insightResponse.improvement}\n\n**Tip:** ${insightResponse.tip}`,
      aiAreas: insightResponse.areas || [],
    };
  } catch (err) {
    console.error("AI insights generation failed:", err);
    return { aiInsights: null, aiAreas: [] };
  }
}

// GET /api/content/strategy/score/report - Full monthly report data
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

    const strategy = await prisma.marketingStrategy.findFirst({
      where: { userId: session.userId, status: "ACTIVE" },
      include: { tasks: true },
    });

    if (!strategy) {
      return NextResponse.json({
        success: true,
        data: listMode ? { reports: [], months: [], years: [], currentMonth: null } : { report: null },
      });
    }

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

      const now = new Date();
      const selectedYearParam = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);
      const selectedYear = Number.isFinite(selectedYearParam) ? selectedYearParam : now.getFullYear();
      const selectedYearStart = new Date(selectedYear, 0, 1);
      const selectedYearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);

      const posts = await prisma.post.findMany({
        where: {
          userId: session.userId,
          deletedAt: null,
          publishedAt: { gte: selectedYearStart, lte: selectedYearEnd },
        },
        select: { id: true, caption: true, hashtags: true, publishedAt: true, createdAt: true },
      });

      const milestones = await prisma.strategyMilestone.findMany({
        where: { userId: session.userId, strategyId: strategy.id },
        select: { achievedAt: true },
      });

      const milestoneCounts: Record<string, number> = {};
      for (const milestone of milestones) {
        const key = monthKey(milestone.achievedAt.getFullYear(), milestone.achievedAt.getMonth() + 1);
        milestoneCounts[key] = (milestoneCounts[key] || 0) + 1;
      }

      const scoreMap = new Map<string, ScoreRow>(
        scores.map((score) => [monthKey(score.year, score.month), score])
      );

      const months = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const key = monthKey(selectedYear, month);
        const stored = scoreMap.get(key);
        const current = selectedYear === now.getFullYear() && month === now.getMonth() + 1;
        const future = isFutureMonth(selectedYear, month, now);

        if (stored) {
          return {
            id: stored.id,
            month,
            year: selectedYear,
            overallScore: stored.overallScore,
            completionScore: stored.completionScore,
            onTimeScore: stored.onTimeScore,
            consistencyScore: stored.consistencyScore,
            adherenceScore: stored.adherenceScore,
            productionScore: stored.productionScore,
            factors: {
              completion: stored.completionScore,
              onTime: stored.onTimeScore,
              consistency: stored.consistencyScore,
              adherence: stored.adherenceScore,
              production: stored.productionScore,
            },
            previousScore: stored.previousScore,
            milestoneCount: milestoneCounts[key] || 0,
            trend: stored.previousScore != null ? stored.overallScore - stored.previousScore : null,
            status: current ? "current" : "stored",
            hasReport: true,
            emailEligible: true,
          };
        }

        if (!future && strategy.tasks.length > 0) {
          const { periodStart, periodEnd } = getMonthPeriod(selectedYear, month);
          const monthPosts = posts.filter((post) => {
            const publishedAt = post.publishedAt;
            return publishedAt && publishedAt >= periodStart && publishedAt <= periodEnd;
          });
          const liveScore = calculateStrategyScore({
            tasks: strategy.tasks,
            posts: monthPosts,
            periodStart,
            periodEnd,
          });

          return {
            id: key,
            month,
            year: selectedYear,
            overallScore: liveScore.overall,
            completionScore: liveScore.factors.completion,
            onTimeScore: liveScore.factors.onTime,
            consistencyScore: liveScore.factors.consistency,
            adherenceScore: liveScore.factors.adherence,
            productionScore: liveScore.factors.production,
            factors: liveScore.factors,
            previousScore: null,
            milestoneCount: milestoneCounts[key] || 0,
            trend: null,
            status: current ? "current" : "generated",
            hasReport: true,
            emailEligible: true,
          };
        }

        return {
          id: key,
          month,
          year: selectedYear,
          overallScore: null,
          completionScore: null,
          onTimeScore: null,
          consistencyScore: null,
          adherenceScore: null,
          productionScore: null,
          factors: null,
          previousScore: null,
          milestoneCount: milestoneCounts[key] || 0,
          trend: null,
          status: "upcoming",
          hasReport: false,
          emailEligible: false,
        };
      });

      const monthSummaryMap = new Map<string, { overallScore: number | null }>(
        months.map((month) => [monthKey(month.year, month.month), month])
      );

      const monthsWithTrend = months.map((month) => {
        if (month.overallScore === null || month.trend !== null || month.previousScore !== null) {
          return month;
        }

        const previous = getPreviousPeriod(month.year, month.month);
        const previousKey = monthKey(previous.year, previous.month);
        const previousStored = scoreMap.get(previousKey);
        const previousGenerated = monthSummaryMap.get(previousKey);
        const previousScore = previousStored?.overallScore ?? previousGenerated?.overallScore ?? null;

        return {
          ...month,
          previousScore,
          trend: previousScore != null ? month.overallScore - previousScore : null,
        };
      });

      const currentMonth =
        selectedYear === now.getFullYear()
          ? monthsWithTrend.find((month) => month.month === now.getMonth() + 1) || null
          : null;

      const userPrefs = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { notificationPrefs: true, email: true },
      });

      let emailEnabled = true;
      try {
        const prefs = userPrefs?.notificationPrefs
          ? JSON.parse(userPrefs.notificationPrefs as string)
          : {};
        emailEnabled = prefs?.email?.strategy !== false;
      } catch {
        emailEnabled = true;
      }

      const availableYears = Array.from(
        new Set([
          now.getFullYear(),
          selectedYear,
          strategy.createdAt.getFullYear(),
          ...scores.map((score) => score.year),
        ])
      ).sort((a, b) => b - a);

      return NextResponse.json({
        success: true,
        data: {
          reports: scores.map((score) => ({
            ...score,
            milestoneCount: milestoneCounts[monthKey(score.year, score.month)] || 0,
            trend: score.previousScore != null ? score.overallScore - score.previousScore : null,
          })),
          months: monthsWithTrend,
          years: availableYears,
          selectedYear,
          currentMonth: currentMonth?.overallScore != null && currentMonth.factors
            ? {
                month: currentMonth.month,
                year: currentMonth.year,
                overallScore: currentMonth.overallScore,
                factors: currentMonth.factors,
                trend: currentMonth.trend,
                milestoneCount: currentMonth.milestoneCount,
                status: currentMonth.status,
              }
            : null,
          emailAutomation: {
            enabled: emailEnabled,
            recipient: userPrefs?.email || session.user.email,
            cadence: "monthly",
            schedule: "First day of each month after the prior month closes",
          },
        },
      });
    }

    const monthParam = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const yearParam = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

    const { periodStart, periodEnd } = getMonthPeriod(yearParam, monthParam);

    const stored = await prisma.strategyScore.findUnique({
      where: {
        userId_strategyId_month_year: {
          userId: session.userId,
          strategyId: strategy.id,
          month: monthParam,
          year: yearParam,
        },
      },
    });

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

    let aiInsights = stored?.aiInsights || null;
    let aiAreas: string[] = [];
    if (stored?.aiAreas) {
      try {
        aiAreas = JSON.parse(stored.aiAreas);
      } catch {
        aiAreas = [];
      }
    }

    if (!aiInsights) {
      const generated = await generateInsights(liveScore);
      aiInsights = generated.aiInsights;
      aiAreas = generated.aiAreas;

      if (stored && aiInsights) {
        await prisma.strategyScore.update({
          where: { id: stored.id },
          data: { aiInsights, aiAreas: JSON.stringify(aiAreas) },
        });
      }
    }

    const timeline: Array<{ date: string; completed: number }> = [];
    const dayMap = new Map<string, number>();
    for (const task of strategy.tasks) {
      if (task.status === "DONE" && task.completedAt) {
        const completedAt = new Date(task.completedAt);
        if (completedAt >= periodStart && completedAt <= periodEnd) {
          const key = `${completedAt.getFullYear()}-${String(completedAt.getMonth() + 1).padStart(2, "0")}-${String(completedAt.getDate()).padStart(2, "0")}`;
          dayMap.set(key, (dayMap.get(key) || 0) + 1);
        }
      }
    }

    const cursor = new Date(periodStart);
    while (cursor <= periodEnd) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      timeline.push({ date: key, completed: dayMap.get(key) || 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    const milestones = await prisma.strategyMilestone.findMany({
      where: {
        userId: session.userId,
        strategyId: strategy.id,
        achievedAt: { gte: periodStart, lte: periodEnd },
      },
      orderBy: { achievedAt: "asc" },
    });

    const previous = getPreviousPeriod(yearParam, monthParam);
    const previousScore = stored?.previousScore ?? (
      await prisma.strategyScore.findFirst({
        where: {
          userId: session.userId,
          strategyId: strategy.id,
          month: previous.month,
          year: previous.year,
        },
        select: { overallScore: true },
      })
    )?.overallScore ?? null;

    const overall = stored?.overallScore ?? liveScore.overall;

    return NextResponse.json({
      success: true,
      data: {
        score: {
          overall,
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
        trend: previousScore != null ? overall - previousScore : null,
        previousScore,
        milestones: milestones.map((milestone) => ({
          id: milestone.id,
          key: milestone.milestoneKey,
          title: milestone.title,
          description: milestone.description,
          icon: milestone.icon,
          sharedToFeed: milestone.sharedToFeed,
          sharedPostId: milestone.sharedPostId,
          achievedAt: milestone.achievedAt.toISOString(),
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
