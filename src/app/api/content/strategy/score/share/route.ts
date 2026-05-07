import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { calculateStrategyScore } from "@/lib/strategy/scoring";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ShareFactors {
  completion: number;
  onTime: number;
  consistency: number;
  adherence: number;
  production: number;
}

interface ShareRawData {
  totalTasks: number;
  completedTasks: number;
  activeDays: number;
  postsCreated: number;
  postsAlignedWithStrategy: number;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clampScore(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function parseJSON<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getMonthPeriod(year: number, month: number) {
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59),
  };
}

function splitSvgLines(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = next;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\.*$/, "")}...`;
  }
  return lines;
}

function buildScoreCaption({
  monthName,
  year,
  score,
  strategyName,
  rawData,
}: {
  monthName: string;
  year: string | number;
  score: number;
  strategyName: string;
  rawData: ShareRawData;
}) {
  return `My FlowSmartly marketing score for ${monthName} ${year} is ${score}/100.\n\nStrategy: "${strategyName}"\n\n${rawData.completedTasks}/${rawData.totalTasks} plan items completed, ${rawData.postsAlignedWithStrategy} aligned post${rawData.postsAlignedWithStrategy === 1 ? "" : "s"} tracked, and every move is tied back to the strategy.`;
}

function buildScoreCardDataUri({
  monthName,
  year,
  score,
  strategyName,
  brandName,
  factors,
  rawData,
  activeFlows,
  trend,
}: {
  monthName: string;
  year: string | number;
  score: number;
  strategyName: string;
  brandName: string;
  factors: ShareFactors;
  rawData: ShareRawData;
  activeFlows: number;
  trend: number | null;
}) {
  const tone = score >= 80 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#38bdf8";
  const glow = score >= 80 ? "#16a34a" : score >= 50 ? "#f97316" : "#0ea5e9";
  const circumference = 2 * Math.PI * 92;
  const dash = Math.max(0, Math.min(100, score)) * (circumference / 100);
  const strategyLines = splitSvgLines(strategyName, 48, 2);
  const trendText = trend == null ? "First tracked month" : `${trend >= 0 ? "+" : ""}${trend} vs prior month`;
  const factorRows: Array<[string, number, string]> = [
    ["Completion", factors.completion, "#22c55e"],
    ["On-time", factors.onTime, "#38bdf8"],
    ["Consistency", factors.consistency, "#a78bfa"],
    ["Adherence", factors.adherence, "#f97316"],
    ["Production", factors.production, "#06b6d4"],
  ];
  const factorSvg = factorRows
    .map(([label, value, color], index) => {
      const y = 372 + index * 42;
      const width = Math.max(8, Math.min(100, value)) * 2.35;
      return `
  <text x="760" y="${y}" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="700" fill="#e5eef8">${escapeXml(label)}</text>
  <text x="1050" y="${y}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="19" font-weight="800" fill="#ffffff">${value}%</text>
  <rect x="760" y="${y + 12}" width="290" height="9" rx="4.5" fill="#183044"/>
  <rect x="760" y="${y + 12}" width="${width}" height="9" rx="4.5" fill="${color}"/>`;
    })
    .join("");
  const strategySvg = strategyLines
    .map(
      (line, index) =>
        `<text x="92" y="${318 + index * 34}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="700" fill="#f8fafc">${escapeXml(line)}</text>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.48" stop-color="#092033"/>
      <stop offset="1" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="hero" x1="0" x2="1">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="0.55" stop-color="#22c55e"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <circle cx="1010" cy="104" r="230" fill="${glow}" opacity="0.18" filter="url(#glow)"/>
  <circle cx="142" cy="610" r="180" fill="#38bdf8" opacity="0.12" filter="url(#glow)"/>
  <rect x="50" y="44" width="1100" height="587" rx="40" fill="#071522" opacity="0.88" stroke="#244055" stroke-width="2"/>
  <rect x="74" y="68" width="1052" height="539" rx="30" fill="#0c1a28" opacity="0.72" stroke="#1d3447"/>
  <text x="92" y="122" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800" fill="#38bdf8">${escapeXml(brandName)}</text>
  <text x="92" y="174" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#cbd5e1">${escapeXml(monthName)} ${escapeXml(String(year))} Strategy Report</text>
  <text x="92" y="242" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="900" fill="#ffffff">Marketing Momentum</text>
  <text x="92" y="282" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600" fill="#8fb5ca">Powered by FlowSmartly AI strategy tracking</text>
  ${strategySvg}
  <g transform="translate(866 168)">
    <circle cx="0" cy="0" r="118" fill="${tone}" opacity="0.12"/>
    <circle cx="0" cy="0" r="92" fill="none" stroke="#183044" stroke-width="18"/>
    <circle cx="0" cy="0" r="92" fill="none" stroke="url(#hero)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90)" filter="url(#glow)"/>
    <text x="0" y="12" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="950" fill="#ffffff">${score}</text>
    <text x="0" y="54" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#b6c8d8">/100</text>
  </g>
  <text x="866" y="322" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="${tone}">${escapeXml(trendText)}</text>
  <rect x="92" y="410" width="180" height="104" rx="22" fill="#10263a" stroke="#244055"/>
  <text x="116" y="458" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${rawData.completedTasks}/${rawData.totalTasks}</text>
  <text x="116" y="490" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#9bb1c4">Plan items done</text>
  <rect x="292" y="410" width="180" height="104" rx="22" fill="#10263a" stroke="#244055"/>
  <text x="316" y="458" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${rawData.postsAlignedWithStrategy}</text>
  <text x="316" y="490" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#9bb1c4">Aligned posts</text>
  <rect x="492" y="410" width="180" height="104" rx="22" fill="#10263a" stroke="#244055"/>
  <text x="516" y="458" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="900" fill="#ffffff">${activeFlows}</text>
  <text x="516" y="490" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="#9bb1c4">AI flows active</text>
  <text x="760" y="342" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900" fill="#ffffff">Performance signals</text>
  ${factorSvg}
  <rect x="92" y="548" width="580" height="2" rx="1" fill="url(#hero)"/>
  <text x="92" y="586" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="800" fill="#f8fafc">Strategy, content, automations, and reporting in one operating system.</text>
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
    const { milestoneId, type, month, year, preview, score: displayedScore } = body;

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
        include: { tasks: true },
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

      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const { periodStart, periodEnd } = getMonthPeriod(targetYear, targetMonth);
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
      const activeFlows = await prisma.postAutomation.count({
        where: { userId: session.userId, enabled: true, sourceStrategyId: strategy.id },
      });
      const previous = targetMonth === 1 ? { month: 12, year: targetYear - 1 } : { month: targetMonth - 1, year: targetYear };
      const previousScore = await prisma.strategyScore.findUnique({
        where: {
          userId_strategyId_month_year: {
            userId: session.userId,
            strategyId: strategy.id,
            month: previous.month,
            year: previous.year,
          },
        },
        select: { overallScore: true },
      });
      const monthName = MONTH_NAMES[parseInt(month) - 1] || "Unknown";
      const clientScore = clampScore(displayedScore);
      const scoreVal = clientScore ?? score?.overallScore ?? liveScore.overall;
      const factors: ShareFactors = score
        ? {
            completion: score.completionScore,
            onTime: score.onTimeScore,
            consistency: score.consistencyScore,
            adherence: score.adherenceScore,
            production: score.productionScore,
          }
        : liveScore.factors;
      const rawData = score?.rawData
        ? parseJSON<ShareRawData>(score.rawData, liveScore.rawData)
        : liveScore.rawData;
      const trend = previousScore?.overallScore != null ? scoreVal - previousScore.overallScore : null;
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId, isDefault: true },
        select: { name: true },
      });

      caption = buildScoreCaption({
        monthName,
        year,
        score: scoreVal,
        strategyName: strategy.name,
        rawData,
      });
      hashtags = ["#FlowSmartly", "#MarketingMomentum", "#AIStrategy", "#MonthlyReport"];
      const mediaUrl = buildScoreCardDataUri({
        monthName,
        year,
        score: scoreVal,
        strategyName: strategy.name,
        brandName: brandKit?.name || "FlowSmartly",
        factors,
        rawData,
        activeFlows,
        trend,
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
