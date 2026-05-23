/**
 * Activity Matcher — Automatically matches user activities (posts, campaigns,
 * automations) to strategy tasks and updates progress/completion.
 */

import { prisma } from "@/lib/db/client";
import { checkAndAwardMilestones } from "@/lib/strategy/scoring";

// ── Types ──

type ActivityType =
  | "post"
  | "campaign"
  | "automation"
  | "postAutomation"
  | "contentAutomation"
  | "adCampaign";
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
    status: string;
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
    strategyTaskId: string | null;
  }>;
  contentAutomations: Array<{
    id: string;
    name: string;
    triggerType: string;
    enabled: boolean;
    reviewStatus: string;
    status: string;
    totalGenerated: number;
    lastTriggered: Date | null;
    topic: string | null;
    sourceStrategyTaskId: string | null;
    campaignId: string;
    campaignName: string;
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
const SOCIAL_PLATFORMS = ["instagram", "facebook", "twitter", "tiktok", "linkedin", "youtube", "pinterest", "threads"];

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
  const [posts, campaigns, automations, postAutomations, contentAutomationsRaw, adCampaigns, scoreCount] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          userId,
          deletedAt: null,
          status: { in: ["PUBLISHED", "SCHEDULED"] },
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
          status: true,
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
          strategyTaskId: true,
        },
      }),
      // ContentAutomation rows count as planning work — even before they
      // fire, an APPROVED row in an ACTIVE campaign represents a piece of
      // content the user committed to. Include any row created in or
      // touched during the period.
      prisma.contentAutomation.findMany({
        where: {
          userId,
          OR: [
            { createdAt: { gte: periodStart, lte: periodEnd } },
            { lastTriggered: { gte: periodStart, lte: periodEnd } },
            { updatedAt: { gte: periodStart, lte: periodEnd } },
          ],
        },
        select: {
          id: true,
          name: true,
          triggerType: true,
          enabled: true,
          reviewStatus: true,
          status: true,
          totalGenerated: true,
          lastTriggered: true,
          topic: true,
          sourceStrategyTaskId: true,
          campaignId: true,
          campaign: { select: { name: true } },
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

  const contentAutomations = contentAutomationsRaw.map((c) => ({
    id: c.id,
    name: c.name,
    triggerType: c.triggerType,
    enabled: c.enabled,
    reviewStatus: c.reviewStatus,
    status: c.status,
    totalGenerated: c.totalGenerated,
    lastTriggered: c.lastTriggered,
    topic: c.topic,
    sourceStrategyTaskId: c.sourceStrategyTaskId,
    campaignId: c.campaignId,
    campaignName: c.campaign?.name ?? "Campaign",
  }));

  return {
    posts,
    campaigns,
    automations,
    postAutomations,
    contentAutomations,
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

  // Direct-link matching: a NEW ContentAutomation row created from this
  // task (via the import-strategy flow) is a guaranteed match — the user
  // explicitly turned this task into a content automation. APPROVED rows
  // count even before they've fired since the work is committed.
  const directLinkedContent = activities.contentAutomations.find(
    (ca) =>
      ca.sourceStrategyTaskId === task.id &&
      (ca.reviewStatus === "APPROVED" || ca.totalGenerated > 0),
  );
  if (directLinkedContent) {
    let existingContentMatches: MatchedActivity[] = [];
    try { existingContentMatches = JSON.parse(task.matchedActivities || "[]"); } catch { /* ignore */ }
    const alreadyMatched = existingContentMatches.some((m) => m.activityId === directLinkedContent.id);
    if (!alreadyMatched) {
      return {
        taskId: task.id,
        newStatus: directLinkedContent.totalGenerated > 0 ? "DONE" : "IN_PROGRESS",
        newProgress: directLinkedContent.totalGenerated > 0 ? 100 : Math.max(task.progress, 75),
        autoCompleted: directLinkedContent.totalGenerated > 0,
        activities: [
          {
            activityType: "contentAutomation",
            activityId: directLinkedContent.id,
            activityName: `${directLinkedContent.campaignName} — ${directLinkedContent.name}`,
            activityUrl: `/content/campaigns/${directLinkedContent.campaignId}/items/${directLinkedContent.id}`,
            matchedAt: new Date().toISOString(),
            confidence: "high",
            matchReason:
              directLinkedContent.totalGenerated > 0
                ? `Content automation generated ${directLinkedContent.totalGenerated} posts from this task`
                : `Content automation armed and scheduled from this task`,
          },
        ],
      };
    }
    if (alreadyMatched && directLinkedContent.totalGenerated > 0 && task.progress < 100) {
      return {
        taskId: task.id,
        newStatus: "DONE",
        newProgress: 100,
        autoCompleted: true,
        activities: [],
      };
    }
  }

  // Direct-link matching: if a PostAutomation was created FROM this task, guaranteed match
  const directLinked = activities.postAutomations.find(
    (pa) => pa.strategyTaskId === task.id && pa.totalGenerated > 0
  );
  if (directLinked) {
    let existingMatches: MatchedActivity[] = [];
    try { existingMatches = JSON.parse(task.matchedActivities || "[]"); } catch { /* ignore */ }

    const alreadyMatched = existingMatches.some((m) => m.activityId === directLinked.id);
    const alreadyHasGeneratedPost = existingMatches.some(
      (m) =>
        m.activityType === "post" &&
        /automation generated|automation run created|generated feed post/i.test(m.matchReason)
    );
    if ((alreadyMatched || alreadyHasGeneratedPost) && task.progress >= 100) {
      return null;
    }

    const taskKeywords = extractKeywords([task.title, task.description || "", directLinked.topic || ""].join(" "));
    const linkedAt = directLinked.lastTriggered?.getTime() || Date.now();
    const generatedPost = activities.posts
      .map((post) => {
        const platforms = getPostPlatforms(post.platforms);
        const postDate = post.publishedAt || post.createdAt;
        const diff = Math.abs((postDate?.getTime() || linkedAt) - linkedAt);
        const text = getActivityText({ caption: post.caption, hashtags: post.hashtags });
        return {
          post,
          platforms,
          diff,
          overlap: calculateKeywordOverlap(taskKeywords, text),
        };
      })
      .filter((item) => item.platforms.includes("feed") && item.diff <= 60 * 60 * 1000)
      .sort((a, b) => b.overlap - a.overlap || a.diff - b.diff)[0]?.post;

    const generatedPostAlreadyMatched = generatedPost
      ? existingMatches.some((m) => m.activityId === generatedPost.id)
      : false;
    const nextMatch: MatchedActivity | null = generatedPost && !generatedPostAlreadyMatched
      ? {
          activityType: "post",
          activityId: generatedPost.id,
          activityName: generatedPost.caption
            ? `${generatedPost.caption.slice(0, 70)}${generatedPost.caption.length > 70 ? "..." : ""}`
            : directLinked.name,
          activityUrl:
            generatedPost.status === "PUBLISHED"
              ? `/feed#post-${generatedPost.id}`
              : "/content/posts",
          matchedAt: new Date().toISOString(),
          confidence: "high",
          matchReason:
            generatedPost.status === "PUBLISHED"
              ? `Automation generated a FlowSmartly feed post from "${directLinked.name}"`
              : `Automation generated a scheduled FlowSmartly post from "${directLinked.name}"`,
        }
      : !alreadyMatched && !generatedPostAlreadyMatched
      ? {
          activityType: "postAutomation",
          activityId: directLinked.id,
          activityName: directLinked.name,
          activityUrl: "/content/posts",
          matchedAt: new Date().toISOString(),
          confidence: "high",
          matchReason: "Automation generated content; open posts to review the generated item",
        }
      : null;

    return {
      taskId: task.id,
      newStatus: "DONE",
      newProgress: 100,
      autoCompleted: true,
      activities: nextMatch ? [nextMatch] : [],
    };
  }

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
          url: `/feed#post-${p.id}`,
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
          url: `/content/posts`,
          text: getActivityText(pa),
          date: pa.lastTriggered,
          reason: `Post automation "${pa.name}" generated ${pa.totalGenerated} posts`,
        });
      }
    }
    for (const ca of activities.contentAutomations) {
      if (existingIds.has(ca.id)) continue;
      if (ca.reviewStatus !== "APPROVED" && ca.totalGenerated === 0) continue;
      candidates.push({
        id: ca.id,
        type: "contentAutomation",
        name: `${ca.campaignName} — ${ca.name}`,
        url: `/content/campaigns/${ca.campaignId}/items/${ca.id}`,
        text: getActivityText({ caption: ca.topic, hashtags: "[]" }),
        date: ca.lastTriggered ?? null,
        reason:
          ca.totalGenerated > 0
            ? `Content automation generated ${ca.totalGenerated} posts`
            : `Content automation armed in "${ca.campaignName}"`,
      });
    }
  } else if (category === "content") {
    for (const p of activities.posts) {
      if (!existingIds.has(p.id)) {
        const postTitle = p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "..." : "") : "Untitled post";
        candidates.push({
          id: p.id,
          type: "post",
          name: postTitle,
          url: `/feed#post-${p.id}`,
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
          url: `/content/posts`,
          text: getActivityText(pa),
          date: pa.lastTriggered,
          reason: `Post automation "${pa.name}" generated ${pa.totalGenerated} posts`,
        });
      }
    }
    for (const ca of activities.contentAutomations) {
      if (existingIds.has(ca.id)) continue;
      if (ca.reviewStatus !== "APPROVED" && ca.totalGenerated === 0) continue;
      candidates.push({
        id: ca.id,
        type: "contentAutomation",
        name: `${ca.campaignName} — ${ca.name}`,
        url: `/content/campaigns/${ca.campaignId}/items/${ca.id}`,
        text: getActivityText({ caption: ca.topic, hashtags: "[]" }),
        date: ca.lastTriggered ?? null,
        reason:
          ca.totalGenerated > 0
            ? `Content automation generated ${ca.totalGenerated} posts`
            : `Content automation armed in "${ca.campaignName}"`,
      });
    }
  } else if (category === "ads") {
    for (const p of activities.posts) {
      if (p.isPromoted && !existingIds.has(p.id)) {
        const postTitle = p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "..." : "") : "Promoted post";
        candidates.push({
          id: p.id,
          type: "post",
          name: postTitle,
          url: `/feed#post-${p.id}`,
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
