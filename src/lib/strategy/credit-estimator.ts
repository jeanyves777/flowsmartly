/**
 * Strategy Automation Credit Estimator
 *
 * Calculates the total credit cost for automating strategy tasks.
 * Uses the existing getDynamicCreditCost() for actual pricing.
 */

import { getDynamicCreditCost } from "@/lib/credits/costs";

/** Categories that can be automated via post generation */
const AUTOMATABLE_CATEGORIES = ["social", "content", "email"];

interface StrategyTaskInput {
  id: string;
  title: string;
  category: string | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  status: string;
}

interface TaskEstimate {
  taskId: string;
  title: string;
  category: string;
  automatable: boolean;
  runs: number;
  costPerRun: number;
  totalCost: number;
}

export interface AutomationEstimate {
  automatableTasks: TaskEstimate[];
  manualOnlyTasks: { taskId: string; title: string; category: string }[];
  costPerPost: number;
  costPerPostWithVideo: number;
  totalPosts: number;
  totalCredits: number;
  userCredits: number;
  hasEnoughCredits: boolean;
}

/**
 * Check if a task category is automatable
 */
export function isAutomatableCategory(category: string | null): boolean {
  return AUTOMATABLE_CATEGORIES.includes(category || "");
}

/**
 * Calculate runs between two dates for a given frequency
 */
function calculateRuns(
  frequency: "DAILY" | "WEEKLY" | "MONTHLY",
  startDate: string | Date,
  endDate: string | Date
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) return 1;

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (frequency === "DAILY") return diffDays + 1;
  if (frequency === "WEEKLY") return Math.floor(diffDays / 7) + 1;
  if (frequency === "MONTHLY") {
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return months + 1;
  }
  return 1;
}

/**
 * Estimate total credit cost for automating a strategy
 */
export async function estimateAutomationCredits(
  tasks: StrategyTaskInput[],
  options: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY";
    includeMedia: boolean;
    mediaType: "image" | "video";
    endDate: string;
    userCredits: number;
  }
): Promise<AutomationEstimate> {
  // Get dynamic costs
  const [textCost, imageCost, videoCost] = await Promise.all([
    getDynamicCreditCost("AI_POST"),
    getDynamicCreditCost("AI_VISUAL_DESIGN"),
    getDynamicCreditCost("AI_VIDEO_STUDIO"),
  ]);

  const costPerPost =
    textCost + (options.includeMedia && options.mediaType === "image" ? imageCost : 0);
  const costPerPostWithVideo = textCost + videoCost;

  const automatableTasks: TaskEstimate[] = [];
  const manualOnlyTasks: { taskId: string; title: string; category: string }[] = [];

  for (const task of tasks) {
    const category = task.category || "content";

    if (!isAutomatableCategory(category)) {
      manualOnlyTasks.push({ taskId: task.id, title: task.title, category });
      continue;
    }

    // Skip already-completed tasks
    if (task.status === "DONE") {
      manualOnlyTasks.push({ taskId: task.id, title: task.title, category });
      continue;
    }

    const startDate = task.startDate
      ? new Date(task.startDate)
      : new Date();
    const endDate = new Date(options.endDate);

    const runs = calculateRuns(options.frequency, startDate, endDate);
    const perRunCost =
      options.mediaType === "video" ? costPerPostWithVideo : costPerPost;

    automatableTasks.push({
      taskId: task.id,
      title: task.title,
      category,
      automatable: true,
      runs,
      costPerRun: perRunCost,
      totalCost: runs * perRunCost,
    });
  }

  const totalPosts = automatableTasks.reduce((sum, t) => sum + t.runs, 0);
  const totalCredits = automatableTasks.reduce((sum, t) => sum + t.totalCost, 0);

  return {
    automatableTasks,
    manualOnlyTasks,
    costPerPost,
    costPerPostWithVideo,
    totalPosts,
    totalCredits,
    userCredits: options.userCredits,
    hasEnoughCredits: options.userCredits >= totalCredits,
  };
}
