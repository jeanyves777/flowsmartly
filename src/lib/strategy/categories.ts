export const TASK_CATEGORIES = ["content", "social", "ads", "email", "analytics"] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export function normalizeTaskCategory(category: unknown): TaskCategory {
  if (typeof category !== "string") return "content";
  const normalized = category.trim().toLowerCase();
  return TASK_CATEGORIES.includes(normalized as TaskCategory)
    ? (normalized as TaskCategory)
    : "content";
}
