import { prisma } from "@/lib/db/client";
import { publishToSocialPlatforms } from "@/lib/social/publisher";
import { triggerActivitySyncForUser } from "@/lib/strategy/activity-matcher";

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
        const failedPlatforms = Object.entries(publishResults).filter(([, platformResult]) => !platformResult.success);
        if (failedPlatforms.length > 0) {
          result.externalFailed += 1;
          for (const [platform, platformResult] of failedPlatforms) {
            result.errors.push({
              postId: post.id,
              message: `${platform}: ${platformResult.error || "External publishing failed"}`,
            });
          }
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
