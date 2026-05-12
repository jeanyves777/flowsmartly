/**
 * Strategy Automation Credit Estimator
 *
 * Calculates the total credit cost for automating strategy tasks.
 * Uses the existing getDynamicCreditCost() for actual pricing.
 */

import { getDynamicCreditCost } from "@/lib/credits/costs";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import {
  qualifyStrategyTaskForAutomation,
} from "@/lib/strategy/automation-readiness";

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
  type: string;
  requirements: string[];
  blockers: string[];
  warnings: string[];
  runs: number;
  costPerRun: number;
  totalCost: number;
}

export interface AutomationTaskCreditConfig {
  taskId: string;
  frequency?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  includeMedia?: boolean;
  mediaType?: "image" | "video";
  endDate?: string;
  startDate?: string;
  platforms?: string[];
}

export interface AutomationEstimate {
  automatableTasks: TaskEstimate[];
  manualOnlyTasks: { taskId: string; title: string; category: string }[];
  costPerPost: number;
  costPerPostWithVideo: number;
  totalPosts: number;
  projectedRuns: number;
  requiredCredits: number;
  projectedCredits: number;
  totalCredits: number;
  userCredits: number;
  hasEnoughCredits: boolean;
}

/**
 * Check if a task category is automatable
 */
export function isAutomatableCategory(category: string | null): boolean {
  const normalized = normalizeTaskCategory(category);
  return normalized === "content" || normalized === "social" || normalized === "email";
}

/**
 * Check if a task category is email (creates Campaign instead of PostAutomation)
 */
export function isEmailCategory(category: string | null): boolean {
  return normalizeTaskCategory(category) === "email";
}

/**
 * Calculate runs between two dates for a given frequency
 */
function calculateRuns(
  frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY",
  startDate: string | Date,
  endDate: string | Date
): number {
  if (frequency === "ONCE") return 1;

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
    frequency: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
    includeMedia: boolean;
    mediaType: "image" | "video";
    endDate: string;
    userCredits: number;
    selectedTaskIds?: string[];
    selectedPlatforms?: string[];
    connectedPlatforms?: string[];
    emailReady?: boolean;
    smsReady?: boolean;
    blogReady?: boolean;
    taskConfigs?: AutomationTaskCreditConfig[];
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
  const selectedTaskIds = options.selectedTaskIds?.length
    ? new Set(options.selectedTaskIds)
    : null;
  const taskConfigMap = new Map(
    (options.taskConfigs || []).map((config) => [config.taskId, config])
  );

  for (const task of tasks) {
    if (selectedTaskIds && !selectedTaskIds.has(task.id)) continue;

    const taskConfig = taskConfigMap.get(task.id);
    const includeMedia = taskConfig?.includeMedia ?? options.includeMedia;
    const mediaType = taskConfig?.mediaType ?? options.mediaType;
    const selectedPlatforms = taskConfig?.platforms ?? options.selectedPlatforms;
    const category = normalizeTaskCategory(task.category);
    const readiness = qualifyStrategyTaskForAutomation(task, {
      includeMedia,
      mediaType,
      selectedPlatforms,
      connectedPlatforms: options.connectedPlatforms,
      emailReady: options.emailReady,
      smsReady: options.smsReady,
      blogReady: options.blogReady,
    });

    if (!readiness.qualified) {
      manualOnlyTasks.push({ taskId: task.id, title: task.title, category });
      continue;
    }

    // Skip already-completed tasks
    if (task.status === "DONE") {
      manualOnlyTasks.push({ taskId: task.id, title: task.title, category });
      continue;
    }

    const startDate = (taskConfig?.startDate || task.startDate)
      ? new Date(taskConfig?.startDate || task.startDate || new Date())
      : new Date();
    const endDate = new Date(taskConfig?.endDate || options.endDate);
    const frequency = taskConfig?.frequency || options.frequency;

    const runs = calculateRuns(frequency, startDate, endDate);
    const chargesMedia = includeMedia && readiness.type !== "email" && readiness.type !== "sms";
    const perRunCost =
      chargesMedia && mediaType === "video"
        ? costPerPostWithVideo
        : textCost + (chargesMedia ? imageCost : 0);

    automatableTasks.push({
      taskId: task.id,
      title: task.title,
      category,
      automatable: true,
      type: readiness.type,
      requirements: readiness.requirements,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      runs,
      costPerRun: perRunCost,
      totalCost: runs * perRunCost,
    });
  }

  const totalPosts = automatableTasks.reduce((sum, t) => sum + t.runs, 0);
  const projectedCredits = automatableTasks.reduce((sum, t) => sum + t.totalCost, 0);
  const requiredCredits = automatableTasks.reduce((sum, t) => sum + t.costPerRun, 0);

  return {
    automatableTasks,
    manualOnlyTasks,
    costPerPost,
    costPerPostWithVideo,
    totalPosts,
    projectedRuns: totalPosts,
    requiredCredits,
    projectedCredits,
    totalCredits: projectedCredits,
    userCredits: options.userCredits,
    hasEnoughCredits: options.userCredits >= requiredCredits,
  };
}
