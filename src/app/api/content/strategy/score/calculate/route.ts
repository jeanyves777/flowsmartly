import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  calculateStrategyScore,
  checkMilestones,
  type ScoreInput,
} from "@/lib/strategy/scoring";
import { createNotification, NOTIFICATION_TYPES } from "@/lib/notifications";
import { sendMilestoneEmail, sendStrategyReportEmail } from "@/lib/email";
import { ai } from "@/lib/ai/client";

// POST /api/content/strategy/score/calculate — Cron: monthly score calculation
export async function POST(request: NextRequest) {
  try {
    // Auth: CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // Calculate for previous month
    const now = new Date();
    const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // Previous month (1-12)
    const targetYear =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const periodStart = new Date(targetYear, targetMonth - 1, 1);
    const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    // Find all users with ACTIVE strategies
    const strategies = await prisma.marketingStrategy.findMany({
      where: { status: "ACTIVE" },
      include: {
        tasks: true,
        user: {
          select: { id: true, email: true, name: true, notificationPrefs: true },
        },
      },
    });

    let processedCount = 0;
    let milestonesAwarded = 0;
    let emailsSent = 0;

    for (const strategy of strategies) {
      const user = strategy.user;
      if (strategy.tasks.length === 0) continue;

      // Fetch user's posts for the target month
      const posts = await prisma.post.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
          publishedAt: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          caption: true,
          hashtags: true,
          publishedAt: true,
          createdAt: true,
        },
      });

      const input: ScoreInput = {
        tasks: strategy.tasks,
        posts,
        periodStart,
        periodEnd,
      };

      const score = calculateStrategyScore(input);

      // Get previous month's score for trend
      const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
      const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
      const previousScore = await prisma.strategyScore.findFirst({
        where: {
          userId: user.id,
          strategyId: strategy.id,
          month: prevMonth,
          year: prevYear,
        },
        select: { overallScore: true },
      });

      // Generate AI insights
      let aiInsights: string | null = null;
      let aiAreas: string[] = [];
      if (score.rawData.completedTasks > 0) {
        try {
          const insightResult = await ai.generateJSON<{
            summary: string;
            strength: string;
            improvement: string;
            tip: string;
            areas: string[];
          }>(
            `Analyze this marketing strategy performance for a monthly report.

Score: ${score.overall}/100
- Completion: ${score.factors.completion}% (${score.rawData.completedTasks}/${score.rawData.totalTasks} tasks)
- On-Time: ${score.factors.onTime}% (${score.rawData.onTimeTasks} on time, ${score.rawData.lateTasks} late)
- Consistency: ${score.factors.consistency}% (${score.rawData.activeDays} active days)
- Adherence: ${score.factors.adherence}%
- Production: ${score.factors.production}% (${score.rawData.postsCreated} posts)

Return JSON: { summary, strength, improvement, tip, areas }`,
            {
              maxTokens: 512,
              systemPrompt:
                "You are a supportive marketing coach. Be encouraging but honest. Keep it concise.",
            }
          );

          if (insightResult) {
            aiInsights = `${insightResult.summary}\n\n**Top Strength:** ${insightResult.strength}\n\n**Area to Improve:** ${insightResult.improvement}\n\n**Tip:** ${insightResult.tip}`;
            aiAreas = insightResult.areas || [];
          }
        } catch (err) {
          console.error("AI insight generation failed for", user.id, err);
        }
      }

      // Upsert StrategyScore
      await prisma.strategyScore.upsert({
        where: {
          userId_strategyId_month_year: {
            userId: user.id,
            strategyId: strategy.id,
            month: targetMonth,
            year: targetYear,
          },
        },
        update: {
          overallScore: score.overall,
          completionScore: score.factors.completion,
          onTimeScore: score.factors.onTime,
          consistencyScore: score.factors.consistency,
          adherenceScore: score.factors.adherence,
          productionScore: score.factors.production,
          rawData: JSON.stringify(score.rawData),
          aiInsights,
          aiAreas: JSON.stringify(aiAreas),
          previousScore: previousScore?.overallScore ?? null,
        },
        create: {
          userId: user.id,
          strategyId: strategy.id,
          month: targetMonth,
          year: targetYear,
          overallScore: score.overall,
          completionScore: score.factors.completion,
          onTimeScore: score.factors.onTime,
          consistencyScore: score.factors.consistency,
          adherenceScore: score.factors.adherence,
          productionScore: score.factors.production,
          rawData: JSON.stringify(score.rawData),
          aiInsights,
          aiAreas: JSON.stringify(aiAreas),
          previousScore: previousScore?.overallScore ?? null,
        },
      });

      processedCount++;

      // Check milestones
      const existingMilestones = await prisma.strategyMilestone.findMany({
        where: { userId: user.id, strategyId: strategy.id },
        select: { milestoneKey: true },
      });
      const existingKeys = existingMilestones.map((m) => m.milestoneKey);
      const newMilestones = checkMilestones(input, score, existingKeys);

      // Check email preference
      let sendEmails = false;
      try {
        const prefs = user.notificationPrefs
          ? JSON.parse(user.notificationPrefs as string)
          : {};
        sendEmails = prefs?.email?.strategy !== false;
      } catch {
        sendEmails = true;
      }

      for (const milestone of newMilestones) {
        await prisma.strategyMilestone.create({
          data: {
            userId: user.id,
            strategyId: strategy.id,
            milestoneKey: milestone.key,
            title: milestone.title,
            description: milestone.description,
            icon: milestone.icon,
          },
        });

        await createNotification({
          userId: user.id,
          type: NOTIFICATION_TYPES.STRATEGY_MILESTONE,
          title: `Milestone: ${milestone.title}`,
          message: milestone.description,
          data: { milestoneKey: milestone.key, strategyName: strategy.name },
          actionUrl: "/content/strategy/reports",
        });

        if (sendEmails) {
          await sendMilestoneEmail({
            to: user.email,
            name: user.name || "there",
            milestoneTitle: milestone.title,
            milestoneDescription: milestone.description,
            strategyName: strategy.name,
          }).catch((err: Error) =>
            console.error("Milestone email failed:", err)
          );
        }

        milestonesAwarded++;
      }

      // Send monthly report notification
      await createNotification({
        userId: user.id,
        type: NOTIFICATION_TYPES.STRATEGY_MONTHLY_REPORT,
        title: "Monthly Strategy Report Ready",
        message: `Your strategy score for ${strategy.name} is ${score.overall}/100`,
        data: { score: score.overall, month: targetMonth, year: targetYear },
        actionUrl: `/content/strategy/reports/${targetYear}-${String(targetMonth).padStart(2, "0")}`,
      });

      // Send report email
      if (sendEmails) {
        await sendStrategyReportEmail({
          to: user.email,
          name: user.name || "there",
          score: score.overall,
          month: targetMonth,
          year: targetYear,
          strategyName: strategy.name,
          factors: score.factors,
          aiInsights: aiInsights || undefined,
        }).catch((err: Error) =>
          console.error("Report email failed:", err)
        );
        emailsSent++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        milestonesAwarded,
        emailsSent,
        month: targetMonth,
        year: targetYear,
      },
    });
  } catch (error) {
    console.error("Calculate strategy scores error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to calculate scores" } },
      { status: 500 }
    );
  }
}
