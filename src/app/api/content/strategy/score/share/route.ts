import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// POST /api/content/strategy/score/share — Share milestone or score to feed
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { milestoneId, type, month, year } = body;

    let caption: string;
    let hashtags: string[];

    if (milestoneId) {
      // Share a milestone
      const milestone = await prisma.strategyMilestone.findUnique({
        where: { id: milestoneId },
        include: { strategy: { select: { name: true } } },
      });

      if (!milestone || milestone.userId !== session.userId) {
        return NextResponse.json(
          { success: false, error: { message: "Milestone not found" } },
          { status: 404 }
        );
      }

      if (milestone.sharedToFeed) {
        return NextResponse.json(
          { success: false, error: { message: "Already shared to feed" } },
          { status: 400 }
        );
      }

      caption = `I just hit a milestone in my marketing strategy "${milestone.strategy.name}"!\n\n${milestone.title} - ${milestone.description}`;
      hashtags = ["#MarketingGoals", "#FlowSmartly", "#Milestone", "#MarketingStrategy"];

      // Create post
      const post = await prisma.post.create({
        data: {
          userId: session.userId,
          caption,
          hashtags: JSON.stringify(hashtags),
          mentions: "[]",
          platforms: JSON.stringify(["feed"]),
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      // Mark milestone as shared
      await prisma.strategyMilestone.update({
        where: { id: milestoneId },
        data: { sharedToFeed: true, sharedPostId: post.id },
      });

      return NextResponse.json({
        success: true,
        data: { postId: post.id, caption },
      });
    }

    if (type === "score" && month && year) {
      // Share monthly score
      const strategy = await prisma.marketingStrategy.findFirst({
        where: { userId: session.userId, status: "ACTIVE" },
        select: { id: true, name: true },
      });

      if (!strategy) {
        return NextResponse.json(
          { success: false, error: { message: "No active strategy" } },
          { status: 404 }
        );
      }

      const score = await prisma.strategyScore.findUnique({
        where: {
          userId_strategyId_month_year: {
            userId: session.userId,
            strategyId: strategy.id,
            month: parseInt(month),
            year: parseInt(year),
          },
        },
      });

      const monthName = MONTH_NAMES[parseInt(month) - 1] || "Unknown";
      const scoreVal = score?.overallScore ?? 0;

      caption = `My marketing strategy score for ${monthName} ${year} is ${scoreVal}/100!\n\nStrategy: "${strategy.name}"\n\nKeep building, keep growing.`;
      hashtags = ["#MarketingStrategy", "#FlowSmartly", "#MonthlyReport", "#MarketingScore"];

      const post = await prisma.post.create({
        data: {
          userId: session.userId,
          caption,
          hashtags: JSON.stringify(hashtags),
          mentions: "[]",
          platforms: JSON.stringify(["feed"]),
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        data: { postId: post.id, caption },
      });
    }

    return NextResponse.json(
      { success: false, error: { message: "Invalid share request. Provide milestoneId or type=score with month/year." } },
      { status: 400 }
    );
  } catch (error) {
    console.error("Share score error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to share" } },
      { status: 500 }
    );
  }
}
