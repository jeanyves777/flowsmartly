/**
 * Activity Matcher — Automatically matches user activities (posts, campaigns,
 * automations) to strategy tasks and updates progress/completion.
 */

import { prisma } from "@/lib/db/client";
import { checkAndAwardMilestones } from "@/lib/strategy/scoring";

// ── Types ──

type ActivityType = "post" | "campaign" | "automation" | "postAutomation" | "adCampaign";
type Confidence = "low" | "medium" | "high";

interface MatchedActivity {
  activityType: ActivityType;
  activityId: string;
  activityName: string;
  activityUrl: string;
  matchedAt: string;
  confidence: Confidence;
  matchReason: string;
}

interface TaskUpdate {
  taskId: string;
  newStatus: string;
  newProgress: number;
  autoCompleted: boolean;
  activities: MatchedActivity[];
}

export interface SyncResult {
  userId: string;
  strategyId: string;
  tasksUpdated: number;
  tasksAutoCompleted: number;
}

// Fetched activity data
interface FetchedActivities {
  posts: Array<{
    id: string;
    caption: string | null;
    hashtags: string;
    platforms: string;
    publishedAt: Date | null;
    createdAt: Date;
    isPromoted: boolean;
  }>;
  campaigns: Array<{
    id: string;
    type: string;
    name: string;
    subject: string | null;
    content: string;
    status: string;
    sentAt: Date | null;
  }>;
  automations: Array<{
    id: string;
    name: string;
    type: string;
    campaignType: string;
    enabled: boolean;
    totalSent: number;
    lastTriggered: Date | null;
  }>;
  postAutomations: Array<{
    id: string;
    name: string;
    type: string;
    enabled: boolean;
    totalGenerated: number;
    lastTriggered: Date | null;
    topic: string | null;
  }>;
  adCampaigns: Array<{
    id: string;
    name: string;
    objective: string;
    status: string;
    startDate: Date;
  }>;
  hasStrategyScores: boolean;
}

// ── Stop words for keyword extraction ──

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "is", "are", "was", "were", "be", "been", "do", "does", "did",
  "will", "would", "could", "should", "can", "may", "might", "shall", "has",
  "have", "had", "not", "no", "your", "our", "my", "his", "her", "its", "their",
  "this", "that", "these", "those", "what", "which", "who", "whom", "how", "when",
  "where", "why", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "than", "too", "very", "just", "about", "from", "into", "through",
  "during", "before", "after", "above", "below", "between", "out", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "any", "own",
  "same", "also", "only", "new", "one", "two", "three", "first", "last", "use",
  "using", "used", "create", "set", "up", "make", "get", "put", "run",
]);

// Social platforms that distinguish "social" from "content"
const SOCIAL_PLATFORMS = ["instagram", "facebook", "twitter", "tiktok", "linkedin", "threads"];

// ── Keyword Extraction ──

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

function getActivityText(activity: { name?: string; caption?: string | null; subject?: string | null; content?: string; hashtags?: string; topic?: string | null; objective?: string }): string {
  const parts: string[] = [];
  if (activity.name) parts.push(activity.name);
  if (activity.caption) parts.push(activity.caption);
  if (activity.subject) parts.push(activity.subject);
  if (activity.content) parts.push(activity.content);
  if (activity.topic) parts.push(activity.topic);
  if (activity.objective) parts.push(activity.objective);
  if (activity.hashtags) {
    try {
      const tags = JSON.parse(activity.hashtags);
      if (Array.isArray(tags)) parts.push(tags.join(" "));
    } catch { /* ignore */ }
  }
  return parts.join(" ").toLowerCase();
}

function getPostPlatforms(platformsJson: string): string[] {
  try {
    const platforms = JSON.parse(platformsJson);
    return Array.isArray(platforms) ? platforms.map((p: string) => p.toLowerCase()) : [];
  } catch {
    return [];
  }
}

function isInTimeRange(activityDate: Date | null, taskStart: Date | null, taskEnd: Date | null): boolean {
  if (!activityDate) return false;
  const t = activityDate.getTime();
  if (taskStart && t < taskStart.getTime()) return false;
  if (taskEnd && t > taskEnd.getTime()) return false;
  return true;
}

function calculateKeywordOverlap(taskKeywords: string[], activityText: string): number {
  if (taskKeywords.length === 0) return 0;
  const matched = taskKeywords.filter((kw) => activityText.includes(kw));
  return matched.length / taskKeywords.length;
}

// ── Fetch Activities ──

async function fetchActivities(
  userId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<FetchedActivities> {
  const [posts, campaigns, automations, postAutomations, adCampaigns, scoreCount] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          userId,
          deletedAt: null,
          status: "PUBLISHED",
          OR: [
            { publishedAt: { gte: periodStart, lte: periodEnd } },
            { createdAt: { gte: periodStart, lte: periodEnd } },
          ],
        },
        select: {
          id: true,
          caption: true,
          hashtags: true,
          platforms: true,
          publishedAt: true,
          createdAt: true,
          isPromoted: true,
        },
      }),
      prisma.campaign.findMany({
        where: {
          userId,
          status: "SENT",
          sentAt: { gte: periodStart, lte: periodEnd },
        },
        select: {
          id: true,
          type: true,
          name: true,
          subject: true,
          content: true,
          status: true,
          sentAt: true,
        },
      }),
      prisma.automation.findMany({
        where: {
          userId,
          enabled: true,
          lastTriggered: { gte: periodStart },
        },
        select: {
          id: true,
          name: true,
          type: true,
          campaignType: true,
          enabled: true,
          totalSent: true,
          lastTriggered: true,
        },
      }),
      prisma.postAutomation.findMany({
        where: {
          userId,
          totalGenerated: { gt: 0 },
          lastTriggered: { gte: periodStart },
        },
        select: {
          id: true,
          name: true,
          type: true,
          enabled: true,
          totalGenerated: true,
          lastTriggered: true,
          topic: true,
        },
      }),
      prisma.adCampaign.findMany({
        where: {
          userId,
          status: { in: ["ACTIVE", "COMPLETED", "PAUSED"] },
          startDate: { lte: periodEnd },
        },
        select: {
          id: true,
          name: true,
          objective: true,
          status: true,
          startDate: true,
        },
      }),
      prisma.strategyScore.count({ where: { userId } }),
    ]);

  return {
    posts,
    campaigns,
    automations,
    postAutomations,
    adCampaigns,
    hasStrategyScores: scoreCount > 0,
  };
}

// ── Match a single task against activities ──

interface TaskForMatching {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  progress: number;
  matchedActivities: string;
}

function matchTaskToActivities(
  task: TaskForMatching,
  activities: FetchedActivities
): TaskUpdate | null {
  const category = task.category?.toLowerCase();
  if (!category) return null;

  // Parse existing matched IDs to avoid duplicates
  let existingMatches: MatchedActivity[] = [];
  try {
    existingMatches = JSON.parse(task.matchedActivities || "[]");
  } catch { /* ignore */ }
  const existingIds = new Set(existingMatches.map((m) => m.activityId));

  // Extract keywords from task
  const taskText = [task.title, task.description || ""].join(" ");
  const taskKeywords = extractKeywords(taskText);

  // Collect all new matches
  const newMatches: MatchedActivity[] = [];
  let bestConfidence: Confidence = "low";
  let bestProgress = 0;

  // Get candidate activities by category
  type CandidateActivity = {
    id: string;
    type: ActivityType;
    name: string;
    url: string;
    text: string;
    date: Date | null;
    reason: string;
  };

  const candidates: CandidateActivity[] = [];

  if (category === "email") {
    for (const c of activities.campaigns) {
      if (c.type.toUpperCase() === "EMAIL" && !existingIds.has(c.id)) {
        candidates.push({
          id: c.id,
          type: "campaign",
          name: c.name,
          url: `/email-marketing/${c.id}`,
          text: getActivityText(c),
          date: c.sentAt,
          reason: `Email campaign "${c.name}" sent`,
        });
      }
    }
    for (const a of activities.automations) {
      if (a.campaignType.toUpperCase() === "EMAIL" && a.totalSent > 0 && !existingIds.has(a.id)) {
        candidates.push({
          id: a.id,
          type: "automation",
          name: a.name,
          url: `/email-marketing/automations/${a.id}`,
          text: getActivityText(a),
          date: a.lastTriggered,
          reason: `Email automation "${a.name}" triggered (${a.totalSent} sent)`,
        });
      }
    }
  } else if (category === "social") {
    for (const p of activities.posts) {
      if (existingIds.has(p.id)) continue;
      const platforms = getPostPlatforms(p.platforms);
      if (platforms.some((pl) => SOCIAL_PLATFORMS.includes(pl))) {
        const postTitle = p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "..." : "") : "Untitled post";
        candidates.push({
          id: p.id,
          type: "post",
          name: postTitle,
          url: `/content/posts`,
          text: getActivityText({ caption: p.caption, hashtags: p.hashtags }),
          date: p.publishedAt || p.createdAt,
          reason: `Post published to ${platforms.filter((pl) => SOCIAL_PLATFORMS.includes(pl)).join(", ")}`,
        });
      }
    }
    for (const pa of activities.postAutomations) {
      if (!existingIds.has(pa.id)) {
        candidates.push({
          id: pa.id,
          type: "postAutomation",
          name: pa.name,
          url: `/content/automation`,
          text: getActivityText(pa),
          date: pa.lastTriggered,
          reason: `Post automation "${pa.name}" generated ${pa.totalGenerated} posts`,
        });
      }
    }
  } else if (category === "content") {
    for (const p of activities.posts) {
      if (!existingIds.has(p.id)) {
        const postTitle = p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "..." : "") : "Untitled post";
        candidates.push({
          id: p.id,
          type: "post",
          name: postTitle,
          url: `/content/posts`,
          text: getActivityText({ caption: p.caption, hashtags: p.hashtags }),
          date: p.publishedAt || p.createdAt,
          reason: "Post published",
        });
      }
    }
    for (const pa of activities.postAutomations) {
      if (!existingIds.has(pa.id)) {
        candidates.push({
          id: pa.id,
          type: "postAutomation",
          name: pa.name,
          url: `/content/automation`,
          text: getActivityText(pa),
          date: pa.lastTriggered,
          reason: `Post automation "${pa.name}" generated ${pa.totalGenerated} posts`,
        });
      }
    }
  } else if (category === "ads") {
    for (const p of activities.posts) {
      if (p.isPromoted && !existingIds.has(p.id)) {
        const postTitle = p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "..." : "") : "Promoted post";
        candidates.push({
          id: p.id,
          type: "post",
          name: postTitle,
          url: `/content/posts`,
          text: getActivityText({ caption: p.caption, hashtags: p.hashtags }),
          date: p.publishedAt || p.createdAt,
          reason: "Promoted post published",
        });
      }
    }
    for (const ac of activities.adCampaigns) {
      if (!existingIds.has(ac.id)) {
        candidates.push({
          id: ac.id,
          type: "adCampaign",
          name: ac.name,
          url: `/ads`,
          text: getActivityText(ac),
          date: ac.startDate,
          reason: `Ad campaign "${ac.name}" (${ac.status})`,
        });
      }
    }
  } else if (category === "analytics") {
    // Analytics: give partial credit if user has strategy scores
    if (activities.hasStrategyScores && task.progress < 50) {
      return {
        taskId: task.id,
        newStatus: "IN_PROGRESS",
        newProgress: Math.max(task.progress, 50),
        autoCompleted: false,
        activities: [
          {
            activityType: "post",
            activityId: "analytics-heuristic",
            activityName: "Strategy Reports",
            activityUrl: "/content/strategy/reports",
            matchedAt: new Date().toISOString(),
            confidence: "medium",
            matchReason: "User has viewed strategy reports",
          },
        ],
      };
    }
    return null;
  }

  if (candidates.length === 0) return null;

  // Score each candidate
  for (const candidate of candidates) {
    const keywordOverlap = calculateKeywordOverlap(taskKeywords, candidate.text);
    const inTimeRange = isInTimeRange(candidate.date, task.startDate, task.dueDate);

    let confidence: Confidence;
    let progress: number;

    if (keywordOverlap >= 0.3 && inTimeRange) {
      confidence = "high";
      progress = 100;
    } else if (keywordOverlap >= 0.3) {
      confidence = "medium";
      progress = 50;
    } else {
      // Category match only
      confidence = "low";
      progress = 25;
    }

    // Track best
    if (progress > bestProgress) {
      bestProgress = progress;
      bestConfidence = confidence;
    }

    newMatches.push({
      activityType: candidate.type,
      activityId: candidate.id,
      activityName: candidate.name,
      activityUrl: candidate.url,
      matchedAt: new Date().toISOString(),
      confidence,
      matchReason: candidate.reason,
    });
  }

  if (newMatches.length === 0) return null;

  // Never decrease progress
  const finalProgress = Math.max(task.progress, bestProgress);
  const shouldComplete = finalProgress >= 100;

  return {
    taskId: task.id,
    newStatus: shouldComplete ? "DONE" : "IN_PROGRESS",
    newProgress: finalProgress,
    autoCompleted: shouldComplete,
    activities: newMatches,
  };
}

// ── Main Sync Function ──

export async function syncActivitiesForStrategy(
  strategyId: string,
  userId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    userId,
    strategyId,
    tasksUpdated: 0,
    tasksAutoCompleted: 0,
  };

  // Load strategy + tasks
  const strategy = await prisma.marketingStrategy.findUnique({
    where: { id: strategyId },
    include: {
      tasks: {
        where: {
          OR: [
            { status: "TODO" },
            { status: "IN_PROGRESS", autoCompleted: false },
          ],
        },
      },
    },
  });

  if (!strategy || strategy.tasks.length === 0) {
    // Still update lastActivitySync
    await prisma.marketingStrategy.update({
      where: { id: strategyId },
      data: { lastActivitySync: new Date() },
    });
    return result;
  }

  // Determine time window: strategy creation → now
  const periodStart = strategy.createdAt;
  const periodEnd = new Date();

  // Fetch all activities in bulk
  const activities = await fetchActivities(userId, periodStart, periodEnd);

  // Match each task
  const updates: TaskUpdate[] = [];
  for (const task of strategy.tasks) {
    const update = matchTaskToActivities(task, activities);
    if (update) {
      updates.push(update);
    }
  }

  if (updates.length === 0) {
    await prisma.marketingStrategy.update({
      where: { id: strategyId },
      data: { lastActivitySync: new Date() },
    });
    return result;
  }

  // Apply all updates in a transaction
  const txOps = [];

  for (const update of updates) {
    // Merge new activities with existing ones
    const existingTask = strategy.tasks.find((t) => t.id === update.taskId);
    let allActivities: MatchedActivity[] = [];
    try {
      allActivities = JSON.parse(existingTask?.matchedActivities || "[]");
    } catch { /* ignore */ }
    allActivities.push(...update.activities);

    const data: Record<string, unknown> = {
      progress: update.newProgress,
      matchedActivities: JSON.stringify(allActivities),
    };

    // Only update status if it's advancing (TODO→IN_PROGRESS or IN_PROGRESS→DONE)
    if (update.newStatus === "DONE" && existingTask?.status !== "DONE") {
      data.status = "DONE";
      data.completedAt = new Date();
      data.autoCompleted = true;
      result.tasksAutoCompleted++;
    } else if (update.newStatus === "IN_PROGRESS" && existingTask?.status === "TODO") {
      data.status = "IN_PROGRESS";
    }

    txOps.push(
      prisma.strategyTask.update({
        where: { id: update.taskId },
        data,
      })
    );
    result.tasksUpdated++;
  }

  // Update completed count and lastActivitySync
  await prisma.$transaction(txOps);

  // Recount completed tasks
  const completedCount = await prisma.strategyTask.count({
    where: { strategyId, status: "DONE" },
  });

  await prisma.marketingStrategy.update({
    where: { id: strategyId },
    data: {
      completedTasks: completedCount,
      lastActivitySync: new Date(),
    },
  });

  // Fire-and-forget: check milestones if any tasks were completed
  if (result.tasksAutoCompleted > 0) {
    checkAndAwardMilestones(strategyId, userId).catch((err) =>
      console.error("Milestone check after activity sync failed:", err)
    );
  }

  return result;
}

// ── Trigger sync for all user's active strategies ──

export async function triggerActivitySyncForUser(userId: string): Promise<void> {
  const strategies = await prisma.marketingStrategy.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true },
  });

  for (const strategy of strategies) {
    await syncActivitiesForStrategy(strategy.id, userId);
  }
}
