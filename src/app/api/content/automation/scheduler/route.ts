import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { openaiClient } from "@/lib/ai/openai-client";
import { uploadToS3 } from "@/lib/utils/s3-client";

interface ScheduleConfig {
  frequency?: string;
  dayOfWeek?: number;
  time?: string;
}

function parseSchedule(scheduleStr: string): ScheduleConfig {
  try {
    return JSON.parse(scheduleStr);
  } catch {
    return {};
  }
}

/**
 * Check if an automation is due to run based on its schedule and last trigger time.
 */
function isDue(
  schedule: ScheduleConfig,
  lastTriggered: Date | null,
  now: Date
): boolean {
  const { frequency, dayOfWeek, time } = schedule;
  if (!frequency || !time) return false;

  const [hStr, mStr] = time.split(":");
  const scheduledHour = parseInt(hStr, 10);
  const scheduledMinute = parseInt(mStr, 10);
  if (isNaN(scheduledHour) || isNaN(scheduledMinute)) return false;

  const nowHour = now.getUTCHours();
  const nowMinute = now.getUTCMinutes();

  // Check if within 30-min window of scheduled time
  const nowMinutes = nowHour * 60 + nowMinute;
  const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
  const timeDiff = Math.abs(nowMinutes - scheduledMinutes);
  if (timeDiff > 30 && timeDiff < 1410) return false; // 1410 = 24*60 - 30 (wrap-around)

  // Check day constraints
  const nowDay = now.getUTCDay();

  if (frequency === "WEEKLY" && dayOfWeek !== undefined && nowDay !== dayOfWeek) {
    return false;
  }

  if (frequency === "MONTHLY" && now.getUTCDate() !== 1) {
    return false;
  }

  // Check cooldown based on lastTriggered to avoid double-runs
  if (lastTriggered) {
    const hoursSinceLast = (now.getTime() - lastTriggered.getTime()) / 3600000;
    if (frequency === "DAILY" && hoursSinceLast < 23) return false;
    if (frequency === "WEEKLY" && hoursSinceLast < 144) return false; // 6 days
    if (frequency === "MONTHLY" && hoursSinceLast < 648) return false; // 27 days
  }

  return true;
}

// POST /api/content/automation/scheduler
// Called by external cron service (every 15 minutes). Protected by CRON_SECRET.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all enabled, non-expired automations
    const automations = await prisma.postAutomation.findMany({
      where: {
        enabled: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: {
        user: { select: { id: true, aiCredits: true } },
      },
    });

    const results: Array<{
      automationId: string;
      name: string;
      status: "triggered" | "skipped" | "failed";
      reason?: string;
    }> = [];

    for (const automation of automations) {
      const schedule = parseSchedule(automation.schedule);

      if (!isDue(schedule, automation.lastTriggered, now)) {
        continue;
      }

      // Calculate credit cost
      let creditCost = await getDynamicCreditCost("AI_POST");
      if (automation.includeMedia) {
        if (automation.mediaType === "image") {
          creditCost += await getDynamicCreditCost("AI_VISUAL_DESIGN");
        } else if (automation.mediaType === "video") {
          creditCost += await getDynamicCreditCost("AI_VIDEO_STUDIO");
        }
      }

      // Check user credits
      if (automation.user.aiCredits < creditCost) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          status: "skipped",
          reason: `Insufficient credits (need ${creditCost}, have ${automation.user.aiCredits})`,
        });
        continue;
      }

      try {
        // Generate AI content
        const topicContext = automation.topic ? `Topic: ${automation.topic}. ` : "";
        const prompt = automation.aiPrompt || "Write an engaging social media post";
        const toneInstruction = automation.aiTone
          ? `Use a ${automation.aiTone} tone.`
          : "Use a professional tone.";

        const generatedContent = await ai.generate(
          `${topicContext}${prompt}. ${toneInstruction} Include relevant hashtags. Keep it engaging and concise.`,
          {
            maxTokens: 512,
            systemPrompt:
              "You are an expert social media content creator. Write engaging, platform-ready posts.",
          }
        );

        if (!generatedContent?.trim()) {
          results.push({
            automationId: automation.id,
            name: automation.name,
            status: "failed",
            reason: "AI generated empty content",
          });
          continue;
        }

        const hashtags = generatedContent.match(/#[\w]+/g) || [];
        const mentions = generatedContent.match(/@[\w]+/g) || [];

        // Generate media if enabled
        let mediaUrl: string | null = null;
        let mediaMeta: string | null = null;
        let postMediaType: string | null = null;

        if (automation.includeMedia && automation.mediaType === "image") {
          try {
            const styleHint = automation.mediaStyle ? `. Style: ${automation.mediaStyle}` : "";
            const captionExcerpt = generatedContent.replace(/#[\w]+/g, "").trim().substring(0, 200);
            const mediaPrompt = `Create a social media visual for: ${captionExcerpt}${styleHint}`;

            const base64Image = await openaiClient.generateImage(mediaPrompt, {
              size: "1536x1024",
              quality: "medium",
            });

            if (base64Image) {
              const imageBuffer = Buffer.from(base64Image, "base64");
              const s3Key = `automation/${automation.id}/${Date.now()}.png`;
              mediaUrl = await uploadToS3(s3Key, imageBuffer, "image/png");
              mediaMeta = JSON.stringify([{ url: mediaUrl, type: "image" }]);
              postMediaType = "image";
            }
          } catch (mediaError) {
            console.warn(`[Scheduler] Media generation failed for ${automation.id}:`, mediaError);
          }
        }

        const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

        let platforms: string[] = [];
        try {
          platforms = JSON.parse(automation.platforms || "[]");
        } catch {
          platforms = ["feed"];
        }

        // Create post + deduct credits + update automation stats
        await prisma.$transaction([
          prisma.post.create({
            data: {
              userId: automation.userId,
              caption: generatedContent,
              hashtags: JSON.stringify(hashtags),
              mentions: JSON.stringify(mentions),
              platforms: JSON.stringify(platforms),
              status: "SCHEDULED",
              scheduledAt,
              mediaUrl,
              mediaMeta,
              mediaType: postMediaType,
            },
          }),
          prisma.user.update({
            where: { id: automation.userId },
            data: { aiCredits: { decrement: creditCost } },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: automation.userId,
              type: "USAGE",
              amount: -creditCost,
              balanceAfter: automation.user.aiCredits - creditCost,
              referenceType: "ai_usage",
              description: `Scheduled automation: ${automation.name}`,
            },
          }),
          prisma.postAutomation.update({
            where: { id: automation.id },
            data: {
              lastTriggered: now,
              totalGenerated: { increment: 1 },
              totalCreditsSpent: { increment: creditCost },
            },
          }),
        ]);

        // Fire-and-forget activity sync
        triggerActivitySyncForUser(automation.userId).catch((err) =>
          console.error("Activity sync failed for scheduled automation:", err)
        );

        results.push({
          automationId: automation.id,
          name: automation.name,
          status: "triggered",
        });
      } catch (runError) {
        console.error(`[Scheduler] Failed to run automation ${automation.id}:`, runError);
        results.push({
          automationId: automation.id,
          name: automation.name,
          status: "failed",
          reason: runError instanceof Error ? runError.message : "Unknown error",
        });
      }
    }

    const triggered = results.filter((r) => r.status === "triggered").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    console.log(
      `[Scheduler] Checked ${automations.length} automations: ${triggered} triggered, ${failed} failed, ${skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      data: { checked: automations.length, triggered, failed, skipped, results },
    });
  } catch (error) {
    console.error("Automation scheduler error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Scheduler failed" } },
      { status: 500 }
    );
  }
}
