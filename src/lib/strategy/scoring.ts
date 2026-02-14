/**
 * Strategy Scoring Engine
 * Calculates a 0-100 composite score based on how well a user follows their marketing plan.
 */

import { prisma } from "@/lib/db/client";
import {
  createNotification,
  NOTIFICATION_TYPES,
} from "@/lib/notifications";
import { sendMilestoneEmail } from "@/lib/email";

// ── Types ──

export interface ScoreTaskInput {
  id: string;
  status: string; // "TODO" | "IN_PROGRESS" | "DONE"
  category: string | null;
  priority: string;
  dueDate: Date | string | null;
  completedAt: Date | string | null;
  sortOrder: number;
  createdAt: Date | string;
  progress: number;
  autoCompleted: boolean;
}

export interface ScorePostInput {
  id: string;
  caption: string | null;
  hashtags: string; // JSON string "[]"
  publishedAt: Date | string | null;
  createdAt: Date | string;
}

export interface ScoreInput {
  tasks: ScoreTaskInput[];
  posts: ScorePostInput[];
  periodStart: Date;
  periodEnd: Date;
}

export interface ScoreBreakdown {
  overall: number;
  factors: {
    completion: number;
    onTime: number;
    consistency: number;
    adherence: number;
    production: number;
  };
  rawData: {
    totalTasks: number;
    completedTasks: number;
    partialTasks: number;
    tasksWithDueDate: number;
    onTimeTasks: number;
    lateTasks: number;
    activeDays: number;
    totalDaysInPeriod: number;
    maxGapDays: number;
    tasksCompletedInOrder: number;
    totalOrderedTasks: number;
    postsCreated: number;
    postsAlignedWithStrategy: number;
    taskCategories: string[];
  };
}

export interface MilestoneCheck {
  key: string;
  title: string;
  description: string;
  icon: string;
}

// ── Weights ──

const WEIGHTS = {
  completion: 0.3,
  onTime: 0.25,
  consistency: 0.2,
  adherence: 0.15,
  production: 0.1,
};

// ── Milestone Definitions ──

const MILESTONE_DEFS: Array<{
  key: string;
  title: string;
  description: string;
  icon: string;
  check: (input: ScoreInput, score: ScoreBreakdown) => boolean;
}> = [
  {
    key: "FIRST_TASK",
    title: "First Task Done!",
    description: "You completed your first strategy task. The journey begins!",
    icon: "Rocket",
    check: (input) =>
      input.tasks.filter((t) => t.status === "DONE").length >= 1,
  },
  {
    key: "25_PERCENT",
    title: "Quarter Way There",
    description: "25% of your strategy tasks are complete. Keep it up!",
    icon: "TrendingUp",
    check: (input) => {
      const total = input.tasks.length;
      const done = input.tasks.filter((t) => t.status === "DONE").length;
      return total > 0 && done / total >= 0.25;
    },
  },
  {
    key: "50_PERCENT",
    title: "Halfway Hero",
    description: "You're halfway through your marketing strategy!",
    icon: "Star",
    check: (input) => {
      const total = input.tasks.length;
      const done = input.tasks.filter((t) => t.status === "DONE").length;
      return total > 0 && done / total >= 0.5;
    },
  },
  {
    key: "75_PERCENT",
    title: "Almost There",
    description: "75% complete! The finish line is in sight.",
    icon: "Flame",
    check: (input) => {
      const total = input.tasks.length;
      const done = input.tasks.filter((t) => t.status === "DONE").length;
      return total > 0 && done / total >= 0.75;
    },
  },
  {
    key: "ALL_DONE",
    title: "Strategy Complete!",
    description:
      "You've completed every task in your marketing strategy. Amazing!",
    icon: "Trophy",
    check: (input) => {
      const total = input.tasks.length;
      const done = input.tasks.filter((t) => t.status === "DONE").length;
      return total > 0 && done === total;
    },
  },
  {
    key: "STREAK_5",
    title: "5-Day Streak",
    description: "You completed tasks 5 days in a row. Consistency pays off!",
    icon: "Zap",
    check: (input) => getMaxConsecutiveDays(input.tasks) >= 5,
  },
  {
    key: "STREAK_10",
    title: "10-Day Streak",
    description: "10 consecutive days of task completions. Unstoppable!",
    icon: "Zap",
    check: (input) => getMaxConsecutiveDays(input.tasks) >= 10,
  },
  {
    key: "PERFECT_WEEK",
    title: "Perfect Week",
    description:
      "7 consecutive days of completing tasks. A perfect week of productivity!",
    icon: "Calendar",
    check: (input) => getMaxConsecutiveDays(input.tasks) >= 7,
  },
  {
    key: "SCORE_80_PLUS",
    title: "High Performer",
    description:
      "Your strategy score reached 80+. You're a marketing powerhouse!",
    icon: "Award",
    check: (_input, score) => score.overall >= 80,
  },
  {
    key: "ON_TIME_CHAMP",
    title: "On-Time Champion",
    description:
      "Every task with a deadline was completed on time. Flawless execution!",
    icon: "Clock",
    check: (input) => {
      const withDue = input.tasks.filter(
        (t) => t.dueDate && t.status === "DONE"
      );
      if (withDue.length === 0) return false;
      return withDue.every((t) => {
        const due = new Date(t.dueDate!);
        const completed = new Date(t.completedAt!);
        return completed <= due;
      });
    },
  },
];

// ── Helper Functions ──

function toDate(d: Date | string | null): Date | null {
  if (!d) return null;
  return d instanceof Date ? d : new Date(d);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

function getCompletionDays(tasks: ScoreTaskInput[]): string[] {
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.status === "DONE" && t.completedAt) {
      days.add(dayKey(new Date(t.completedAt)));
    }
  }
  return Array.from(days).sort();
}

function getMaxConsecutiveDays(tasks: ScoreTaskInput[]): number {
  const days = getCompletionDays(tasks);
  if (days.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diff = daysBetween(prev, curr);
    if (diff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}

/**
 * Longest Increasing Subsequence length — measures how well the
 * completion order matches the planned sortOrder.
 */
function longestIncreasingSubsequence(arr: number[]): number {
  if (arr.length === 0) return 0;
  const tails: number[] = [];
  for (const val of arr) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (tails[mid] < val) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = val;
  }
  return tails.length;
}

// Category keyword map for matching posts to strategy categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  content: [
    "content",
    "blog",
    "article",
    "write",
    "post",
    "copy",
    "storytelling",
  ],
  social: [
    "social",
    "instagram",
    "facebook",
    "twitter",
    "tiktok",
    "linkedin",
    "community",
    "engage",
  ],
  ads: [
    "ad",
    "campaign",
    "promote",
    "boost",
    "sponsor",
    "paid",
    "advertising",
  ],
  email: ["email", "newsletter", "subscriber", "drip", "mailchimp", "inbox"],
  analytics: [
    "analytics",
    "metrics",
    "report",
    "track",
    "measure",
    "insight",
    "data",
  ],
};

function isPostAligned(
  post: ScorePostInput,
  categories: string[]
): boolean {
  const text = [
    post.caption || "",
    (() => {
      try {
        return JSON.parse(post.hashtags).join(" ");
      } catch {
        return "";
      }
    })(),
  ]
    .join(" ")
    .toLowerCase();

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat] || [];
    if (keywords.some((kw) => text.includes(kw))) return true;
  }
  return false;
}

// ── Main Scoring Function ──

export function calculateStrategyScore(input: ScoreInput): ScoreBreakdown {
  const { tasks, posts, periodStart, periodEnd } = input;
  const totalDaysInPeriod = Math.max(1, daysBetween(periodStart, periodEnd));

  // -- Completion Factor (30%) — partial credit for IN_PROGRESS tasks --
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "DONE").length;
  const partialTasks = tasks.filter(
    (t) => t.status === "IN_PROGRESS" && t.progress > 0 && t.progress < 100
  ).length;
  const completionPoints = tasks.reduce((sum, t) => {
    if (t.status === "DONE") return sum + 100;
    if (t.status === "IN_PROGRESS" && t.progress > 0) return sum + t.progress;
    return sum;
  }, 0);
  const maxPoints = totalTasks * 100;
  const completion =
    maxPoints > 0 ? Math.round((completionPoints / maxPoints) * 100) : 0;

  // -- On-Time Factor (25%) --
  const tasksWithDueDate = tasks.filter(
    (t) => t.dueDate && t.status === "DONE"
  );
  let onTimeTasks = 0;
  let lateTasks = 0;
  for (const t of tasksWithDueDate) {
    const due = toDate(t.dueDate)!;
    const completed = toDate(t.completedAt);
    if (completed && completed <= due) {
      onTimeTasks++;
    } else {
      lateTasks++;
    }
  }
  const onTime =
    tasksWithDueDate.length > 0
      ? Math.round((onTimeTasks / tasksWithDueDate.length) * 100)
      : 75; // neutral default when no tasks have due dates

  // -- Consistency Factor (20%) --
  const completionDays = getCompletionDays(tasks);
  const activeDays = completionDays.length;
  let maxGapDays = 0;

  if (completionDays.length >= 2) {
    for (let i = 1; i < completionDays.length; i++) {
      const gap = daysBetween(
        new Date(completionDays[i - 1]),
        new Date(completionDays[i])
      );
      maxGapDays = Math.max(maxGapDays, gap);
    }
  } else if (completionDays.length === 1) {
    maxGapDays = totalDaysInPeriod;
  } else {
    maxGapDays = totalDaysInPeriod;
  }

  const idealGap =
    completedTasks > 1 ? totalDaysInPeriod / (completedTasks - 1) : totalDaysInPeriod;
  const consistencyRatio =
    maxGapDays > 0 ? Math.min(1, idealGap / maxGapDays) : 1;
  const consistency =
    completedTasks > 0 ? Math.round(consistencyRatio * 100) : 0;

  // -- Adherence Factor (15%) --
  // Compare completion order (by completedAt) vs planned order (sortOrder)
  const completedByDate = tasks
    .filter((t) => t.status === "DONE" && t.completedAt)
    .sort(
      (a, b) =>
        new Date(a.completedAt!).getTime() -
        new Date(b.completedAt!).getTime()
    );
  const sortOrders = completedByDate.map((t) => t.sortOrder);
  const lisLength = longestIncreasingSubsequence(sortOrders);
  const adherence =
    completedByDate.length > 0
      ? Math.round((lisLength / completedByDate.length) * 100)
      : 50; // neutral default

  // -- Production Factor (10%) --
  const taskCategories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean) as string[]),
  ];
  const periodPosts = posts.filter((p) => {
    const pub = toDate(p.publishedAt) || toDate(p.createdAt);
    return pub && pub >= periodStart && pub <= periodEnd;
  });
  const alignedPosts = periodPosts.filter((p) =>
    isPostAligned(p, taskCategories)
  );
  const production =
    taskCategories.length > 0
      ? Math.min(
          100,
          Math.round((alignedPosts.length / taskCategories.length) * 100)
        )
      : periodPosts.length > 0
        ? 50
        : 0;

  // -- Composite --
  const overall = Math.round(
    completion * WEIGHTS.completion +
      onTime * WEIGHTS.onTime +
      consistency * WEIGHTS.consistency +
      adherence * WEIGHTS.adherence +
      production * WEIGHTS.production
  );

  return {
    overall: Math.min(100, Math.max(0, overall)),
    factors: {
      completion,
      onTime,
      consistency,
      adherence,
      production,
    },
    rawData: {
      totalTasks,
      completedTasks,
      partialTasks,
      tasksWithDueDate: tasksWithDueDate.length,
      onTimeTasks,
      lateTasks,
      activeDays,
      totalDaysInPeriod,
      maxGapDays,
      tasksCompletedInOrder: lisLength,
      totalOrderedTasks: completedByDate.length,
      postsCreated: periodPosts.length,
      postsAlignedWithStrategy: alignedPosts.length,
      taskCategories,
    },
  };
}

// ── Milestone Checker (Pure) ──

export function checkMilestones(
  input: ScoreInput,
  score: ScoreBreakdown,
  existingKeys: string[]
): MilestoneCheck[] {
  const newMilestones: MilestoneCheck[] = [];

  for (const def of MILESTONE_DEFS) {
    if (existingKeys.includes(def.key)) continue;
    if (def.check(input, score)) {
      newMilestones.push({
        key: def.key,
        title: def.title,
        description: def.description,
        icon: def.icon,
      });
    }
  }

  return newMilestones;
}

// ── Real-Time Milestone Award (DB + Notifications) ──

export async function checkAndAwardMilestones(
  strategyId: string,
  userId: string
) {
  // Fetch strategy + tasks
  const strategy = await prisma.marketingStrategy.findUnique({
    where: { id: strategyId },
    include: { tasks: true },
  });
  if (!strategy) return;

  // Fetch user for email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, notificationPrefs: true },
  });
  if (!user) return;

  // Fetch existing milestones for this strategy
  const existing = await prisma.strategyMilestone.findMany({
    where: { userId, strategyId },
    select: { milestoneKey: true },
  });
  const existingKeys = existing.map((m) => m.milestoneKey);

  // Fetch posts for production scoring (current month)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const posts = await prisma.post.findMany({
    where: {
      userId,
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
  const newMilestones = checkMilestones(input, score, existingKeys);

  // Check email preference
  let sendEmail = false;
  try {
    const prefs = user.notificationPrefs
      ? JSON.parse(user.notificationPrefs as string)
      : {};
    sendEmail = prefs?.email?.strategy !== false;
  } catch {
    sendEmail = true;
  }

  // Award each new milestone
  for (const milestone of newMilestones) {
    await prisma.strategyMilestone.create({
      data: {
        userId,
        strategyId,
        milestoneKey: milestone.key,
        title: milestone.title,
        description: milestone.description,
        icon: milestone.icon,
      },
    });

    // In-app notification
    await createNotification({
      userId,
      type: NOTIFICATION_TYPES.STRATEGY_MILESTONE,
      title: `Milestone: ${milestone.title}`,
      message: milestone.description,
      data: {
        milestoneKey: milestone.key,
        strategyName: strategy.name,
      },
      actionUrl: "/content/strategy/reports",
    });

    // Email
    if (sendEmail) {
      await sendMilestoneEmail({
        to: user.email,
        name: user.name || "there",
        milestoneTitle: milestone.title,
        milestoneDescription: milestone.description,
        strategyName: strategy.name,
      }).catch((err: Error) =>
        console.error("Failed to send milestone email:", err)
      );
    }
  }

  return newMilestones;
}
