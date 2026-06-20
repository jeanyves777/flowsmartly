import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { generateAutomationAsset } from "@/lib/strategy/automation-execution";
import { generateBrandedImage } from "@/lib/media/branded-image";
import { generateVideoForRole } from "@/lib/ai/video-router";
import { uploadToS3, getPresignedUrl } from "@/lib/utils/s3-client";
import { isCronAuthorized } from "@/lib/cron/auth";
import {
  shouldPublishAsBlogAutomation,
  runBlogAutomationPublication,
} from "@/lib/content/blog-automation-runner";
import { processDueContentAutomations } from "@/lib/content/campaign-scheduler";

interface ScheduleConfig {
  frequency?: string;
  dayOfWeek?: number;
  time?: string;
  triggerType?: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function parseSchedule(scheduleStr: string): ScheduleConfig {
  try {
    return JSON.parse(scheduleStr);
  } catch {
    return {};
  }
}

function parseScheduleTime(value?: string): { hour: number; minute: number } | null {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  if (hour < 0 || hour > 23) return null;
  return { hour, minute };
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  const weekday = WEEKDAY_INDEX[(parts.weekday || "sun").slice(0, 3).toLowerCase()] ?? 0;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday,
  };
}

function shiftLocalDate(parts: Pick<ZonedParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function shiftLocalMonth(parts: Pick<ZonedParts, "year" | "month">, months: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: 1,
  };
}

function zonedDateTimeToUtc(
  parts: Pick<ZonedParts, "year" | "month" | "day">,
  time: { hour: number; minute: number },
  timeZone: string
): Date {
  const targetAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, time.hour, time.minute, 0);
  const guess = new Date(targetAsUtc);
  const zonedGuess = getZonedParts(guess, timeZone);
  const zonedGuessAsUtc = Date.UTC(
    zonedGuess.year,
    zonedGuess.month - 1,
    zonedGuess.day,
    zonedGuess.hour,
    zonedGuess.minute,
    0
  );
  return new Date(guess.getTime() - (zonedGuessAsUtc - targetAsUtc));
}

function getLastScheduledOccurrence(
  schedule: ScheduleConfig,
  now: Date,
  timeZone: string
): Date | null {
  const frequency = schedule.frequency?.toUpperCase();
  const scheduledTime = parseScheduleTime(schedule.time);
  if (!frequency || !scheduledTime) return null;

  let current: ZonedParts;
  try {
    current = getZonedParts(now, timeZone);
  } catch {
    current = getZonedParts(now, "UTC");
    timeZone = "UTC";
  }

  const nowLocalMinutes = current.hour * 60 + current.minute;
  const scheduledMinutes = scheduledTime.hour * 60 + scheduledTime.minute;
  let occurrenceDate: Pick<ZonedParts, "year" | "month" | "day">;

  if (frequency === "DAILY") {
    occurrenceDate = { year: current.year, month: current.month, day: current.day };
    if (nowLocalMinutes < scheduledMinutes) {
      occurrenceDate = shiftLocalDate(occurrenceDate, -1);
    }
  } else if (frequency === "WEEKLY") {
    const rawTargetDay = typeof schedule.dayOfWeek === "number" ? schedule.dayOfWeek : current.weekday;
    const targetDay = ((rawTargetDay % 7) + 7) % 7;
    let daysSince = (current.weekday - targetDay + 7) % 7;
    occurrenceDate = shiftLocalDate(current, -daysSince);
    if (daysSince === 0 && nowLocalMinutes < scheduledMinutes) {
      occurrenceDate = shiftLocalDate(occurrenceDate, -7);
    }
  } else if (frequency === "MONTHLY") {
    occurrenceDate = { year: current.year, month: current.month, day: 1 };
    if (current.day === 1 && nowLocalMinutes < scheduledMinutes) {
      occurrenceDate = shiftLocalMonth(current, -1);
    }
  } else {
    return null;
  }

  return zonedDateTimeToUtc(occurrenceDate, scheduledTime, timeZone);
}

/**
 * Check if an automation is due to run based on its schedule and last trigger time.
 */
function getDueOccurrence(
  schedule: ScheduleConfig,
  lastTriggered: Date | null,
  now: Date,
  startDate: Date,
  timeZone: string
): Date | null {
  const frequency = schedule.frequency?.toUpperCase();
  if (frequency === "ONCE" || schedule.triggerType === "one_time") {
    if (lastTriggered || startDate > now) return null;
    return startDate;
  }

  const occurrence = getLastScheduledOccurrence(schedule, now, timeZone || "UTC");
  if (!occurrence || occurrence > now || occurrence < startDate) return null;
  if (lastTriggered && lastTriggered >= occurrence) return null;
  return occurrence;
}

// POST /api/content/automation/scheduler
// Called by external cron service (every 15 minutes). Protected by CRON_SECRET.
async function runScheduler(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
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
        user: { select: { id: true, aiCredits: true, timezone: true } },
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
      const isOneTime = schedule.frequency?.toUpperCase() === "ONCE" || schedule.triggerType === "one_time";
      const timeZone = automation.user.timezone || "UTC";

      const dueOccurrence = getDueOccurrence(schedule, automation.lastTriggered, now, automation.startDate, timeZone);
      if (!dueOccurrence) {
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

      const claim = await prisma.postAutomation.updateMany({
        where: {
          id: automation.id,
          enabled: true,
          OR: [
            { lastTriggered: null },
            { lastTriggered: { lt: dueOccurrence } },
          ],
        },
        data: { lastTriggered: now },
      });

      if (claim.count === 0) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          status: "skipped",
          reason: "Already claimed for this scheduled occurrence",
        });
        continue;
      }

      try {
        let platforms: string[] = [];
        try {
          platforms = JSON.parse(automation.platforms || "[]");
        } catch {
          platforms = ["feed"];
        }

        let brandKit = await prisma.brandKit.findFirst({
          where: { userId: automation.userId, isDefault: true },
        });
        if (!brandKit) {
          brandKit = await prisma.brandKit.findFirst({ where: { userId: automation.userId } });
        }
        const linkedTask = automation.strategyTaskId
          ? await prisma.strategyTask.findFirst({
              where: {
                id: automation.strategyTaskId,
                strategy: { userId: automation.userId },
              },
              select: {
                title: true,
                description: true,
                category: true,
                startDate: true,
                dueDate: true,
              },
            })
          : null;

        if (shouldPublishAsBlogAutomation(platforms, linkedTask)) {
          const blogResult = await runBlogAutomationPublication({
            automation,
            brandKit,
            linkedTask,
          });

          await prisma.$transaction([
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
                referenceId: blogResult.blogPostId,
                description: `Published website blog automation: ${automation.name}`,
              },
            }),
            prisma.postAutomation.update({
              where: { id: automation.id },
              data: {
                enabled: isOneTime ? false : undefined,
                endDate: isOneTime ? now : undefined,
                totalGenerated: { increment: 1 },
                totalCreditsSpent: { increment: creditCost },
              },
            }),
          ]);

          triggerActivitySyncForUser(automation.userId).catch((err) =>
            console.error("Activity sync failed for blog automation:", err)
          );

          results.push({
            automationId: automation.id,
            name: automation.name,
            status: "triggered",
          });
          continue;
        }

        const generatedAsset = await generateAutomationAsset({
          topic: automation.topic,
          aiPrompt: automation.aiPrompt,
          aiTone: automation.aiTone,
          platforms,
          includeMedia: automation.includeMedia,
          mediaType: automation.mediaType,
          mediaStyle: automation.mediaStyle,
          brand: brandKit,
          task: linkedTask,
        });
        const generatedContent = generatedAsset.caption;

        if (!generatedContent?.trim()) {
          results.push({
            automationId: automation.id,
            name: automation.name,
            status: "failed",
            reason: "AI generated empty content",
          });
          continue;
        }

        const hashtags = generatedAsset.hashtags.length ? generatedAsset.hashtags : generatedContent.match(/#[\w]+/g) || [];
        const mentions = generatedAsset.mentions.length ? generatedAsset.mentions : generatedContent.match(/@[\w]+/g) || [];

        // Generate media if enabled
        let mediaUrl: string | null = null;
        let mediaMeta: string | null = null;
        let postMediaType: string | null = null;

        if (automation.includeMedia && automation.mediaType) {
          try {
            const captionExcerpt = generatedContent.replace(/#[\w]+/g, "").trim().substring(0, 200);
            const mediaPrompt =
              generatedAsset.mediaPrompt ||
              `Create a social media visual for: ${captionExcerpt}${automation.mediaStyle ? `. Style: ${automation.mediaStyle}` : ""}. Do not fabricate logos or real-person faces. Do not draw a visible logo placeholder, blank logo box, white reserved rectangle, dashed frame, label, or logo-space indicator. Let the layout and background remain natural.`;

            if (automation.mediaType === "image") {
              // Generate via the shared FlowCreative engine (full brand layout,
              // real logo composite, correct current year), then re-key into the
              // automation namespace so Post.mediaUrl keeps its S3-key storage
              // contract (downstream presigns the key on read).
              const design = await generateBrandedImage({
                userId: automation.userId,
                prompt: captionExcerpt || mediaPrompt,
                orientation: "landscape",
                tier: "standard",
                skipCredits: true,
              });
              if (design.ok && design.imageUrl) {
                const res = await fetch(await getPresignedUrl(design.imageUrl));
                const imageBuffer = Buffer.from(await res.arrayBuffer());
                const s3Key = `automation/${automation.id}/${Date.now()}.png`;
                await uploadToS3(s3Key, imageBuffer, "image/png");
                mediaUrl = s3Key;
                mediaMeta = JSON.stringify([s3Key]);
                postMediaType = "image";
              }
            } else if (automation.mediaType === "video") {
              // Central video router: role-based provider ladder + black-frame
              // guard (a dead/black clip is rejected and falls through).
              let videoBuffer: Buffer | null = null;
              try {
                const v = await generateVideoForRole("video_standard", {
                  prompt: mediaPrompt,
                  durationSeconds: 8,
                  aspectRatio: "16:9",
                  resolution: "720p",
                });
                videoBuffer = v.videoBuffer;
              } catch (videoError) {
                console.warn(`[Scheduler] Video generation failed for ${automation.id}:`, videoError);
              }

              if (videoBuffer) {
                const s3Key = `automation/${automation.id}/${Date.now()}.mp4`;
                await uploadToS3(s3Key, videoBuffer, "video/mp4");
                mediaUrl = s3Key;
                mediaMeta = JSON.stringify([s3Key]);
                postMediaType = "video";
              }
            }
          } catch (mediaError) {
            console.warn(`[Scheduler] Media generation failed for ${automation.id}:`, mediaError);
          }
        }

        const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);

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
              enabled: isOneTime ? false : undefined,
              endDate: isOneTime ? now : undefined,
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

    // Also process new ContentAutomation rows (campaigns layer).
    let campaignResult = {
      checked: 0,
      emitted: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };
    try {
      campaignResult = await processDueContentAutomations();
      console.log(
        `[Scheduler] ContentAutomation: checked ${campaignResult.checked}, emitted ${campaignResult.emitted}, skipped ${campaignResult.skipped}, failed ${campaignResult.failed}`
      );
    } catch (campaignErr) {
      console.error("[Scheduler] ContentAutomation processor error:", campaignErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        checked: automations.length,
        triggered,
        failed,
        skipped,
        results,
        contentAutomation: campaignResult,
      },
    });
  } catch (error) {
    console.error("Automation scheduler error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Scheduler failed" } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return runScheduler(request);
}

export async function POST(request: NextRequest) {
  return runScheduler(request);
}
