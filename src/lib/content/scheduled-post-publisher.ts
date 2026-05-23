import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";
import { notifyPostPublishResult } from "@/lib/notifications";

export interface ScheduledPostPublishResult {
  checked: number;
  publishedCount: number;
  externalAttempted: number;
  externalFailed: number;
  staleSkipped: number;
  skippedCount: number;
  errors: Array<{ postId: string; message: string }>;
}

function parsePlatforms(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((platform) => typeof platform === "string") : ["feed"];
  } catch {
    return ["feed"];
  }
}

export async function publishDueScheduledPosts(now = new Date(), limit = 100): Promise<ScheduledPostPublishResult> {
  const catchUpFloor = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const staleSkipped = await prisma.post.count({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lt: catchUpFloor },
      deletedAt: null,
    },
  });

  const duePosts = await prisma.post.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gte: catchUpFloor, lte: now },
      deletedAt: null,
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      platforms: true,
      caption: true,
      contentAutomationId: true,
      user: { select: { email: true, name: true } },
    },
  });

  const result: ScheduledPostPublishResult = {
    checked: duePosts.length,
    publishedCount: 0,
    externalAttempted: 0,
    externalFailed: 0,
    staleSkipped,
    skippedCount: 0,
    errors: [],
  };

  for (const post of duePosts) {
    const updated = await prisma.post.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
      },
    });

    if (updated.count === 0) {
      result.skippedCount += 1;
      continue;
    }

    result.publishedCount += 1;

    const platforms = parsePlatforms(post.platforms);
    const hasExternal = platforms.some((platform) => platform !== "feed");

    if (hasExternal) {
      result.externalAttempted += 1;
      try {
        const publishResults = await publishToSocialPlatforms(post.id, post.userId);
        // Reshape into the array form notifyPostPublishResult wants and
        // skip the internal "_error" / "feed" keys.
        const perPlatform = Object.entries(publishResults)
          .filter(([k]) => k !== "_error" && k !== "feed")
          .map(([platform, r]) => ({
            platform,
            success: !!r.success,
            error: r.success ? undefined : (r.error || "Publish failed"),
          }));
        const failedPlatforms = perPlatform.filter((r) => !r.success);
        if (failedPlatforms.length > 0) {
          result.externalFailed += 1;
          for (const f of failedPlatforms) {
            result.errors.push({
              postId: post.id,
              message: `${f.platform}: ${f.error || "External publishing failed"}`,
            });
          }
        }

        // In-app notification + email on any failure. Look up campaign
        // name when the post came from an automation so the user sees
        // context. Fire-and-forget — never let notification failures
        // block the publish loop.
        if (perPlatform.length > 0) {
          let campaignName: string | null = null;
          if (post.contentAutomationId) {
            const auto = await prisma.contentAutomation.findUnique({
              where: { id: post.contentAutomationId },
              select: { campaign: { select: { name: true } } },
            });
            campaignName = auto?.campaign?.name ?? null;
          }
          notifyPostPublishResult({
            userId: post.userId,
            email: post.user?.email ?? null,
            name: post.user?.name ?? null,
            postId: post.id,
            caption: post.caption,
            results: perPlatform,
            campaignName,
          }).catch((notifyErr) => {
            console.error(`[ScheduledPosts] notify failed for ${post.id}:`, notifyErr);
          });
        }
      } catch (error) {
        result.externalFailed += 1;
        result.errors.push({
          postId: post.id,
          message: error instanceof Error ? error.message : "External publishing failed",
        });
      }
    }

    triggerActivitySyncForUser(post.userId).catch((error) => {
      console.error(`[ScheduledPosts] Activity sync failed for ${post.id}:`, error);
    });
  }

  console.log(
    `[ScheduledPosts] Checked ${result.checked}: ${result.publishedCount} published, ${result.externalAttempted} external, ${result.externalFailed} external failures, ${result.staleSkipped} stale skipped`
  );

  return result;
}
