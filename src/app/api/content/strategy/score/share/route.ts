import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildScoreCaption({
  monthName,
  year,
  score,
  strategyName,
}: {
  monthName: string;
  year: string | number;
  score: number;
  strategyName: string;
}) {
  return `My marketing strategy score for ${monthName} ${year} is ${score}/100!\n\nStrategy: "${strategyName}"\n\nKeep building, keep growing.`;
}

function buildScoreCardDataUri({
  monthName,
  year,
  score,
  strategyName,
  brandName,
}: {
  monthName: string;
  year: string | number;
  score: number;
  strategyName: string;
  brandName: string;
}) {
  const tone = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <rect width="1200" height="675" fill="#071016"/>
  <rect x="48" y="48" width="1104" height="579" rx="42" fill="#0c141d" stroke="#1f3445" stroke-width="2"/>
  <circle cx="980" cy="168" r="96" fill="${tone}" opacity="0.18"/>
  <circle cx="980" cy="168" r="70" fill="none" stroke="${tone}" stroke-width="10"/>
  <text x="980" y="185" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="54" font-weight="800" fill="#ffffff">${score}</text>
  <text x="980" y="230" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="#a7b5c2">/100</text>
  <text x="96" y="132" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#38bdf8">${escapeXml(brandName)}</text>
  <text x="96" y="205" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="850" fill="#ffffff">Marketing Score</text>
  <text x="96" y="262" font-family="Inter, Arial, sans-serif" font-size="34" fill="#cbd5e1">${escapeXml(monthName)} ${escapeXml(String(year))}</text>
  <text x="96" y="366" font-family="Inter, Arial, sans-serif" font-size="30" fill="#e2e8f0">${escapeXml(strategyName).slice(0, 72)}</text>
  <text x="96" y="538" font-family="Inter, Arial, sans-serif" font-size="28" fill="#94a3b8">Tracked with FlowSmartly Strategy Reports</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

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
    const { milestoneId, type, month, year, preview } = body;

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
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId, isDefault: true },
        select: { name: true },
      });

      caption = buildScoreCaption({
        monthName,
        year,
        score: scoreVal,
        strategyName: strategy.name,
      });
      hashtags = ["#MarketingStrategy", "#FlowSmartly", "#MonthlyReport", "#MarketingScore"];
      const mediaUrl = buildScoreCardDataUri({
        monthName,
        year,
        score: scoreVal,
        strategyName: strategy.name,
        brandName: brandKit?.name || "FlowSmartly",
      });

      if (preview) {
        return NextResponse.json({
          success: true,
          data: { caption, hashtags, mediaType: "image", mediaUrl },
        });
      }

      const post = await prisma.post.create({
        data: {
          userId: session.userId,
          caption,
          hashtags: JSON.stringify(hashtags),
          mentions: "[]",
          mediaType: "image",
          mediaUrl,
          mediaMeta: JSON.stringify({
            source: "strategy-score-share",
            month: parseInt(month),
            year: parseInt(year),
            score: scoreVal,
          }),
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
