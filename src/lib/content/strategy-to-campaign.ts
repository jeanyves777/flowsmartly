import type { Prisma } from "@prisma/client";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import { qualifyStrategyTaskForAutomation } from "@/lib/strategy/automation-readiness";

export interface ImportTaskOverride {
  taskId: string;
  enabled?: boolean;
  triggerType?: "RECURRING" | "CALENDAR_EVENT" | "ONE_OFF" | "AI_GENERATED";
  frequency?: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
  dayOfWeek?: number;
  time?: string;
  platforms?: string[];
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  customPrompt?: string;
  includeMedia?: boolean;
  mediaType?: "image" | "video";
  mediaStyle?: string;
  aiTone?: string;
}

export interface StrategyTaskShape {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
}

const DEFAULT_PLATFORMS = ["instagram", "facebook"] as const;

function combineDateAndTime(dateValue: Date | string | null | undefined, timeValue: string) {
  const date = dateValue ? new Date(dateValue) : new Date();
  const [h, m] = (timeValue || "09:00").split(":");
  date.setHours(parseInt(h || "9", 10), parseInt(m || "0", 10), 0, 0);
  return date;
}

function safePlatforms(input: string[] | undefined, fallback: readonly string[]) {
  if (!input || !input.length) return [...fallback];
  return [...new Set(input.filter((p) => typeof p === "string" && p.length))];
}

/**
 * Map a StrategyTask + optional override config to ContentAutomation create payload.
 * Returns null when the task is not qualified for content automation (email/manual/etc.).
 */
export function mapStrategyTaskToContentAutomation(params: {
  task: StrategyTaskShape;
  userId: string;
  campaignId: string;
  override?: ImportTaskOverride;
  defaultTone?: string;
  defaultPlatforms?: string[];
  globalEndDate?: string | Date | null;
}): Prisma.ContentAutomationUncheckedCreateInput | null {
  const { task, userId, campaignId, override, defaultTone, defaultPlatforms, globalEndDate } = params;
  const cfg = override ?? { taskId: task.id };

  const readiness = qualifyStrategyTaskForAutomation({
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    category: task.category ?? undefined,
  });

  // Only import tasks suitable for SOCIAL content automation in v1.
  if (!readiness.qualified) return null;
  if (readiness.type === "email" || readiness.type === "sms" || readiness.type === "manual") return null;

  const category = normalizeTaskCategory(task.category);
  const frequency = cfg.frequency ?? "WEEKLY";
  const isOneTime = frequency === "ONCE" || cfg.triggerType === "ONE_OFF";
  const triggerType = cfg.triggerType ?? (isOneTime ? "ONE_OFF" : "RECURRING");
  const time = cfg.time ?? "09:00";
  const platforms = safePlatforms(cfg.platforms ?? defaultPlatforms, DEFAULT_PLATFORMS);

  const triggerConfig = JSON.stringify({
    frequency,
    dayOfWeek: cfg.dayOfWeek ?? 1,
    time,
    firstRunDate: cfg.startDate
      ? new Date(cfg.startDate).toISOString()
      : task.startDate?.toISOString() ?? null,
  });

  const promptParts = [
    `Topic: ${task.title}`,
    task.description ? `Context: ${task.description}` : null,
    `Category: ${category}`,
    cfg.customPrompt ? `User direction: ${cfg.customPrompt}` : null,
  ].filter(Boolean);

  const includeMedia = cfg.includeMedia ?? true;
  const mediaType = (cfg.mediaType ?? "image") as "image" | "video";

  return {
    userId,
    campaignId,
    channel: "SOCIAL",
    name: task.title.slice(0, 120),
    description: task.description ?? null,
    triggerType,
    triggerConfig,
    topic: task.title,
    aiPrompt: promptParts.join("\n"),
    aiTone: cfg.aiTone ?? defaultTone ?? null,
    platforms: JSON.stringify(platforms),
    mediaMode: includeMedia ? "AI_AT_POST_TIME" : "NONE",
    aiMediaConfig: includeMedia
      ? JSON.stringify({ type: mediaType, style: cfg.mediaStyle ?? "natural" })
      : null,
    reviewStatus: "PENDING_REVIEW",
    enabled: cfg.enabled ?? true,
    status: "DRAFT",
    startDate: combineDateAndTime(cfg.startDate ?? task.startDate, time),
    endDate: isOneTime
      ? null
      : cfg.endDate
      ? new Date(cfg.endDate)
      : globalEndDate
      ? new Date(globalEndDate)
      : null,
    sourceStrategyTaskId: task.id,
  };
}
