"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  GripVertical,
  Link2,
  Mail,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Rss,
  Sparkles,
  Target,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { useToast } from "@/hooks/use-toast";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";
import {
  isAutomationCandidate,
  qualifyStrategyTaskForAutomation,
} from "@/lib/strategy/automation-readiness";
import { normalizeTaskCategory } from "@/lib/strategy/categories";
import type { TaskCategory } from "@/lib/strategy/categories";
import { cn } from "@/lib/utils/cn";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
type ViewMode = "plan" | "automations" | "sync";
type Timeframe = "1_MONTH" | "3_MONTHS" | "6_MONTHS";
type StrategyBuilderMode = "create" | "improve";

interface MatchedActivity {
  activityType: string;
  activityId: string;
  activityName?: string;
  activityUrl?: string;
  matchedAt: string;
  confidence: "low" | "medium" | "high";
  matchReason: string;
}

interface StrategyTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  autoCompleted: boolean;
  progress?: number;
  matchedActivities?: string | null;
  automationStatus?: string;
  automationId?: string | null;
  aiSuggested?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalTasks: number;
  completedTasks: number;
  aiGenerated: boolean;
  lastActivitySync: string | null;
  tasks: StrategyTask[];
  createdAt: string;
  updatedAt: string;
}

type AutomationType = "RECURRING" | "EVENT_BASED" | "AI_GENERATED";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY";

interface Automation {
  id: string;
  name: string;
  type: AutomationType;
  enabled: boolean;
  schedule: {
    frequency?: Frequency;
    dayOfWeek?: number;
    time?: string;
    triggerType?: string;
  };
  topic: string | null;
  aiPrompt: string | null;
  aiTone: string;
  platforms: string[];
  includeMedia: boolean;
  mediaType: string | null;
  mediaStyle: string | null;
  startDate: string;
  endDate: string | null;
  totalGenerated: number;
  totalCreditsSpent: number;
  lastTriggered: string | null;
  strategyTaskId?: string | null;
  sourceStrategyId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskDraft {
  id?: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
}

interface AutomationDraft {
  id?: string;
  name: string;
  type: AutomationType;
  frequency: Frequency;
  dayOfWeek: number;
  time: string;
  topic: string;
  aiPrompt: string;
  aiTone: string;
  platforms: string[];
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  startDate: string;
  endDate: string;
  strategyTaskId: string;
}

interface StrategyBuilderDraft {
  goalPresetId: string | null;
  goals: string;
  timeframe: Timeframe;
  focusAreas: TaskCategory[];
  platforms: string[];
  additionalContext: string;
  competitorInfo: string;
  budget: string;
}

interface StrategyGoalPreset {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  goalTemplate: string;
  focusAreas: TaskCategory[];
  platforms: string[];
  timeframe: Timeframe;
  additionalContext: string;
  budget?: string;
}

interface AutomationBuilderDraft {
  selectedTaskIds: string[];
  frequency: Frequency;
  dayOfWeek: number;
  time: string;
  aiTone: string;
  platforms: string[];
  includeMedia: boolean;
  mediaType: "image" | "video";
  mediaStyle: string;
  endDate: string;
  customPrompt: string;
}

interface BrandSnapshot {
  name: string;
  logo?: string;
  tagline?: string;
  industry?: string;
  niche?: string;
  targetAudience?: string;
  voiceTone?: string;
  uniqueValue?: string;
  products: string[];
  keywords: string[];
  handles: Record<string, string>;
}

interface ConnectedPlatform {
  platform: string;
  name: string;
  connected: boolean;
  username?: string | null;
  displayName?: string | null;
}

interface MarketingReadiness {
  emailReady: boolean;
  smsReady: boolean;
}

interface AutomationCreditEstimate {
  totalCredits: number;
  requiredCredits?: number;
  projectedCredits?: number;
  userCredits: number;
  hasEnoughCredits: boolean;
  totalPosts: number;
  projectedRuns?: number;
  automatableTasks: Array<{
    taskId: string;
    title: string;
    type?: string;
    requirements?: string[];
    warnings?: string[];
    costPerRun?: number;
    totalCost: number;
    runs: number;
  }>;
  manualOnlyTasks: Array<{ taskId: string; title: string; category: string }>;
}

interface AutomationRunPreview {
  automation: {
    id: string;
    name: string;
    topic: string | null;
    aiPrompt: string | null;
    aiTone: string;
    includeMedia: boolean;
    mediaType: string | null;
    mediaStyle: string | null;
    platforms: string[];
    linkedTask: { id: string; title: string; category: string | null } | null;
  };
  creditCost: number;
  userCredits: number;
  hasEnoughCredits: boolean;
  scheduledAt: string;
  result: string;
}

type StrategyConfirmTarget =
  | { kind: "delete-task"; id: string; name: string }
  | { kind: "delete-automation"; id: string; name: string }
  | { kind: "cancel-automations"; count: number };

interface ReadinessRepairOptions {
  convertToPost: boolean;
  removeMediaRequirement: boolean;
  keepDates: boolean;
}

const STATUS_COLUMNS: Array<{ id: TaskStatus; label: string; tone: string }> = [
  { id: "TODO", label: "To do", tone: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/20" },
  { id: "IN_PROGRESS", label: "In progress", tone: "border-sky-200 bg-sky-50 dark:border-sky-900/70 dark:bg-sky-950/20" },
  { id: "DONE", label: "Done", tone: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/20" },
];

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; icon: LucideIcon; className: string }> = {
  content: { label: "Content", icon: FileText, className: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  social: { label: "Social", icon: Rss, className: "text-sky-600 bg-sky-500/10 border-sky-500/20" },
  ads: { label: "Ads", icon: Rocket, className: "text-orange-600 bg-orange-500/10 border-orange-500/20" },
  email: { label: "Email", icon: Mail, className: "text-violet-600 bg-violet-500/10 border-violet-500/20" },
  analytics: { label: "Analytics", icon: BarChart3, className: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dot: string }> = {
  HIGH: { label: "High", dot: "bg-rose-500" },
  MEDIUM: { label: "Medium", dot: "bg-amber-500" },
  LOW: { label: "Low", dot: "bg-emerald-500" },
};

const STRATEGY_PLATFORM_OPTIONS = [
  "Instagram",
  "Facebook",
  "Twitter/X",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "Blog",
  "Email",
];

const TIMEFRAME_OPTIONS: Array<{ value: Timeframe; label: string }> = [
  { value: "1_MONTH", label: "1 month" },
  { value: "3_MONTHS", label: "3 months" },
  { value: "6_MONTHS", label: "6 months" },
];

const STRATEGY_GOAL_PRESETS: StrategyGoalPreset[] = [
  {
    id: "comprehensive-growth",
    label: "Comprehensive growth",
    description: "Full operating plan across content, social, ads, email, and reporting.",
    icon: Sparkles,
    goalTemplate:
      "Create a comprehensive marketing operating strategy for {brand}. Build a complete system for awareness, trust, lead generation, sales follow-up, recurring content, email nurturing, promotional moments, analytics, and automation-ready execution.",
    focusAreas: ["content", "social", "ads", "email", "analytics"],
    platforms: ["Instagram", "Facebook", "LinkedIn", "Email", "Blog"],
    timeframe: "3_MONTHS",
    additionalContext:
      "Produce a balanced operating plan with executable weekly content, social posts, email campaigns, lightweight ads, performance review checkpoints, and automation-ready tasks. Every task should be ready for the automation hub to turn into a post, email, image, video, or follow-up action.",
  },
  {
    id: "brand-awareness",
    label: "Brand awareness",
    description: "Make the brand visible, trusted, and memorable in the market.",
    icon: Target,
    goalTemplate:
      "Create a brand-awareness strategy for {brand}. Focus on making the brand easier to discover, understand, trust, and remember through consistent educational, proof-based, and community-facing content.",
    focusAreas: ["content", "social", "analytics"],
    platforms: ["Instagram", "Facebook", "LinkedIn", "Blog"],
    timeframe: "3_MONTHS",
    additionalContext:
      "Prioritize audience education, founder or team authority, behind-the-scenes proof, customer outcomes, FAQs, brand story posts, shareable visuals, and measurement checkpoints.",
  },
  {
    id: "lead-generation",
    label: "Lead generation",
    description: "Turn attention into inquiries, bookings, calls, and qualified leads.",
    icon: Rocket,
    goalTemplate:
      "Create a lead-generation strategy for {brand}. Turn interested people into qualified inquiries, booked calls, form submissions, messages, subscribers, and follow-up opportunities.",
    focusAreas: ["content", "social", "ads", "email", "analytics"],
    platforms: ["Facebook", "Instagram", "LinkedIn", "Email"],
    timeframe: "3_MONTHS",
    additionalContext:
      "Include lead magnets, CTA posts, objection-handling content, proof posts, retargeting ideas, email follow-up sequences, and tracking tasks. Tasks must be actionable enough to generate posts and email campaigns.",
  },
  {
    id: "sales-promotion",
    label: "Sales promotion",
    description: "Campaign plan for offers, launches, specials, bundles, and urgency.",
    icon: Zap,
    goalTemplate:
      "Create a sales and promotion strategy for {brand}. Plan campaigns that turn offers, product/service launches, limited-time specials, bundles, and seasonal moments into clear demand.",
    focusAreas: ["content", "social", "ads", "email", "analytics"],
    platforms: ["Instagram", "Facebook", "TikTok", "Email"],
    timeframe: "1_MONTH",
    additionalContext:
      "Include offer announcements, benefit-focused posts, countdowns, customer proof, urgency reminders, email pushes, and post-campaign reporting. Keep tasks practical for direct publishing and scheduling.",
  },
  {
    id: "event-calendar",
    label: "Event calendar",
    description: "Plan posts around holidays, local dates, services, launches, and events.",
    icon: CalendarDays,
    goalTemplate:
      "Create an event-calendar strategy for {brand}. Build a posting and campaign plan around upcoming holidays, observances, local moments, events, launches, services, and seasonal opportunities.",
    focusAreas: ["content", "social", "email", "analytics"],
    platforms: ["Instagram", "Facebook", "Email", "Blog"],
    timeframe: "3_MONTHS",
    additionalContext:
      "Create event-based tasks with due dates, countdown posts, day-of reminders, recap posts, email reminders, and reusable calendar prompts. Every item should include timing, audience, message angle, CTA, and whether media is needed.",
  },
  {
    id: "community-engagement",
    label: "Community engagement",
    description: "Grow participation, loyalty, testimonials, referrals, and conversations.",
    icon: Rss,
    goalTemplate:
      "Create a community-engagement strategy for {brand}. Strengthen participation, loyalty, referrals, testimonials, conversations, and repeat engagement with the people already around the brand.",
    focusAreas: ["content", "social", "email"],
    platforms: ["Instagram", "Facebook", "LinkedIn", "Email"],
    timeframe: "3_MONTHS",
    additionalContext:
      "Include appreciation posts, member/customer spotlights, testimonial prompts, conversation starters, event reminders, referral pushes, recap content, and email touchpoints.",
  },
];

const TONE_OPTIONS = ["professional", "friendly", "confident", "educational", "playful"];

const BRAND_HANDLE_PLATFORM: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const AUTOMATION_PLATFORM_KEYWORDS: Record<string, RegExp> = {
  instagram: /\b(instagram|ig|reel|reels|story|stories)\b/i,
  facebook: /\b(facebook|fb|meta)\b/i,
  twitter: /\b(x\/twitter|twitter|tweet|tweets|x post)\b/i,
  linkedin: /\b(linkedin|b2b|thought leadership)\b/i,
  tiktok: /\b(tiktok|tik tok)\b/i,
  youtube: /\b(youtube|shorts?|video channel)\b/i,
  pinterest: /\b(pinterest|pins?|boards?)\b/i,
  threads: /\b(threads)\b/i,
};

const ACCOUNT_PLATFORM_STYLES: Record<
  string,
  { color: string; soft: string; softer: string; iconBackground?: string }
> = {
  feed: {
    color: "#0EA5E9",
    soft: "rgba(14, 165, 233, 0.14)",
    softer: "rgba(14, 165, 233, 0.06)",
    iconBackground: "linear-gradient(135deg, #0EA5E9, #38BDF8)",
  },
  instagram: {
    color: "#E4405F",
    soft: "rgba(228, 64, 95, 0.13)",
    softer: "rgba(252, 175, 69, 0.08)",
    iconBackground: "linear-gradient(135deg, #833AB4, #E1306C 48%, #FCAF45)",
  },
  twitter: {
    color: "#111827",
    soft: "rgba(17, 24, 39, 0.1)",
    softer: "rgba(17, 24, 39, 0.04)",
    iconBackground: "linear-gradient(135deg, #111827, #475569)",
  },
  linkedin: {
    color: "#0A66C2",
    soft: "rgba(10, 102, 194, 0.12)",
    softer: "rgba(10, 102, 194, 0.05)",
    iconBackground: "linear-gradient(135deg, #0A66C2, #2563EB)",
  },
  facebook: {
    color: "#1877F2",
    soft: "rgba(24, 119, 242, 0.12)",
    softer: "rgba(24, 119, 242, 0.05)",
    iconBackground: "linear-gradient(135deg, #1877F2, #60A5FA)",
  },
  tiktok: {
    color: "#FE2C55",
    soft: "rgba(254, 44, 85, 0.12)",
    softer: "rgba(37, 244, 238, 0.07)",
    iconBackground: "linear-gradient(135deg, #111827 0%, #FE2C55 52%, #25F4EE 100%)",
  },
  youtube: {
    color: "#FF0000",
    soft: "rgba(255, 0, 0, 0.12)",
    softer: "rgba(255, 0, 0, 0.05)",
    iconBackground: "linear-gradient(135deg, #FF0000, #EF4444)",
  },
  pinterest: {
    color: "#E60023",
    soft: "rgba(230, 0, 35, 0.12)",
    softer: "rgba(230, 0, 35, 0.05)",
    iconBackground: "linear-gradient(135deg, #E60023, #F43F5E)",
  },
  threads: {
    color: "#374151",
    soft: "rgba(55, 65, 81, 0.11)",
    softer: "rgba(55, 65, 81, 0.04)",
    iconBackground: "linear-gradient(135deg, #111827, #6B7280)",
  },
  whatsapp: {
    color: "#25D366",
    soft: "rgba(37, 211, 102, 0.12)",
    softer: "rgba(37, 211, 102, 0.05)",
    iconBackground: "linear-gradient(135deg, #25D366, #16A34A)",
  },
};

const getAccountPlatformStyle = (platformId: string) =>
  ACCOUNT_PLATFORM_STYLES[platformId] || ACCOUNT_PLATFORM_STYLES.feed;

const DEFAULT_TASK: TaskDraft = {
  title: "",
  description: "",
  category: "content",
  priority: "MEDIUM",
  status: "TODO",
  startDate: "",
  dueDate: "",
};

const DEFAULT_AUTOMATION: AutomationDraft = {
  name: "",
  type: "AI_GENERATED",
  frequency: "WEEKLY",
  dayOfWeek: 1,
  time: "09:00",
  topic: "",
  aiPrompt: "",
  aiTone: "professional",
  platforms: [],
  includeMedia: false,
  mediaType: "image",
  mediaStyle: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  })(),
  strategyTaskId: "",
};

const DEFAULT_STRATEGY_BUILDER: StrategyBuilderDraft = {
  goalPresetId: null,
  goals: "",
  timeframe: "3_MONTHS",
  focusAreas: ["content", "social", "ads", "email", "analytics"],
  platforms: ["Instagram", "Facebook", "LinkedIn", "Email"],
  additionalContext: "",
  competitorInfo: "",
  budget: "",
};

const DEFAULT_AUTOMATION_BUILDER: AutomationBuilderDraft = {
  selectedTaskIds: [],
  frequency: "WEEKLY",
  dayOfWeek: 1,
  time: "09:00",
  aiTone: "professional",
  platforms: [],
  includeMedia: false,
  mediaType: "image",
  mediaStyle: "",
  endDate: DEFAULT_AUTOMATION.endDate,
  customPrompt: "",
};

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTimeAgo(value?: string | null) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseMatches(raw?: string | null): MatchedActivity[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return toStringArray(parsed);
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

function isTaskAutomatable(task: StrategyTask) {
  return isAutomationCandidate(task);
}

function taskProgress(task: StrategyTask) {
  return Math.min(100, Math.max(0, task.progress ?? 0));
}

function inferTaskPlatformIds(task: StrategyTask) {
  const text = `${task.title || ""} ${task.description || ""}`;
  const explicitPlatforms = Object.entries(AUTOMATION_PLATFORM_KEYWORDS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([platform]) => platform);
  if (explicitPlatforms.length > 0) return [...new Set(explicitPlatforms)];
  return [];
}

function getTaskPlanDate(task: StrategyTask) {
  return (
    task.startDate?.slice(0, 10) ||
    task.dueDate?.slice(0, 10) ||
    new Date().toISOString().slice(0, 10)
  );
}

function formatPlatformList(platforms: string[]) {
  if (platforms.length === 0) return "None";
  return platforms.map((platform) => PLATFORM_META[platform]?.label || platform).join(", ");
}

function completedWorkLabel(match: MatchedActivity) {
  switch (match.activityType) {
    case "post":
      return "Post";
    case "campaign":
      return "Campaign";
    case "automation":
      return "Marketing automation";
    case "postAutomation":
      return "Automation record";
    case "adCampaign":
      return "Ad campaign";
    default:
      return "Completed work";
  }
}

function completedWorkHref(match: MatchedActivity) {
  if (match.activityType === "post") {
    return match.activityUrl?.trim() || `/feed#post-${match.activityId}`;
  }

  switch (match.activityType) {
    case "campaign":
      return `/campaigns/${match.activityId}`;
    case "automation":
      return `/email-marketing/automations/${match.activityId}`;
    case "postAutomation":
      return "/content/posts";
    case "adCampaign":
      return `/ads/create?campaignId=${match.activityId}`;
    default:
      return match.activityUrl?.trim() || "/content/strategy?view=sync";
  }
}

function buildBrandGoal(brand: BrandSnapshot | null) {
  if (!brand) {
    return "Create a complete marketing strategy from my saved brand identity. Prioritize brand awareness, lead generation, content cadence, email follow-up, and automation-ready tasks.";
  }

  const details = [
    brand.industry ? `Industry: ${brand.industry}` : null,
    brand.niche ? `Niche: ${brand.niche}` : null,
    brand.targetAudience ? `Audience: ${brand.targetAudience}` : null,
    brand.uniqueValue ? `Unique value: ${brand.uniqueValue}` : null,
    brand.products.length ? `Offerings: ${brand.products.slice(0, 4).join(", ")}` : null,
    brand.keywords.length ? `Themes: ${brand.keywords.slice(0, 6).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Create a complete marketing strategy for ${brand.name} from the saved brand identity. Create practical content, social, email, ads, analytics, and automation-ready tasks.${details ? `\n\n${details}` : ""}`;
}

function goalPresetText(preset: StrategyGoalPreset, brand: BrandSnapshot | null) {
  const brandName = brand?.name || "this brand";
  return preset.goalTemplate.replace("{brand}", brandName);
}

function mergePresetPlatforms(preset: StrategyGoalPreset, activeBrandPlatforms: string[]) {
  return [
    ...new Set(
      [...preset.platforms, ...activeBrandPlatforms].filter((platform) =>
        STRATEGY_PLATFORM_OPTIONS.includes(platform)
      )
    ),
  ];
}

function getDefaultAutomationEndDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function scheduleLabel(automation: Automation) {
  const time = automation.schedule?.time || "09:00";
  if (automation.type === "EVENT_BASED") return automation.schedule?.triggerType || "Event trigger";
  if (automation.schedule?.frequency === "DAILY") return `Daily at ${time}`;
  if (automation.schedule?.frequency === "MONTHLY") return `Monthly at ${time}`;
  return `Weekly at ${time}`;
}

function taskToDraft(task: StrategyTask): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    category: normalizeTaskCategory(task.category),
    priority: task.priority || "MEDIUM",
    status: task.status || "TODO",
    startDate: task.startDate?.slice(0, 10) || "",
    dueDate: task.dueDate?.slice(0, 10) || "",
  };
}

function automationToDraft(automation: Automation): AutomationDraft {
  return {
    id: automation.id,
    name: automation.name,
    type: automation.type || "AI_GENERATED",
    frequency: automation.schedule?.frequency || "WEEKLY",
    dayOfWeek: automation.schedule?.dayOfWeek ?? 1,
    time: automation.schedule?.time || "09:00",
    topic: automation.topic || "",
    aiPrompt: automation.aiPrompt || "",
    aiTone: automation.aiTone || "professional",
    platforms: automation.platforms?.length ? automation.platforms.filter((platform) => platform !== "feed") : [],
    includeMedia: automation.includeMedia,
    mediaType: automation.mediaType === "video" ? "video" : "image",
    mediaStyle: automation.mediaStyle || "",
    startDate: automation.startDate?.slice(0, 10) || DEFAULT_AUTOMATION.startDate,
    endDate: automation.endDate?.slice(0, 10) || DEFAULT_AUTOMATION.endDate,
    strategyTaskId: automation.strategyTaskId || "",
  };
}

function SortableTaskCardShell({
  task,
  children,
}: {
  task: StrategyTask;
  children: (dragHandle: ReactNode, isDragging: boolean) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={(event) => event.stopPropagation()}
      className="mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg border bg-background text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground active:cursor-grabbing"
      aria-label={`Drag ${task.title}`}
      title="Drag item"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {children(dragHandle, isDragging)}
    </div>
  );
}

function DroppableTaskColumn({
  status,
  className,
  children,
}: {
  status: TaskStatus;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "column", status },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "ring-2 ring-brand-500/30 ring-offset-2 ring-offset-background")}
    >
      {children}
    </div>
  );
}

export default function StrategyAutomationPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>(
    searchParams.get("view") === "automations" ? "automations" : "plan"
  );
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runConfirmAutomation, setRunConfirmAutomation] = useState<Automation | null>(null);
  const [runPreview, setRunPreview] = useState<AutomationRunPreview | null>(null);
  const [loadingRunPreview, setLoadingRunPreview] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<StrategyConfirmTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<"summary" | "task" | "automation">("summary");
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [strategyBuilderOpen, setStrategyBuilderOpen] = useState(false);
  const [strategyBuilderMode, setStrategyBuilderMode] = useState<StrategyBuilderMode>("create");
  const [automationBuilderOpen, setAutomationBuilderOpen] = useState(false);
  const [automationConfigOpen, setAutomationConfigOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(DEFAULT_TASK);
  const [automationDraft, setAutomationDraft] = useState<AutomationDraft>(DEFAULT_AUTOMATION);
  const [strategyBuilder, setStrategyBuilder] = useState<StrategyBuilderDraft>(DEFAULT_STRATEGY_BUILDER);
  const [automationBuilder, setAutomationBuilder] = useState<AutomationBuilderDraft>(DEFAULT_AUTOMATION_BUILDER);
  const [brand, setBrand] = useState<BrandSnapshot | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [connectedPlatforms, setConnectedPlatforms] = useState<ConnectedPlatform[]>([]);
  const [marketingReadiness, setMarketingReadiness] = useState<MarketingReadiness>({
    emailReady: false,
    smsReady: false,
  });
  const [automationEstimate, setAutomationEstimate] = useState<AutomationCreditEstimate | null>(null);
  const [estimatingAutomation, setEstimatingAutomation] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [activeDragTask, setActiveDragTask] = useState<StrategyTask | null>(null);
  const [reorderingTasks, setReorderingTasks] = useState(false);
  const [readinessTargetTaskId, setReadinessTargetTaskId] = useState<string | null>(null);
  const [preparingReadiness, setPreparingReadiness] = useState(false);
  const [readinessOptions, setReadinessOptions] = useState<ReadinessRepairOptions>({
    convertToPost: true,
    removeMediaRequirement: true,
    keepDates: true,
  });
  const [newStrategyName, setNewStrategyName] = useState("90-day content operating plan");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [strategyRes, automationRes, socialRes, marketingRes] = await Promise.all([
        fetch("/api/content/strategy"),
        fetch("/api/content/automation"),
        fetch("/api/social-accounts"),
        fetch("/api/marketing-config"),
      ]);
      const [strategyJson, automationJson, socialJson, marketingJson] = await Promise.all([
        strategyRes.json(),
        automationRes.json(),
        socialRes.json().catch(() => null),
        marketingRes.json().catch(() => null),
      ]);

      if (!strategyRes.ok || !strategyJson.success) {
        throw new Error(strategyJson.error?.message || "Failed to load strategy");
      }
      if (!automationRes.ok || !automationJson.success) {
        throw new Error(automationJson.error?.message || "Failed to load automations");
      }

      setStrategy(strategyJson.data?.strategy || null);
      setAutomations(automationJson.data?.automations || []);
      if (socialRes.ok && socialJson?.success) {
        setConnectedPlatforms(
          (socialJson.data?.platforms || []).filter(
            (platform: ConnectedPlatform) => platform.connected
          )
        );
      }
      if (marketingRes.ok && marketingJson?.success) {
        const config = marketingJson.data?.config;
        setMarketingReadiness({
          emailReady: !!(
            config?.emailProvider &&
            config.emailProvider !== "NONE" &&
            config.emailEnabled &&
            config.emailVerified
          ),
          smsReady: !!(
            config?.smsEnabled &&
            config.smsVerified &&
            config.smsPhoneNumber &&
            config.smsComplianceStatus === "APPROVED"
          ),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBrandLoading(true);
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();
        const b = data.data?.brandKit;
        if (!cancelled && data.success && b) {
          const nextBrand: BrandSnapshot = {
            name: b.name || "Saved brand",
            logo: b.iconLogo || b.logo || undefined,
            tagline: b.tagline || undefined,
            industry: b.industry || undefined,
            niche: b.niche || undefined,
            targetAudience: b.targetAudience || undefined,
            voiceTone: b.voiceTone || undefined,
            uniqueValue: b.uniqueValue || undefined,
            products: toStringArray(b.products),
            keywords: toStringArray(b.keywords),
            handles: typeof b.handles === "object" && b.handles ? b.handles : {},
          };
          setBrand(nextBrand);
          const recommendedPlatforms = Object.entries(nextBrand.handles)
            .filter(([, value]) => value)
            .map(([key]) => BRAND_HANDLE_PLATFORM[key])
            .filter(Boolean);
          if (recommendedPlatforms.length > 0) {
            setStrategyBuilder((draft) => ({
              ...draft,
              platforms: [...new Set([...draft.platforms, ...recommendedPlatforms])],
            }));
          }
        }
      } catch {
        if (!cancelled) setBrand(null);
      } finally {
        if (!cancelled) setBrandLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const nextView = searchParams.get("view");
    if (nextView === "automations") setView("automations");
  }, [searchParams]);

  const tasks = strategy?.tasks || [];
  const strategyTaskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const activeStrategyAutomations = useMemo(
    () =>
      automations.filter(
        (automation) =>
          automation.enabled &&
          (!strategy ||
            automation.sourceStrategyId === strategy.id ||
            (automation.strategyTaskId ? strategyTaskIds.has(automation.strategyTaskId) : false))
      ),
    [automations, strategy, strategyTaskIds]
  );
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) || null
    : null;
  const readinessTargetTask = readinessTargetTaskId
    ? tasks.find((task) => task.id === readinessTargetTaskId) || null
    : null;
  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "DONE").length;
    const inProgress = tasks.filter((task) => task.status === "IN_PROGRESS").length;
    const automated = tasks.filter((task) => task.automationStatus === "AUTOMATED" || task.automationId).length;
    const activeAutomations = automations.filter((automation) => automation.enabled).length;
    const generated = automations.reduce((sum, automation) => sum + automation.totalGenerated, 0);
    const matched = tasks.reduce((sum, task) => sum + parseMatches(task.matchedActivities).length, 0);
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    return { completed, inProgress, automated, activeAutomations, generated, matched, progress };
  }, [tasks, automations]);

  const readyToAutomate = useMemo(
    () =>
      tasks.filter((task) => {
        return (
          task.status !== "DONE" &&
          !task.automationId &&
          task.automationStatus !== "AUTOMATED" &&
          isTaskAutomatable(task)
        );
      }),
    [tasks]
  );
  const automationReviewTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status !== "DONE" &&
          !task.automationId &&
          task.automationStatus !== "AUTOMATED"
      ),
    [tasks]
  );
  const connectedPlatformKeys = useMemo(
    () => connectedPlatforms.map((platform) => platform.platform),
    [connectedPlatforms]
  );
  const automationPlatformOptions = useMemo(() => {
    return connectedPlatforms.map((platform) => ({
      id: platform.platform,
      label: platform.displayName || PLATFORM_META[platform.platform]?.label || platform.name,
      detail: platform.username || platform.name,
    }));
  }, [connectedPlatforms]);
  const getTaskReadiness = useCallback(
    (task: StrategyTask, options: AutomationBuilderDraft | AutomationDraft = automationBuilder) =>
      qualifyStrategyTaskForAutomation(task, {
        includeMedia: options.includeMedia,
        mediaType: options.mediaType,
        selectedPlatforms: options.platforms,
        connectedPlatforms: connectedPlatformKeys,
        emailReady: marketingReadiness.emailReady,
        smsReady: marketingReadiness.smsReady,
        requireDestination: false,
      }),
    [automationBuilder, connectedPlatformKeys, marketingReadiness.emailReady, marketingReadiness.smsReady]
  );
  const getTaskAutomationPlan = useCallback(
    (task: StrategyTask, options: AutomationBuilderDraft = automationBuilder) => {
      const desiredPlatforms = inferTaskPlatformIds(task);
      const missingPlatforms = desiredPlatforms.filter(
        (platform) => platform !== "feed" && !connectedPlatformKeys.includes(platform)
      );
      const connectedDesiredPlatforms = desiredPlatforms.filter(
        (platform) => platform === "feed" || connectedPlatformKeys.includes(platform)
      );
      const safeSelectedPlatforms = options.platforms.filter((platform) =>
        connectedPlatformKeys.includes(platform)
      );
      const category = normalizeTaskCategory(task.category);
      const platforms =
        category === "email"
          ? []
          : [
              ...new Set(
                connectedDesiredPlatforms.length > 0
                  ? connectedDesiredPlatforms
                  : safeSelectedPlatforms.length > 0
                  ? safeSelectedPlatforms
                  : []
              ),
            ];

      return {
        firstRunDate: getTaskPlanDate(task),
        time: options.time || "09:00",
        frequency: options.frequency,
        platforms,
        desiredPlatforms,
        missingPlatforms,
        includeMedia: options.includeMedia,
        mediaType: options.mediaType,
        mediaStyle: options.mediaStyle,
      };
    },
    [automationBuilder, connectedPlatformKeys]
  );
  const getTaskPlanReadiness = useCallback(
    (task: StrategyTask, options: AutomationBuilderDraft = automationBuilder) => {
      const plan = getTaskAutomationPlan(task, options);
      return qualifyStrategyTaskForAutomation(task, {
        includeMedia: plan.includeMedia,
        mediaType: plan.mediaType,
        selectedPlatforms: plan.platforms,
        connectedPlatforms: connectedPlatformKeys,
        emailReady: marketingReadiness.emailReady,
        smsReady: marketingReadiness.smsReady,
        requireDestination: true,
      });
    },
    [automationBuilder, connectedPlatformKeys, getTaskAutomationPlan, marketingReadiness.emailReady, marketingReadiness.smsReady]
  );
  const qualifiedAutomationTasks = useMemo(
    () =>
      readyToAutomate.filter((task) => {
        const plan = getTaskAutomationPlan(task, automationBuilder);
        return plan.missingPlatforms.length === 0 && getTaskPlanReadiness(task, automationBuilder).qualified;
      }),
    [automationBuilder, getTaskAutomationPlan, getTaskPlanReadiness, readyToAutomate]
  );
  const automationReadinessSummary = useMemo(() => {
    const openTasks = tasks.filter((task) => task.status !== "DONE");
    const completed = tasks.length - openTasks.length;
    const alreadyAutomated = openTasks.filter(
      (task) => task.automationId || task.automationStatus === "AUTOMATED"
    ).length;
    const manualOnly = openTasks.filter(
      (task) =>
        !task.automationId &&
        task.automationStatus !== "AUTOMATED" &&
        !isTaskAutomatable(task)
    ).length;
    const missingConnections = openTasks.filter(
      (task) =>
        !task.automationId &&
        task.automationStatus !== "AUTOMATED" &&
        getTaskAutomationPlan(task, automationBuilder).missingPlatforms.length > 0
    ).length;
    const blocked = openTasks
      .filter(
        (task) =>
          !task.automationId &&
          task.automationStatus !== "AUTOMATED" &&
          isTaskAutomatable(task)
      )
      .map((task) => getTaskReadiness(task, automationBuilder))
      .filter((readiness) => !readiness.qualified);
    const blockers = [...new Set(blocked.flatMap((readiness) => readiness.blockers))].slice(0, 4);

    return {
      completed,
      alreadyAutomated,
      manualOnly,
      missingConnections,
      blockedBySetup: blocked.length,
      blockers,
    };
  }, [automationBuilder, getTaskAutomationPlan, getTaskReadiness, tasks]);
  const getAutomationReadinessView = useCallback(
    (task: StrategyTask) => {
      const readiness = getTaskReadiness(task, automationBuilder);
      if (task.status === "DONE") {
        return {
          label: "Completed",
          icon: CheckCircle2,
          className:
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          readiness,
        };
      }
      if (task.automationId || task.automationStatus === "AUTOMATED") {
        return {
          label: "Automated",
          icon: Zap,
          className:
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          readiness,
        };
      }
      if (readiness.qualified) {
        return {
          label: "Automation ready",
          icon: CheckCircle2,
          className:
            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          readiness,
        };
      }
      return {
        label: "Needs readiness",
        icon: Sparkles,
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        readiness,
      };
    },
    [automationBuilder, getTaskReadiness]
  );

  const activeBrandPlatforms = useMemo(() => {
    if (!brand?.handles) return [];
    return Object.entries(brand.handles)
      .filter(([, value]) => value)
      .map(([key]) => BRAND_HANDLE_PLATFORM[key])
      .filter(Boolean);
  }, [brand]);

  const syncLog = useMemo(
    () =>
      tasks
        .flatMap((task) =>
          parseMatches(task.matchedActivities).map((match) => ({ task, match }))
        )
        .sort(
          (a, b) =>
            new Date(b.match.matchedAt).getTime() -
            new Date(a.match.matchedAt).getTime()
        ),
    [tasks]
  );

  const openTask = (task: StrategyTask) => {
    setSelectedTaskId(task.id);
    setSelectedAutomationId(null);
    setInspectorMode("task");
    setTaskDraft(taskToDraft(task));
    setWorkspacePanelOpen(true);
  };

  const openNewTask = (status: TaskStatus = "TODO") => {
    setSelectedAutomationId(null);
    setSelectedTaskId(null);
    setInspectorMode("task");
    setTaskDraft({ ...DEFAULT_TASK, status });
    setWorkspacePanelOpen(true);
  };

  const openAutomation = (automation: Automation) => {
    setSelectedAutomationId(automation.id);
    setSelectedTaskId(null);
    setInspectorMode("automation");
    setAutomationDraft(automationToDraft(automation));
    setWorkspacePanelOpen(true);
  };

  const openNewAutomation = (task?: StrategyTask) => {
    const taskPlan = task ? getTaskAutomationPlan(task, automationBuilder) : null;
    const taskReadiness = task ? getTaskPlanReadiness(task, automationBuilder) : null;
    const oneOffBlocked =
      !!task &&
      (!isTaskAutomatable(task) ||
        !taskReadiness?.qualified ||
        (taskPlan?.missingPlatforms.length || 0) > 0 ||
        taskReadiness.type === "email" ||
        taskReadiness.type === "sms" ||
        taskReadiness.type === "manual");

    if (task && oneOffBlocked) {
      const reason =
        taskReadiness?.type === "email"
          ? "Email items need the email automation planner, not a one-off social post automation."
          : taskReadiness?.type === "sms"
          ? "SMS automation is not available from one-off strategy post automation."
          : taskPlan?.missingPlatforms[0]
          ? `Connect ${PLATFORM_META[taskPlan.missingPlatforms[0]]?.label || taskPlan.missingPlatforms[0]} before automating this item.`
          : taskReadiness?.blockers[0] || "This item is manual/setup work and cannot be automated directly.";
      toast({
        title: "This item cannot be one-off automated",
        description: reason,
        variant: "destructive",
      });
      return;
    }

    setSelectedTaskId(task?.id || null);
    setSelectedAutomationId(null);
    setInspectorMode("automation");
    setAutomationBuilderOpen(false);
    setAutomationConfigOpen(false);
    setAutomationDraft({
      ...DEFAULT_AUTOMATION,
      name: task ? `One-off: ${task.title}` : DEFAULT_AUTOMATION.name,
      topic: task?.title || "",
      aiPrompt: task ? [task.title, task.description].filter(Boolean).join("\n\n") : "",
      platforms: taskPlan?.platforms.length ? taskPlan.platforms : [],
      includeMedia: taskPlan?.includeMedia || false,
      mediaType: taskPlan?.mediaType || "image",
      mediaStyle: taskPlan?.mediaStyle || "",
      startDate: taskPlan?.firstRunDate || DEFAULT_AUTOMATION.startDate,
      endDate: task?.dueDate?.slice(0, 10) || DEFAULT_AUTOMATION.endDate,
      strategyTaskId: task?.id || "",
    });
    setView("automations");
    setWorkspacePanelOpen(true);
  };

  const closeInspector = () => {
    setSelectedTaskId(null);
    setSelectedAutomationId(null);
    setInspectorMode("summary");
    setWorkspacePanelOpen(false);
    setTaskDraft(DEFAULT_TASK);
    setAutomationDraft(DEFAULT_AUTOMATION);
  };

  const openStrategyBuilder = (mode: StrategyBuilderMode = strategy ? "improve" : "create") => {
    const defaultPreset = STRATEGY_GOAL_PRESETS[0];
    setStrategyBuilderMode(mode);
    setStrategyBuilder((draft) => {
      if (mode === "create") {
        return {
          ...DEFAULT_STRATEGY_BUILDER,
          goalPresetId: defaultPreset.id,
          goals: goalPresetText(defaultPreset, brand),
          timeframe: defaultPreset.timeframe,
          focusAreas: defaultPreset.focusAreas,
          platforms: mergePresetPlatforms(defaultPreset, activeBrandPlatforms),
          additionalContext: defaultPreset.additionalContext,
          budget: defaultPreset.budget || "",
        };
      }

      return {
        ...draft,
        goalPresetId: null,
        goals: strategy
          ? `Improve "${strategy.name}" so the open plan items become automation-ready while keeping completed and already automated work intact.`
          : "",
        timeframe: draft.timeframe || DEFAULT_STRATEGY_BUILDER.timeframe,
        focusAreas: draft.focusAreas.length > 0 ? draft.focusAreas : DEFAULT_STRATEGY_BUILDER.focusAreas,
        platforms: draft.platforms.length
          ? draft.platforms
          : activeBrandPlatforms.length
          ? activeBrandPlatforms
          : DEFAULT_STRATEGY_BUILDER.platforms,
        additionalContext: draft.additionalContext,
        budget: draft.budget || "",
      };
    });
    setStrategyBuilderOpen(true);
  };

  const openAutomationBuilder = () => {
    const candidateTasks = automationReviewTasks.filter(isTaskAutomatable);
    const inferredConnectedPlatforms = [
      ...new Set(
        candidateTasks
          .flatMap(inferTaskPlatformIds)
          .filter((platform) => platform === "feed" || connectedPlatformKeys.includes(platform))
      ),
    ];
    const fallbackPlatforms = automationBuilder.platforms.filter((platform) =>
      automationPlatformOptions.some((option) => option.id === platform)
    );
    setAutomationBuilder((draft) => ({
      ...draft,
      selectedTaskIds: candidateTasks.map((task) => task.id),
      platforms:
        inferredConnectedPlatforms.length > 0
          ? [...new Set(inferredConnectedPlatforms)]
          : fallbackPlatforms.length
          ? fallbackPlatforms
          : [],
      endDate: draft.endDate || getDefaultAutomationEndDate(),
    }));
    setAutomationBuilderOpen(true);
    setView("automations");
  };

  const createStrategy = async () => {
    if (!newStrategyName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/content/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStrategyName.trim(),
          description: "Combined strategy and automation workspace",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Failed to create plan");
      setStrategy(json.data.strategy);
      toast({ title: "Plan created" });
    } catch (err) {
      toast({
        title: "Plan was not created",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/content/strategy/sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Sync failed");
      await loadData();
      toast({
        title: "Workspace synced",
        description: `${json.data.tasksUpdated || 0} task${json.data.tasksUpdated === 1 ? "" : "s"} updated`,
      });
    } catch (err) {
      toast({
        title: "Sync failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const applyStrategyGoalPreset = (preset: StrategyGoalPreset) => {
    setStrategyBuilder((draft) => ({
      ...draft,
      goalPresetId: preset.id,
      goals: goalPresetText(preset, brand),
      timeframe: preset.timeframe,
      focusAreas: preset.focusAreas,
      platforms: mergePresetPlatforms(preset, activeBrandPlatforms),
      additionalContext: preset.additionalContext,
      budget: preset.budget || "",
    }));
  };

  const toggleStrategyFocus = (category: TaskCategory) => {
    setStrategyBuilder((draft) => ({
      ...draft,
      goalPresetId: null,
      focusAreas: draft.focusAreas.includes(category)
        ? draft.focusAreas.filter((item) => item !== category)
        : [...draft.focusAreas, category],
    }));
  };

  const toggleStrategyPlatform = (platform: string) => {
    setStrategyBuilder((draft) => ({
      ...draft,
      goalPresetId: null,
      platforms: draft.platforms.includes(platform)
        ? draft.platforms.filter((item) => item !== platform)
        : [...draft.platforms, platform],
    }));
  };

  const toggleAutomationTask = (taskId: string) => {
    setAutomationBuilder((draft) => ({
      ...draft,
      selectedTaskIds: draft.selectedTaskIds.includes(taskId)
        ? draft.selectedTaskIds.filter((id) => id !== taskId)
        : [...draft.selectedTaskIds, taskId],
    }));
  };

  const toggleAutomationPlatform = (platform: string) => {
    setAutomationBuilder((draft) => ({
      ...draft,
      platforms: draft.platforms.includes(platform)
        ? draft.platforms.filter((item) => item !== platform)
        : [...draft.platforms, platform],
    }));
  };

  const createAutomationsForTasks = async (
    sourceStrategy: Strategy,
    candidateTasks: StrategyTask[],
    options: AutomationBuilderDraft,
    successTitle = "Automations launched"
  ) => {
    const selectedCandidates = candidateTasks.filter(
      (task) =>
        options.selectedTaskIds.includes(task.id) &&
        task.status !== "DONE" &&
        !task.automationId &&
        task.automationStatus !== "AUTOMATED" &&
        isTaskAutomatable(task)
    );
    const validationResults = selectedCandidates.map((task) => {
      const plan = getTaskAutomationPlan(task, options);
      return {
        task,
        plan,
        readiness: getTaskPlanReadiness(task, options),
      };
    });
    const selectedTasks = validationResults
      .filter((item) => item.readiness.qualified && item.plan.missingPlatforms.length === 0)
      .map((item) => item.task);
    const blocked = validationResults.filter(
      (item) => !item.readiness.qualified || item.plan.missingPlatforms.length > 0
    );

    if (selectedTasks.length === 0) {
      toast({
        title: "No automation-ready items",
        description:
          blocked[0]?.plan.missingPlatforms.length
            ? `Connect ${formatPlatformList(blocked[0].plan.missingPlatforms)} before automating this item.`
            :
          blocked[0]?.readiness.blockers.join(", ") ||
          "Select plan items that pass channel, media, email, and credit validation.",
        variant: "destructive",
      });
      return false;
    }

    if (options.platforms.length === 0) {
      toast({
        title: "Select at least one channel",
        variant: "destructive",
      });
      return false;
    }

    setSaving(true);
    try {
      const taskConfigs = selectedTasks.map((task) => {
        const plan = getTaskAutomationPlan(task, options);
        return {
          taskId: task.id,
          enabled: true,
          includeMedia: plan.includeMedia,
          mediaType: plan.mediaType,
          mediaStyle: plan.mediaStyle,
          frequency: plan.frequency,
          dayOfWeek: options.dayOfWeek,
          time: plan.time,
          platforms: plan.platforms,
          startDate: plan.firstRunDate,
          endDate: options.endDate,
          customPrompt: [options.customPrompt, task.title, task.description]
            .filter(Boolean)
            .join("\n\n"),
        };
      });

      const estimateRes = await fetch("/api/content/strategy/automate/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: sourceStrategy.id,
          taskIds: selectedTasks.map((task) => task.id),
          taskConfigs,
          frequency: options.frequency,
          includeMedia: options.includeMedia,
          mediaType: options.mediaType,
          endDate: options.endDate,
          platforms: options.platforms,
        }),
      });
      const estimateJson = await estimateRes.json();
      if (!estimateRes.ok || !estimateJson.success) {
        throw new Error(estimateJson.error?.message || "Credit validation failed");
      }
      const estimate = estimateJson.data as AutomationCreditEstimate;
      setAutomationEstimate(estimate);
      const requiredCredits = estimate.requiredCredits ?? estimate.totalCredits;
      const projectedCredits = estimate.projectedCredits ?? estimate.totalCredits;
      const projectedRuns = estimate.projectedRuns ?? estimate.totalPosts;
      if (!estimate.hasEnoughCredits) {
        throw new Error(
          `Not enough credits for the next run. Required: ${requiredCredits}, Available: ${estimate.userCredits}`
        );
      }

      const res = await fetch("/api/content/strategy/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: sourceStrategy.id,
          taskConfigs,
          globalTone: options.aiTone,
          globalEndDate: options.endDate,
          platforms: options.platforms,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automations were not launched");
      await loadData();
      setView("automations");
      setAutomationBuilderOpen(false);
      setAutomationConfigOpen(false);
      toast({
        title: successTitle,
        description: `${json.data.automatedTaskCount || 0} task${json.data.automatedTaskCount === 1 ? "" : "s"} connected. Next run needs ${requiredCredits} credits. Projected ${projectedCredits} credits across ${projectedRuns} scheduled run${projectedRuns === 1 ? "" : "s"}.`,
      });
      return true;
    } catch (err) {
      toast({
        title: "Automations were not launched",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const generateStrategyFromBrand = async (automateAfterGenerate = false) => {
    if (strategyBuilder.focusAreas.length === 0) {
      toast({ title: "Select at least one focus area", variant: "destructive" });
      return;
    }

    const goals = strategyBuilder.goals.trim() || buildBrandGoal(brand);
    setGeneratingStrategy(true);
    try {
      if (strategyBuilderMode === "improve" && strategy) {
        const res = await fetch("/api/content/strategy/improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyId: strategy.id,
            goals,
            timeframe: strategyBuilder.timeframe,
            focusAreas: strategyBuilder.focusAreas,
            platforms: strategyBuilder.platforms.length ? strategyBuilder.platforms : undefined,
            additionalContext: strategyBuilder.additionalContext || undefined,
            competitorInfo: strategyBuilder.competitorInfo || undefined,
            budget: strategyBuilder.budget || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message || "Strategy improvement failed");

        const improvedStrategy = json.data.strategy as Strategy;
        const improvedCandidates = (improvedStrategy.tasks || []).filter(
          (task) =>
            task.status !== "DONE" &&
            !task.automationId &&
            task.automationStatus !== "AUTOMATED" &&
            isTaskAutomatable(task)
        );
        setStrategy(improvedStrategy);
        setStrategyBuilderOpen(false);
        setView("automations");
        setAutomationBuilder((draft) => ({
          ...draft,
          selectedTaskIds: improvedCandidates.map((task) => task.id),
          platforms: draft.platforms.length ? draft.platforms : ["feed"],
          endDate: draft.endDate || getDefaultAutomationEndDate(),
        }));
        setAutomationBuilderOpen(true);
        toast({
          title: "Strategy improved",
          description: `${improvedCandidates.length} open item${improvedCandidates.length === 1 ? "" : "s"} prepared for automation validation. ${json.data.creditsUsed || 0} credits used.`,
        });
        await loadData();
        return;
      }

      const res = await fetch("/api/content/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals,
          timeframe: strategyBuilder.timeframe,
          focusAreas: strategyBuilder.focusAreas,
          platforms: strategyBuilder.platforms.length ? strategyBuilder.platforms : undefined,
          additionalContext: strategyBuilder.additionalContext || undefined,
          competitorInfo: strategyBuilder.competitorInfo || undefined,
          budget: strategyBuilder.budget || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Strategy generation failed");

      const generatedStrategy = json.data.strategy as Strategy;
      setStrategy(generatedStrategy);
      setStrategyBuilderOpen(false);
      toast({
        title: "Strategy generated",
        description: `${generatedStrategy.tasks?.length || 0} plan items created from the saved brand identity.`,
      });

      if (automateAfterGenerate) {
        const generatedTasks = (generatedStrategy.tasks || []).filter(isTaskAutomatable);
        await createAutomationsForTasks(
          generatedStrategy,
          generatedTasks,
          {
            ...automationBuilder,
            selectedTaskIds: generatedTasks.map((task) => task.id),
            endDate: automationBuilder.endDate || getDefaultAutomationEndDate(),
          },
          "Strategy and automations launched"
        );
      } else {
        await loadData();
      }
    } catch (err) {
      toast({
        title: "Strategy was not generated",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setGeneratingStrategy(false);
    }
  };

  const saveTask = async () => {
    if (!strategy || !taskDraft.title.trim()) return;
    setSaving(true);
    try {
      const isEdit = !!taskDraft.id;
      const res = await fetch("/api/content/strategy/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskDraft.id,
          strategyId: strategy.id,
          title: taskDraft.title,
          description: taskDraft.description,
          category: taskDraft.category,
          priority: taskDraft.priority,
          status: taskDraft.status,
          startDate: taskDraft.startDate || null,
          dueDate: taskDraft.dueDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Task was not saved");
      await loadData();
      setSelectedTaskId(json.data.task.id);
      setInspectorMode("task");
      setTaskDraft(taskToDraft(json.data.task));
      toast({ title: isEdit ? "Task updated" : "Task added" });
    } catch (err) {
      toast({
        title: "Task was not saved",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTaskStatus = async (task: StrategyTask, status: TaskStatus) => {
    try {
      const res = await fetch("/api/content/strategy/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Status update failed");
      await loadData();
    } catch (err) {
      toast({
        title: "Status was not updated",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = String(event.active.id);
    setActiveDragTask(tasks.find((task) => task.id === taskId) || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);
    if (!strategy || !over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeTask = tasks.find((task) => task.id === activeId);
    if (!activeTask) return;

    const overTask = tasks.find((task) => task.id === overId);
    const overColumn = STATUS_COLUMNS.find((column) => column.id === overId);
    const targetStatus = overTask?.status || overColumn?.id || activeTask.status;

    const columns = STATUS_COLUMNS.reduce((acc, column) => {
      acc[column.id] = tasks
        .filter((task) => task.status === column.id && task.id !== activeId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return acc;
    }, {} as Record<TaskStatus, StrategyTask[]>);

    if (overTask && targetStatus === activeTask.status) {
      const sameColumn = tasks
        .filter((task) => task.status === activeTask.status)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = sameColumn.findIndex((task) => task.id === activeId);
      const newIndex = sameColumn.findIndex((task) => task.id === overTask.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      columns[targetStatus] = arrayMove(sameColumn, oldIndex, newIndex);
    } else {
      const targetList = columns[targetStatus];
      const overIndex = overTask
        ? targetList.findIndex((task) => task.id === overTask.id)
        : targetList.length;
      const insertAt = overIndex >= 0 ? overIndex : targetList.length;
      targetList.splice(insertAt, 0, { ...activeTask, status: targetStatus });
    }

    let sortOrder = 0;
    const nextTasks = STATUS_COLUMNS.flatMap((column) =>
      columns[column.id].map((task) => ({
        ...task,
        status: column.id,
        sortOrder: sortOrder++,
        completedAt:
          column.id === "DONE"
            ? task.completedAt || new Date().toISOString()
            : task.completedAt && task.id === activeTask.id
            ? null
            : task.completedAt,
      }))
    );

    setStrategy((current) =>
      current
        ? {
            ...current,
            tasks: nextTasks,
            completedTasks: nextTasks.filter((task) => task.status === "DONE").length,
          }
        : current
    );
    if (selectedTaskId === activeId) {
      const movedTask = nextTasks.find((task) => task.id === activeId);
      if (movedTask) setTaskDraft(taskToDraft(movedTask));
    }

    setReorderingTasks(true);
    try {
      const res = await fetch("/api/content/strategy/tasks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy.id,
          items: nextTasks.map((task) => ({
            id: task.id,
            status: task.status,
            sortOrder: task.sortOrder,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Board order was not saved");
      }
      if (json.data?.tasks) {
        setStrategy((current) =>
          current
            ? {
                ...current,
                tasks: json.data.tasks,
                completedTasks: json.data.completedTasks ?? current.completedTasks,
              }
            : current
        );
        if (selectedTaskId) {
          const refreshedTask = json.data.tasks.find(
            (task: StrategyTask) => task.id === selectedTaskId
          );
          if (refreshedTask) setTaskDraft(taskToDraft(refreshedTask));
        }
      }
    } catch (err) {
      await loadData();
      toast({
        title: "Board order was not saved",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setReorderingTasks(false);
    }
  };

  const openReadinessDialog = (task: StrategyTask) => {
    setReadinessTargetTaskId(task.id);
    setReadinessOptions({
      convertToPost: true,
      removeMediaRequirement: true,
      keepDates: true,
    });
  };

  const makeTaskAutomationReady = async () => {
    if (!readinessTargetTask) return;
    setPreparingReadiness(true);
    try {
      const res = await fetch("/api/content/strategy/tasks/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: readinessTargetTask.id,
          options: readinessOptions,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "AI readiness repair failed");
      }

      const updatedTask = json.data.task as StrategyTask;
      setStrategy((current) =>
        current
          ? {
              ...current,
              tasks: current.tasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task
              ),
            }
          : current
      );
      setAutomationBuilder((draft) => ({
        ...draft,
        selectedTaskIds: draft.selectedTaskIds.includes(updatedTask.id)
          ? draft.selectedTaskIds
          : [...draft.selectedTaskIds, updatedTask.id],
      }));
      if (selectedTaskId === updatedTask.id) {
        setTaskDraft(taskToDraft(updatedTask));
      }
      setReadinessTargetTaskId(null);
      toast({
        title: "Item is automation ready",
        description: `${json.data.creditsUsed || 0} credit${json.data.creditsUsed === 1 ? "" : "s"} used. It is selected for AI automation.`,
      });
    } catch (err) {
      toast({
        title: "AI readiness failed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setPreparingReadiness(false);
    }
  };

  const requestDeleteTask = () => {
    if (!taskDraft.id) return;
    setConfirmTarget({
      kind: "delete-task",
      id: taskDraft.id,
      name: taskDraft.title || "this plan item",
    });
  };

  const deleteTaskById = async (taskId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/strategy/tasks?id=${taskId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Task was not deleted");
      closeInspector();
      await loadData();
      toast({ title: "Task removed" });
    } catch (err) {
      toast({
        title: "Task was not removed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAutomation = async () => {
    if (!automationDraft.name.trim()) return;
    if (automationDraft.platforms.length === 0) {
      toast({
        title: "Select a connected channel",
        description: "Automations create scheduled social posts, so they need a real connected destination.",
        variant: "destructive",
      });
      return;
    }
    const linkedTask = automationDraft.strategyTaskId
      ? tasks.find((task) => task.id === automationDraft.strategyTaskId)
      : null;
    if (linkedTask) {
      const readiness = qualifyStrategyTaskForAutomation(linkedTask, {
        includeMedia: automationDraft.includeMedia,
        mediaType: automationDraft.mediaType,
        selectedPlatforms: automationDraft.platforms,
        connectedPlatforms: connectedPlatformKeys,
        emailReady: marketingReadiness.emailReady,
        smsReady: marketingReadiness.smsReady,
        requireDestination: true,
      });
      if (
        !readiness.qualified ||
        readiness.type === "manual" ||
        readiness.type === "email" ||
        readiness.type === "sms"
      ) {
        toast({
          title: "Linked item cannot be automated here",
          description:
            readiness.type === "email"
              ? "Email items must be created through the email automation planner."
              : readiness.blockers[0] || "This item is manual/setup work and cannot be automated as a social post.",
          variant: "destructive",
        });
        return;
      }
    }
    setSaving(true);
    try {
      const isEdit = !!automationDraft.id;
      const res = await fetch("/api/content/automation", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: automationDraft.id,
          name: automationDraft.name,
          type: automationDraft.type,
          enabled: true,
          schedule: {
            frequency: automationDraft.frequency,
            dayOfWeek: automationDraft.dayOfWeek,
            time: automationDraft.time,
          },
          topic: automationDraft.topic,
          aiPrompt: automationDraft.aiPrompt,
          aiTone: automationDraft.aiTone,
          platforms: automationDraft.platforms,
          includeMedia: automationDraft.includeMedia,
          mediaType: automationDraft.includeMedia ? automationDraft.mediaType : null,
          mediaStyle: automationDraft.includeMedia ? automationDraft.mediaStyle : null,
          startDate: automationDraft.startDate,
          endDate: automationDraft.endDate,
          strategyTaskId: automationDraft.strategyTaskId || null,
          sourceStrategyId: strategy?.id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation was not saved");
      await loadData();
      setSelectedAutomationId(json.data.automation.id);
      setInspectorMode("automation");
      setAutomationDraft(automationToDraft(json.data.automation));
      toast({ title: isEdit ? "Automation updated" : "Automation created" });
    } catch (err) {
      toast({
        title: "Automation was not saved",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomation = async (automation: Automation, enabled: boolean) => {
    try {
      const res = await fetch("/api/content/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: automation.id, enabled }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation was not updated");
      setAutomations((prev) =>
        prev.map((item) => (item.id === automation.id ? { ...item, enabled } : item))
      );
    } catch (err) {
      toast({
        title: "Automation was not updated",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const requestDeleteAutomation = (automationId: string, automationName?: string) => {
    setConfirmTarget({
      kind: "delete-automation",
      id: automationId,
      name: automationName || "this automation",
    });
  };

  const deleteAutomationById = async (automationId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/content/automation?id=${automationId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation was not deleted");
      if (selectedAutomationId === automationId) {
        closeInspector();
      }
      await loadData();
      toast({ title: "Automation removed" });
    } catch (err) {
      toast({
        title: "Automation was not removed",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAutomation = async () => {
    if (!automationDraft.id) return;
    requestDeleteAutomation(automationDraft.id, automationDraft.name);
  };

  const requestCancelAllAutomations = () => {
    if (activeStrategyAutomations.length === 0) return;
    setConfirmTarget({ kind: "cancel-automations", count: activeStrategyAutomations.length });
  };

  const cancelAllAutomations = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/content/automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable_all",
          sourceStrategyId: strategy?.id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automations were not cancelled");
      await loadData();
      toast({
        title: "Automations cancelled",
        description: `${json.data?.disabledCount || 0} active automation${json.data?.disabledCount === 1 ? "" : "s"} turned off.`,
      });
    } catch (err) {
      toast({
        title: "Automations were not cancelled",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingAction = async () => {
    const target = confirmTarget;
    if (!target) return;
    setConfirmTarget(null);
    if (target.kind === "delete-task") {
      await deleteTaskById(target.id);
      return;
    }
    if (target.kind === "delete-automation") {
      await deleteAutomationById(target.id);
      return;
    }
    await cancelAllAutomations();
  };

  const openRunConfirmation = async (automation: Automation) => {
    setRunConfirmAutomation(automation);
    setRunPreview(null);
    setLoadingRunPreview(true);
    try {
      const res = await fetch(`/api/content/automation/${automation.id}/run`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Run preview failed");
      setRunPreview(json.data as AutomationRunPreview);
    } catch (err) {
      setRunConfirmAutomation(null);
      toast({
        title: "Run preview was not loaded",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoadingRunPreview(false);
    }
  };

  const runAutomation = async (automation: Automation) => {
    setRunningId(automation.id);
    try {
      const res = await fetch(`/api/content/automation/${automation.id}/run`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation run failed");
      await loadData();
      setRunConfirmAutomation(null);
      setRunPreview(null);
      toast({ title: "Automation ran", description: "A new post draft was created." });
    } catch (err) {
      toast({
        title: "Automation did not run",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setRunningId(null);
    }
  };

  useEffect(() => {
    if (!strategy || !automationBuilderOpen || automationBuilder.selectedTaskIds.length === 0) {
      setAutomationEstimate(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setEstimatingAutomation(true);
      try {
        const selectedTasks = automationReviewTasks.filter((task) =>
          automationBuilder.selectedTaskIds.includes(task.id)
        );
        const taskConfigs = selectedTasks.map((task) => {
          const plan = getTaskAutomationPlan(task, automationBuilder);
          return {
            taskId: task.id,
            frequency: plan.frequency,
            includeMedia: plan.includeMedia,
            mediaType: plan.mediaType,
            startDate: plan.firstRunDate,
            endDate: automationBuilder.endDate,
            platforms: plan.platforms,
          };
        });
        const res = await fetch("/api/content/strategy/automate/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategyId: strategy.id,
            taskIds: automationBuilder.selectedTaskIds,
            frequency: automationBuilder.frequency,
            includeMedia: automationBuilder.includeMedia,
            mediaType: automationBuilder.mediaType,
            endDate: automationBuilder.endDate,
            platforms: automationBuilder.platforms,
            taskConfigs,
          }),
        });
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setAutomationEstimate(json.data);
        }
      } catch {
        if (!cancelled) setAutomationEstimate(null);
      } finally {
        if (!cancelled) setEstimatingAutomation(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [automationBuilder, automationBuilderOpen, automationReviewTasks, getTaskAutomationPlan, strategy]);

  const renderTaskCardContent = (
    task: StrategyTask,
    dragHandle?: ReactNode,
    isOverlay = false
  ) => {
    const category = normalizeTaskCategory(task.category);
    const categoryInfo = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.content;
    const PriorityDot = PRIORITY_CONFIG[task.priority || "MEDIUM"];
    const matches = parseMatches(task.matchedActivities).sort(
      (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
    );
    const latestMatch = matches[0];
    const isSelected = selectedTaskId === task.id;
    const Icon = categoryInfo.icon || FileText;
    const readinessView = getAutomationReadinessView(task);
    const ReadinessIcon = readinessView?.icon || Sparkles;

    return (
      <div
        role={isOverlay ? undefined : "button"}
        tabIndex={isOverlay ? undefined : 0}
        onClick={() => openTask(task)}
        onKeyDown={(event) => {
          if (isOverlay) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTask(task);
          }
        }}
        className={cn(
          "w-full rounded-xl border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          isSelected && "border-brand-500 ring-2 ring-brand-500/20",
          isOverlay && "w-[320px] cursor-grabbing shadow-xl"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn("rounded-lg border p-2", categoryInfo.className)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-semibold leading-snug">
                {task.title}
              </p>
              {dragHandle || (
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            {task.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {task.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <span className={cn("h-2 w-2 rounded-full", PriorityDot.dot)} />
            {PriorityDot.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
            <CalendarDays className="h-3 w-3" />
            {formatShortDate(task.dueDate)}
          </span>
          {(task.automationStatus === "AUTOMATED" || task.automationId) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">
              <Zap className="h-3 w-3" />
              Synced
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1", readinessView.className)}>
            <ReadinessIcon className="h-3 w-3" />
            {readinessView.label}
          </span>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{taskProgress(task)}% complete</span>
            <span>{matches.length} match{matches.length === 1 ? "" : "es"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${taskProgress(task)}%` }}
            />
          </div>
        </div>

        {latestMatch && (
          <Link
            href={completedWorkHref(latestMatch)}
            onClick={(event) => event.stopPropagation()}
            className="mt-3 flex items-start gap-2 rounded-lg border bg-muted/30 p-2 text-xs transition hover:border-brand-500/40 hover:bg-muted"
          >
            <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                Matched from {completedWorkLabel(latestMatch)}
                {latestMatch.activityName ? `: ${latestMatch.activityName}` : ""}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {latestMatch.matchReason || "Opened from strategy sync"} · {formatTimeAgo(latestMatch.matchedAt)}
              </span>
            </span>
          </Link>
        )}

        <div className="mt-3 flex gap-1.5">
          {STATUS_COLUMNS.filter((column) => column.id !== task.status).map((column) => (
            <button
              key={column.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateTaskStatus(task, column.id);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  updateTaskStatus(task, column.id);
                }
              }}
              className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
            >
              {column.label}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTaskCard = (task: StrategyTask) => (
    <SortableTaskCardShell key={task.id} task={task}>
      {(dragHandle) => renderTaskCardContent(task, dragHandle)}
    </SortableTaskCardShell>
  );

  const renderPlanView = () => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="relative">
        {reorderingTasks && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <AISpinner className="h-3.5 w-3.5 text-brand-500" />
            Saving board order
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-3">
          {STATUS_COLUMNS.map((column) => {
            const columnTasks = tasks
              .filter((task) => task.status === column.id)
              .sort((a, b) => a.sortOrder - b.sortOrder);
            return (
              <DroppableTaskColumn
                key={column.id}
                status={column.id}
                className={cn("flex h-[min(960px,calc(100vh-220px))] min-h-[620px] flex-col rounded-2xl border p-3 transition", column.tone)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{column.label}</span>
                    <Badge variant="secondary">{columnTasks.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openNewTask(column.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <SortableContext
                  items={columnTasks.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {columnTasks.length > 0 ? (
                      columnTasks.map(renderTaskCard)
                    ) : (
                      <button
                        onClick={() => openNewTask(column.id)}
                        className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed bg-background/60 text-sm text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add item
                      </button>
                    )}
                  </div>
                </SortableContext>
              </DroppableTaskColumn>
            );
          })}
        </div>
      </div>
      <DragOverlay>
        {activeDragTask
          ? renderTaskCardContent(
              activeDragTask,
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-background text-brand-500">
                <GripVertical className="h-4 w-4" />
              </span>,
              true
            )
          : null}
      </DragOverlay>
    </DndContext>
  );

  const renderAutomationView = () => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Automation controls</p>
          <p className="text-xs text-muted-foreground">
            {qualifiedAutomationTasks.length}/{readyToAutomate.length} plan item{readyToAutomate.length === 1 ? "" : "s"} pass readiness validation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {automationBuilderOpen ? (
            <Button
              variant="outline"
              onClick={() => {
                setAutomationBuilderOpen(false);
                setAutomationConfigOpen(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Close selection
            </Button>
          ) : (
            <>
              <Button
                onClick={openAutomationBuilder}
                disabled={tasks.length === 0}
                className="bg-brand-500 text-white hover:bg-brand-600"
                title="Strategy automation planner"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Planner
              </Button>
              <Button variant="outline" onClick={() => openNewAutomation()} title="One-off automation">
                <Plus className="mr-2 h-4 w-4" />
                Automation
              </Button>
              <Button
                variant="outline"
                onClick={requestCancelAllAutomations}
                disabled={saving || activeStrategyAutomations.length === 0}
                className="border-destructive/30 text-destructive hover:text-destructive"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel all active
              </Button>
            </>
          )}
        </div>
      </div>

      {automationBuilderOpen ? (
        renderAutomationBuilderPanel()
      ) : (
      <div className="grid gap-3 xl:grid-cols-2">
        {automations.map((automation) => {
          const linkedTask = automation.strategyTaskId
            ? tasks.find((task) => task.id === automation.strategyTaskId)
            : null;
          const isSelected = selectedAutomationId === automation.id;
          return (
            <Card
              key={automation.id}
              className={cn(
                "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md",
                isSelected && "border-brand-500 ring-2 ring-brand-500/20"
              )}
              onClick={() => openAutomation(automation)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-brand-500/10 p-2 text-brand-600">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{automation.name}</p>
                        <p className="text-xs text-muted-foreground">{scheduleLabel(automation)}</p>
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={automation.enabled}
                    onCheckedChange={(checked) => toggleAutomation(automation, checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <p className="font-semibold">{automation.totalGenerated}</p>
                    <p className="text-muted-foreground">Posts</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <p className="font-semibold">{automation.totalCreditsSpent}</p>
                    <p className="text-muted-foreground">Credits</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2">
                    <p className="font-semibold">{automation.platforms.length}</p>
                    <p className="text-muted-foreground">Channels</p>
                  </div>
                </div>

                {linkedTask && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-700 dark:text-emerald-300">
                    Connected to {linkedTask.title}
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs text-muted-foreground">
                    Last run: {formatTimeAgo(automation.lastTriggered)}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openAutomation(automation);
                      }}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openRunConfirmation(automation);
                      }}
                      disabled={runningId === automation.id}
                    >
                      {runningId === automation.id ? (
                        <AISpinner className="mr-1.5 h-3.5 w-3.5" />
                      ) : (
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestDeleteAutomation(automation.id, automation.name);
                      }}
                      disabled={saving}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {automations.length === 0 && (
          <button
            onClick={openAutomationBuilder}
            className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center hover:border-brand-500/40"
          >
            <Zap className="mx-auto mb-3 h-8 w-8 text-brand-500" />
            <p className="font-semibold">Create the first automation</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect plan items to recurring content flows.
            </p>
          </button>
        )}
      </div>
      )}
    </div>
  );

  const renderSyncView = () => (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-brand-500" />
            Activity matches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {syncLog.length > 0 ? (
            syncLog.map(({ task, match }) => (
              <div
                key={`${task.id}-${match.activityId}-${match.matchedAt}`}
                className="rounded-xl border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{task.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {match.matchReason}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {match.confidence}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{match.activityName || match.activityType}</span>
                  <span>{formatTimeAgo(match.matchedAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No matched activity yet. Run sync after posts, campaigns, or automations go live.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-brand-500" />
            Sync logic
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="rounded-xl border bg-muted/30 p-3">
            Published posts, campaigns, and post automations are matched to plan items by category, keywords, date range, and direct strategy links.
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            Connected automations update task progress after they generate posts, then the plan score can move automatically.
          </div>
          <Button onClick={syncNow} disabled={syncing} className="w-full bg-brand-500 text-white hover:bg-brand-600">
            {syncing ? <AISpinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync now
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderInspector = () => {
    if (inspectorMode === "task") {
      const completedMatches = selectedTask
        ? parseMatches(selectedTask.matchedActivities).sort(
            (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
          )
        : [];
      const isCompletedTask = selectedTask?.status === "DONE";
      const selectedReadinessView = selectedTask ? getAutomationReadinessView(selectedTask) : null;
      const SelectedReadinessIcon = selectedReadinessView?.icon || Sparkles;
      const selectedReadiness = selectedReadinessView?.readiness || null;
      const canRepairReadiness =
        !!selectedTask &&
        selectedTask.status !== "DONE" &&
        !selectedTask.automationId &&
        selectedTask.automationStatus !== "AUTOMATED" &&
        !!selectedReadiness &&
        !selectedReadiness.qualified;
      const oneOffPlan = selectedTask ? getTaskAutomationPlan(selectedTask, automationBuilder) : null;
      const oneOffReadiness = selectedTask ? getTaskPlanReadiness(selectedTask, automationBuilder) : null;
      const oneOffBlockers = selectedTask && oneOffReadiness
        ? [
            ...(isTaskAutomatable(selectedTask) ? [] : ["This item is manual/setup work and cannot be automated directly."]),
            ...(oneOffReadiness.type === "email" ? ["Email items need the email automation planner."] : []),
            ...(oneOffReadiness.type === "sms" ? ["SMS is not available from one-off strategy automation."] : []),
            ...(oneOffReadiness.type === "manual" ? oneOffReadiness.blockers : []),
            ...(oneOffReadiness.type !== "manual" ? oneOffReadiness.blockers : []),
            ...((oneOffPlan?.missingPlatforms || []).map(
              (platform) => `Connect ${PLATFORM_META[platform]?.label || platform} before automating.`
            )),
          ].filter(Boolean)
        : [];
      const canOpenOneOff = !!selectedTask && oneOffBlockers.length === 0;

      return (
        <InspectorShell
          title={taskDraft.id ? "Edit item" : "New item"}
          subtitle={taskDraft.id ? "Plan item details" : "Add to the current plan"}
          icon={Target}
          onClose={closeInspector}
        >
          <div className="space-y-4">
            {taskDraft.id && isCompletedTask && (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Completed work reference</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {completedMatches.length > 0
                        ? "This item was matched to real work. Open the reference to review what completed it."
                        : "This item is marked done manually. Run Sync after a post, campaign, or automation goes live to attach the exact work reference."}
                    </p>
                  </div>
                </div>

                {completedMatches.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {completedMatches.map((match) => (
                      <Link
                        key={`${match.activityType}-${match.activityId}-${match.matchedAt}`}
                        href={completedWorkHref(match)}
                        className="group block rounded-lg border bg-background p-3 text-left transition hover:border-brand-500/50 hover:bg-muted/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                {completedWorkLabel(match)}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                                {match.confidence} match
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-medium">
                              {match.activityName || completedWorkLabel(match)}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {match.matchReason}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700">
                            Open
                            <Link2 className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Matched {formatTimeAgo(match.matchedAt)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {taskDraft.id && selectedTask && !isCompletedTask && completedMatches.length > 0 && (
              <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-3">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-brand-500/10 p-2 text-brand-600">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Matched activity source</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      This in-progress item is moving because Sync found related work. Open a match to review where it came from.
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {completedMatches.map((match) => (
                    <Link
                      key={`${match.activityType}-${match.activityId}-${match.matchedAt}`}
                      href={completedWorkHref(match)}
                      className="group block rounded-lg border bg-background p-3 text-left transition hover:border-brand-500/50 hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-700 dark:text-brand-300">
                              {completedWorkLabel(match)}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                              {match.confidence} match
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm font-medium">
                            {match.activityName || completedWorkLabel(match)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {match.matchReason}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700">
                          View
                          <Link2 className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Initiated by strategy sync {formatTimeAgo(match.matchedAt)}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {taskDraft.id && selectedTask && selectedReadinessView && selectedReadiness && (
              <div
                className={cn(
                  "rounded-xl border p-3",
                  selectedReadiness.qualified
                    ? "border-emerald-500/25 bg-emerald-500/5"
                    : "border-amber-500/25 bg-amber-500/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", selectedReadinessView.className)}>
                        <SelectedReadinessIcon className="h-3.5 w-3.5" />
                        {selectedReadinessView.label}
                      </span>
                      <span className="text-xs capitalize text-muted-foreground">
                        {selectedReadiness.type} automation
                      </span>
                    </div>
                    {(selectedReadiness.blockers.length > 0 ||
                      selectedReadiness.requirements.length > 0 ||
                      selectedReadiness.warnings.length > 0) && (
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {selectedReadiness.blockers.slice(0, 3).map((blocker) => (
                          <p key={blocker} className="flex gap-2">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            {blocker}
                          </p>
                        ))}
                        {selectedReadiness.requirements.slice(0, 2).map((requirement) => (
                          <p key={requirement} className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                            {requirement}
                          </p>
                        ))}
                        {selectedReadiness.warnings.slice(0, 2).map((warning) => (
                          <p key={warning} className="flex gap-2">
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {canRepairReadiness && (
                    <Button
                      size="sm"
                      onClick={() => openReadinessDialog(selectedTask)}
                      disabled={preparingReadiness && readinessTargetTaskId === selectedTask.id}
                      className="shrink-0 bg-brand-500 text-white hover:bg-brand-600"
                    >
                      {preparingReadiness && readinessTargetTaskId === selectedTask.id ? (
                        <AISpinner className="mr-2 h-4 w-4" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      AI readiness
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Item</Label>
              <Input
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                placeholder="Campaign kickoff, product drop, review push..."
              />
            </div>
            <div className="space-y-2">
              <Label>Prompt for the team</Label>
              <Textarea
                value={taskDraft.description}
                onChange={(event) => setTaskDraft((draft) => ({ ...draft, description: event.target.value }))}
                placeholder="Define the objective, proof points, target audience, channels, and approval owner."
                className="min-h-[110px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={taskDraft.category}
                  onValueChange={(value) =>
                    setTaskDraft((draft) => ({ ...draft, category: value as TaskCategory }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={taskDraft.priority}
                  onValueChange={(value) =>
                    setTaskDraft((draft) => ({ ...draft, priority: value as TaskPriority }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={taskDraft.startDate}
                  onChange={(event) => setTaskDraft((draft) => ({ ...draft, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due</Label>
                <Input
                  type="date"
                  value={taskDraft.dueDate}
                  onChange={(event) => setTaskDraft((draft) => ({ ...draft, dueDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_COLUMNS.map((column) => (
                <button
                  key={column.id}
                  onClick={() => setTaskDraft((draft) => ({ ...draft, status: column.id }))}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium",
                    taskDraft.status === column.id
                      ? "border-brand-500 bg-brand-500 text-white"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  {column.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={saveTask}
                disabled={saving || !taskDraft.title.trim()}
                className="flex-1 bg-brand-500 text-white hover:bg-brand-600"
              >
                {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save
              </Button>
              {taskDraft.id && (
                <Button
                  variant="outline"
                  onClick={() => openNewAutomation(selectedTask || undefined)}
                  disabled={!canOpenOneOff}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  One-off
                </Button>
              )}
            </div>
            {taskDraft.id && oneOffBlockers.length > 0 && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Not a one-off automation yet</p>
                <p className="mt-1">{oneOffBlockers[0]}</p>
              </div>
            )}
            {taskDraft.id && (
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={requestDeleteTask}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete item
              </Button>
            )}
          </div>
        </InspectorShell>
      );
    }

    return (
      <InspectorShell
        title={automationDraft.id ? "Edit automation" : "Automation"}
        subtitle="Create or edit a single automation outside the strategy planner"
        icon={Zap}
        onClose={closeInspector}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={automationDraft.name}
              onChange={(event) => setAutomationDraft((draft) => ({ ...draft, name: event.target.value }))}
              placeholder="Weekly insight flow"
            />
          </div>
          <div className="space-y-2">
            <Label>Linked plan item</Label>
            <Select
              value={automationDraft.strategyTaskId || "none"}
              onValueChange={(value) =>
                setAutomationDraft((draft) => ({
                  ...draft,
                  strategyTaskId: value === "none" ? "" : value,
                }))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No direct link</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={automationDraft.frequency}
                onValueChange={(value) =>
                  setAutomationDraft((draft) => ({ ...draft, frequency: value as Frequency }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={automationDraft.time}
                onChange={(event) => setAutomationDraft((draft) => ({ ...draft, time: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Topic</Label>
            <Input
              value={automationDraft.topic}
              onChange={(event) => setAutomationDraft((draft) => ({ ...draft, topic: event.target.value }))}
              placeholder="Main topic for generated posts"
            />
          </div>
          <div className="space-y-2">
            <Label>Generation brief</Label>
            <Textarea
              value={automationDraft.aiPrompt}
              onChange={(event) => setAutomationDraft((draft) => ({ ...draft, aiPrompt: event.target.value }))}
              placeholder="What should FlowAI create each run?"
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            {automationPlatformOptions.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {automationPlatformOptions.map((platform) => {
                  const selected = automationDraft.platforms.includes(platform.id);
                  return renderAutomationPlatformButton(platform, selected, () =>
                    setAutomationDraft((draft) => ({
                      ...draft,
                      platforms: selected
                        ? draft.platforms.filter((id) => id !== platform.id)
                        : [...draft.platforms, platform.id],
                    }))
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                Connect a social account before creating a one-off social automation. Manual tasks cannot be completed by posting to the internal feed.
              </div>
            )}
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Generate media</p>
                <p className="text-xs text-muted-foreground">Add image or video on each run.</p>
              </div>
              <Switch
                checked={automationDraft.includeMedia}
                onCheckedChange={(checked) =>
                  setAutomationDraft((draft) => ({ ...draft, includeMedia: checked }))
                }
              />
            </div>
            {automationDraft.includeMedia && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Select
                  value={automationDraft.mediaType}
                  onValueChange={(value) =>
                    setAutomationDraft((draft) => ({ ...draft, mediaType: value as "image" | "video" }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={automationDraft.mediaStyle}
                  onChange={(event) => setAutomationDraft((draft) => ({ ...draft, mediaStyle: event.target.value }))}
                  placeholder="Style"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <Input
                type="date"
                value={automationDraft.startDate}
                onChange={(event) => setAutomationDraft((draft) => ({ ...draft, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <Input
                type="date"
                value={automationDraft.endDate}
                onChange={(event) => setAutomationDraft((draft) => ({ ...draft, endDate: event.target.value }))}
              />
            </div>
          </div>
          <Button
            onClick={saveAutomation}
            disabled={saving || !automationDraft.name.trim() || automationDraft.platforms.length === 0}
            className="w-full bg-brand-500 text-white hover:bg-brand-600"
          >
            {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Save automation
          </Button>
          {automationDraft.id && (
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={deleteAutomation}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete automation
            </Button>
          )}
        </div>
      </InspectorShell>
    );
  };

  const renderStrategyBuilderPanel = () => {
    const isImprove = strategyBuilderMode === "improve" && !!strategy;

    return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/30 p-3">
        {brandLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AISpinner className="h-4 w-4 text-brand-500" />
            Loading brand identity
          </div>
        ) : brand ? (
          <div className="flex items-start gap-3">
            {brand.logo ? (
              <img
                src={brand.logo}
                alt={brand.name}
                className="h-11 w-11 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
                {brand.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{brand.name}</p>
              <p className="text-xs text-muted-foreground">
                {[brand.industry, brand.niche, brand.voiceTone].filter(Boolean).join(" / ") || "Saved brand identity"}
              </p>
              {(brand.targetAudience || brand.uniqueValue) && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {brand.targetAudience || brand.uniqueValue}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
            <div>
              <p className="font-medium">No brand identity found</p>
              <p className="text-xs text-muted-foreground">FlowAI can still build from your goal.</p>
            </div>
          </div>
        )}
      </div>

      {!isImprove && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Strategy goal</Label>
            <span className="text-xs text-muted-foreground">Preset focus</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {STRATEGY_GOAL_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const selected = strategyBuilder.goalPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyStrategyGoalPreset(preset)}
                  className={cn(
                    "min-h-[118px] rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-muted/40",
                    selected && "border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/15"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        selected ? "border-brand-500/30 bg-brand-500 text-white" : "bg-background text-brand-600"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{preset.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {preset.description}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {preset.focusAreas.slice(0, 4).map((category) => (
                      <span
                        key={category}
                        className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {CATEGORY_CONFIG[category].label}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isImprove && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-brand-500/10 p-2 text-brand-600">
              <Wand2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Improve active strategy</p>
              <p className="mt-1 text-muted-foreground">
                FlowAI will keep completed and already automated work, then rewrite open items so more of them pass automation readiness validation.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg border bg-background p-2">
                  <p className="font-semibold">{qualifiedAutomationTasks.length}</p>
                  <p className="text-muted-foreground">Ready now</p>
                </div>
                <div className="rounded-lg border bg-background p-2">
                  <p className="font-semibold">{automationReadinessSummary.alreadyAutomated}</p>
                  <p className="text-muted-foreground">Connected</p>
                </div>
                <div className="rounded-lg border bg-background p-2">
                  <p className="font-semibold">{automationReadinessSummary.manualOnly}</p>
                  <p className="text-muted-foreground">Manual</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{isImprove ? "Improvement direction" : "Goal"}</Label>
        <Textarea
          value={strategyBuilder.goals}
          onChange={(event) =>
            setStrategyBuilder((draft) => ({ ...draft, goalPresetId: null, goals: event.target.value }))
          }
          placeholder={
            isImprove
              ? "Make this plan automation-ready for recurring posts, email, and connected channels"
              : brand
              ? `Create a strategy for ${brand.name}`
              : "Create a strategy from my brand identity"
          }
          className="min-h-[105px]"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TIMEFRAME_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() =>
              setStrategyBuilder((draft) => ({ ...draft, timeframe: option.value }))
            }
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium",
              strategyBuilder.timeframe === option.value
                ? "border-brand-500 bg-brand-500 text-white"
                : "bg-background hover:bg-muted"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Focus areas</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const category = key as TaskCategory;
            const Icon = config.icon;
            const selected = strategyBuilder.focusAreas.includes(category);
            return (
              <button
                key={category}
                onClick={() => toggleStrategyFocus(category)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                  selected
                    ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                    : "bg-background hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Platforms</Label>
        <div className="flex flex-wrap gap-2">
          {STRATEGY_PLATFORM_OPTIONS.map((platform) => {
            const selected = strategyBuilder.platforms.includes(platform);
            return (
              <button
                key={platform}
                onClick={() => toggleStrategyPlatform(platform)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium",
                  selected
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {platform}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Competitors</Label>
          <Input
            value={strategyBuilder.competitorInfo}
            onChange={(event) =>
              setStrategyBuilder((draft) => ({ ...draft, competitorInfo: event.target.value }))
            }
            placeholder="Competitors or market"
          />
        </div>
        <div className="space-y-2">
          <Label>Budget</Label>
          <Input
            value={strategyBuilder.budget}
            onChange={(event) =>
              setStrategyBuilder((draft) => ({ ...draft, budget: event.target.value }))
            }
            placeholder="Organic, $500/month..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Extra context</Label>
        <Textarea
          value={strategyBuilder.additionalContext}
          onChange={(event) =>
            setStrategyBuilder((draft) => ({ ...draft, additionalContext: event.target.value }))
          }
          placeholder="Launches, offers, seasonal pushes, locations, or constraints"
          className="min-h-[80px]"
        />
      </div>

      <div className="grid gap-2">
        <Button
          onClick={() => generateStrategyFromBrand(false)}
          disabled={generatingStrategy || strategyBuilder.focusAreas.length === 0}
          className="bg-brand-500 text-white hover:bg-brand-600"
        >
          {generatingStrategy ? <AISpinner className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {isImprove ? "Improve active strategy" : "Create a strategy"}
        </Button>
      </div>
    </div>
    );
  };

  const renderAutomationPlatformButton = (
    platform: { id: string; label: string; detail: string },
    selected: boolean,
    onClick: () => void
  ) => {
    const meta = PLATFORM_META[platform.id] || PLATFORM_META.feed;
    const Icon = meta?.icon || Rss;
    const platformStyle = getAccountPlatformStyle(platform.id);

    return (
      <button
        key={platform.id}
        type="button"
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-xs transition",
          selected
            ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
            : "bg-background hover:-translate-y-0.5 hover:bg-muted"
        )}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
            selected ? "border-brand-500 bg-brand-500 text-white" : "bg-background"
          )}
        >
          {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
        </span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105"
          style={{
            background: platformStyle.softer,
            borderColor: platformStyle.soft,
            color: platformStyle.color,
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{platform.label}</span>
          <span className="block truncate text-xs text-muted-foreground">{platform.detail}</span>
        </span>
      </button>
    );
  };

  const renderAutomationBuilderPanel = () => {
    const validationRows = automationReviewTasks.map((task) => {
      const plan = getTaskAutomationPlan(task, automationBuilder);
      return {
        task,
        plan,
        readiness: getTaskPlanReadiness(task, automationBuilder),
        selected: automationBuilder.selectedTaskIds.includes(task.id),
        canEverAutomate: isTaskAutomatable(task),
      };
    });
    const selectedRows = validationRows.filter((row) => row.selected);
    const readySelected = selectedRows.filter(
      (row) => row.canEverAutomate && row.readiness.qualified && row.plan.missingPlatforms.length === 0
    );
    const blockedSelected = selectedRows.filter(
      (row) => row.canEverAutomate && (!row.readiness.qualified || row.plan.missingPlatforms.length > 0)
    );
    const manualSelected = selectedRows.filter((row) => !row.canEverAutomate);
    const estimateBlocked = !!automationEstimate && !automationEstimate.hasEnoughCredits;
    const requiredCredits = automationEstimate?.requiredCredits ?? automationEstimate?.totalCredits ?? 0;
    const projectedCredits = automationEstimate?.projectedCredits ?? automationEstimate?.totalCredits ?? 0;
    const projectedRuns = automationEstimate?.projectedRuns ?? automationEstimate?.totalPosts ?? 0;

    return (
      <div className="rounded-2xl border bg-background">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold">AI automation selection</p>
            <p className="text-sm text-muted-foreground">
              {readySelected.length} ready, {blockedSelected.length} need setup, {manualSelected.length} manual-only, {requiredCredits} credits needed for the next run
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAutomationBuilder((draft) => ({
                  ...draft,
                  selectedTaskIds: automationReviewTasks.map((task) => task.id),
                }))
              }
              disabled={automationReviewTasks.length === 0}
            >
              All items
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAutomationBuilder((draft) => ({ ...draft, selectedTaskIds: [] }))}
              disabled={automationReviewTasks.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Selected</p>
              <p className="mt-1 text-2xl font-bold">{automationBuilder.selectedTaskIds.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Ready</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">{readySelected.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Need setup</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">{blockedSelected.length}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Next run</p>
              <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                {estimatingAutomation ? <AISpinner size={24} /> : requiredCredits}
              </p>
              {automationEstimate && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Projected {projectedCredits} / {projectedRuns} run{projectedRuns === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Balance</p>
              <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                {automationEstimate?.userCredits ?? "-"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                  <span className="rounded-full bg-brand-500 px-2.5 py-1 text-white">1 Select ready items</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">2 Plan schedule and channels</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">3 Create saved automations</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecting an item only prepares it. The planner modal validates schedule, channels, media, and credits. The final create step saves a reusable automation set linked to this strategy for future AI runs.
                </p>
              </div>
              <Button
                onClick={() => setAutomationConfigOpen(true)}
                disabled={readySelected.length === 0}
                className="bg-brand-500 text-white hover:bg-brand-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Open automation planner
              </Button>
            </div>
            {estimateBlocked && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Next run needs {requiredCredits} credits. Balance is {automationEstimate.userCredits}. Projected future usage is {projectedCredits} credits.
              </div>
            )}
          </div>

          <div className="h-[min(700px,calc(100vh-380px))] min-h-[460px] overflow-y-auto rounded-xl border p-2">
            {validationRows.length > 0 ? (
              validationRows.map(({ task, plan, readiness, selected, canEverAutomate }) => {
                const category = normalizeTaskCategory(task.category);
                const rowReady = canEverAutomate && readiness.qualified && plan.missingPlatforms.length === 0;
                return (
                  <button
                    key={task.id}
                    onClick={() => toggleAutomationTask(task.id)}
                    className={cn(
                      "mb-2 flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition last:mb-0",
                      selected
                        ? "border-brand-500 bg-brand-500/10"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px]",
                        selected ? "border-brand-500 bg-brand-500 text-white" : "bg-background"
                      )}
                    >
                      {selected && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{task.title}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] capitalize",
                            rowReady
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {rowReady ? "ready" : canEverAutomate ? "needs setup" : "manual only"}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                          {readiness.type}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {category} · {formatShortDate(plan.firstRunDate)} at {plan.time} · {formatPlatformList(plan.platforms)}
                      </span>
                      {(!canEverAutomate || plan.missingPlatforms.length > 0 || readiness.blockers.length > 0 || readiness.requirements.length > 0 || readiness.warnings.length > 0) && (
                        <span className="mt-2 block space-y-1 text-xs">
                          {!canEverAutomate && (
                            <span className="block text-destructive">This item is planning/setup work and cannot be automated directly.</span>
                          )}
                          {plan.missingPlatforms.map((platform) => (
                            <span key={platform} className="block text-destructive">
                              Connect {PLATFORM_META[platform]?.label || platform} before scheduling this item.
                            </span>
                          ))}
                          {readiness.blockers.map((blocker) => (
                            <span key={blocker} className="block text-destructive">{blocker}</span>
                          ))}
                          {readiness.requirements.map((requirement) => (
                            <span key={requirement} className="block text-muted-foreground">{requirement}</span>
                          ))}
                          {readiness.warnings.map((warning) => (
                            <span key={warning} className="block text-amber-600 dark:text-amber-300">{warning}</span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="grid h-full place-items-center rounded-lg border border-dashed p-5 text-sm">
                <div className="max-w-xl space-y-4 text-center">
                  <div>
                    <p className="font-semibold text-foreground">No automation-ready candidates in this plan</p>
                    <p className="mt-2 text-muted-foreground">
                      Improve the active strategy to turn open work into publishable content, social, or email tasks with clear audience, offer, proof point, call to action, and channel.
                    </p>
                  </div>
                  <div className="grid gap-2 text-left sm:grid-cols-3">
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-lg font-bold">{automationReadinessSummary.alreadyAutomated}</p>
                      <p className="text-xs text-muted-foreground">Already connected</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-lg font-bold">{automationReadinessSummary.manualOnly}</p>
                      <p className="text-xs text-muted-foreground">Manual or setup work</p>
                    </div>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-lg font-bold">{automationReadinessSummary.completed}</p>
                      <p className="text-xs text-muted-foreground">Completed items</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-background p-3 text-left text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">To qualify, items need:</p>
                    <p className="mt-1">A content/social/email category, unfinished status, no existing automation, a selected destination, and required media/email setup when the task asks for it.</p>
                    {automationReadinessSummary.blockers.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {automationReadinessSummary.blockers.map((blocker) => (
                          <p key={blocker} className="text-destructive">{blocker}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={() => openStrategyBuilder("improve")} className="bg-brand-500 text-white hover:bg-brand-600">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Improve strategy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReadinessDialog = () => {
    const task = readinessTargetTask;
    const readiness = task ? getTaskReadiness(task, automationBuilder) : null;

    return (
      <FloatingPanel
        open={!!task}
        onOpenChange={(open) => {
          if (!open && !preparingReadiness) setReadinessTargetTaskId(null);
        }}
        title="AI Readiness"
        description="Repair the selected item before creating a flow"
        icon={<Sparkles className="h-4 w-4" />}
        defaultSize={{ width: 720, height: 760 }}
        defaultPosition={{ x: 156, y: 82 }}
        minSize={{ width: 520, height: 420 }}
        contentClassName="space-y-4"
      >

          {preparingReadiness ? (
            <div className="rounded-2xl border bg-muted/20 p-4">
              <AIGenerationLoader
                compact
                currentStep="Preparing item for automation"
                subtitle="FlowAI is rewriting the brief, channel type, and validation details."
                className="min-h-[260px]"
              />
            </div>
          ) : task && readiness ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-sm font-semibold">{task.title}</p>
                {task.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {task.description}
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Current type</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{readiness.type}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className={cn("mt-1 text-sm font-semibold", readiness.qualified ? "text-emerald-600" : "text-amber-600")}>
                    {readiness.qualified ? "Ready" : "Needs setup"}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Selected channels</p>
                  <p className="mt-1 truncate text-sm font-semibold">
                    {automationBuilder.platforms.length ? automationBuilder.platforms.join(", ") : "None"}
                  </p>
                </div>
              </div>

              {(readiness.blockers.length > 0 ||
                readiness.requirements.length > 0 ||
                readiness.warnings.length > 0) && (
                <div className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">What must be fixed</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {readiness.blockers.map((blocker) => (
                      <p key={blocker} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        {blocker}
                      </p>
                    ))}
                    {readiness.requirements.map((requirement) => (
                      <p key={requirement} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        {requirement}
                      </p>
                    ))}
                    {readiness.warnings.map((warning) => (
                      <p key={warning} className="flex gap-2">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-xl border p-3">
                <p className="text-sm font-semibold">FlowAI repair options</p>
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3">
                  <div>
                    <p className="text-sm font-medium">Convert to automatable content</p>
                    <p className="text-xs text-muted-foreground">
                      Rewrite the item as a recurring post/email brief with audience, proof point, CTA, and destination.
                    </p>
                  </div>
                  <Switch
                    checked={readinessOptions.convertToPost}
                    onCheckedChange={(checked) =>
                      setReadinessOptions((draft) => ({ ...draft, convertToPost: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3">
                  <div>
                    <p className="text-sm font-medium">Remove media blockers</p>
                    <p className="text-xs text-muted-foreground">
                      Avoid visual, video, SMS, or platform-specific blockers unless media is enabled.
                    </p>
                  </div>
                  <Switch
                    checked={readinessOptions.removeMediaRequirement}
                    onCheckedChange={(checked) =>
                      setReadinessOptions((draft) => ({ ...draft, removeMediaRequirement: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-background p-3">
                  <div>
                    <p className="text-sm font-medium">Keep schedule and priority</p>
                    <p className="text-xs text-muted-foreground">
                      Preserve the current status, priority, start date, and due date.
                    </p>
                  </div>
                  <Switch
                    checked={readinessOptions.keepDates}
                    onCheckedChange={(checked) =>
                      setReadinessOptions((draft) => ({ ...draft, keepDates: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              This item could not be loaded.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              onClick={() => setReadinessTargetTaskId(null)}
              disabled={preparingReadiness}
            >
              Cancel
            </Button>
            <Button
              onClick={makeTaskAutomationReady}
              disabled={!task || preparingReadiness}
              className="bg-brand-500 text-white hover:bg-brand-600"
            >
              {preparingReadiness ? (
                <AISpinner className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Make automation ready
            </Button>
          </div>
      </FloatingPanel>
    );
  };

  const renderAutomationConfigDialog = () => {
    const validationRows = automationReviewTasks.map((task) => {
      const plan = getTaskAutomationPlan(task, automationBuilder);
      return {
        task,
        plan,
        readiness: getTaskPlanReadiness(task, automationBuilder),
        selected: automationBuilder.selectedTaskIds.includes(task.id),
        canEverAutomate: isTaskAutomatable(task),
      };
    });
    const selectedRows = validationRows.filter((row) => row.selected);
    const readySelected = selectedRows.filter(
      (row) => row.canEverAutomate && row.readiness.qualified && row.plan.missingPlatforms.length === 0
    );
    const blockedSelected = selectedRows.filter(
      (row) => row.canEverAutomate && (!row.readiness.qualified || row.plan.missingPlatforms.length > 0)
    );
    const manualSelected = selectedRows.filter((row) => !row.canEverAutomate);
    const estimateBlocked = !!automationEstimate && !automationEstimate.hasEnoughCredits;
    const requiredCredits = automationEstimate?.requiredCredits ?? automationEstimate?.totalCredits ?? 0;
    const projectedCredits = automationEstimate?.projectedCredits ?? automationEstimate?.totalCredits ?? 0;
    const projectedRuns = automationEstimate?.projectedRuns ?? automationEstimate?.totalPosts ?? 0;
    const perRunCredits =
      automationEstimate?.automatableTasks.reduce((sum, task) => sum + (task.costPerRun ?? 0), 0) ||
      requiredCredits;
    const selectedTypes = [...new Set(readySelected.map((row) => row.readiness.type))];
    const readyGroups = Object.entries(
      readySelected.reduce((acc, row) => {
        const key = `${row.plan.firstRunDate}|${formatPlatformList(row.plan.platforms)}`;
        acc[key] = [...(acc[key] || []), row.task.title];
        return acc;
      }, {} as Record<string, string[]>)
    ).map(([key, titles]) => {
      const [date, channels] = key.split("|");
      return { date, channels, titles };
    });

    return (
      <FloatingPanel
        open={automationConfigOpen}
        onOpenChange={setAutomationConfigOpen}
        title="Planner"
        description="Grouped plan-item automation setup"
        icon={<Sparkles className="h-4 w-4" />}
        defaultSize={{ width: 1120, height: 820 }}
        defaultPosition={{ x: 70, y: 66 }}
        minSize={{ width: 760, height: 520 }}
      >
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold">Plan automation setup</p>
            <p className="text-sm text-muted-foreground">
              Validate timing, destinations, media, and credits before saving selected plan items as strategy automations.
            </p>
          </div>

            <div className="rounded-xl border bg-brand-500/5 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: "1. Validate",
                    body: "Only ready items can move forward. Blocked items stay selected for review but will not be created.",
                  },
                  {
                    title: "2. Plan",
                    body: "Set schedule, channels, media, and FlowAI direction for the automation set.",
                  },
                  {
                    title: "3. Save set",
                    body: "Create stores the automations on this strategy. Credits are charged each time a run generates content.",
                  },
                ].map((step) => (
                  <div key={step.title} className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Selected</p>
                <p className="mt-1 text-2xl font-bold">{automationBuilder.selectedTaskIds.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Ready to create</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{readySelected.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Need setup</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">{blockedSelected.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Cannot automate</p>
                <p className="mt-1 text-2xl font-bold text-muted-foreground">{manualSelected.length}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Next run</p>
                <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                  {estimatingAutomation ? <AISpinner size={24} /> : requiredCredits}
                </p>
                {automationEstimate && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Projected {projectedCredits}
                  </p>
                )}
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                  {automationEstimate?.userCredits ?? "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <div className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">Ready items</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTypes.length ? selectedTypes.join(", ") : "No ready item selected yet"}
                      </p>
                    </div>
                    <Badge variant="secondary">{readySelected.length} item{readySelected.length === 1 ? "" : "s"}</Badge>
                  </div>

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {readySelected.length > 0 ? (
                      readySelected.map(({ task, readiness, plan }) => (
                        <div key={task.id} className="rounded-lg border bg-muted/20 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
                              <p className="mt-1 text-xs capitalize text-muted-foreground">
                                {readiness.type} automation - {formatShortDate(plan.firstRunDate)} at {plan.time}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Planned for {formatPlatformList(plan.platforms)}
                              </p>
                            </div>
                            <Badge className="bg-emerald-600 text-white">Ready</Badge>
                          </div>
                          {readiness.requirements.length > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {readiness.requirements.join(" ")}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Select at least one ready item in the automation selection list first.
                      </div>
                    )}
                  </div>
                </div>

                {readyGroups.length > 0 && (
                  <div className="rounded-xl border p-3">
                    <p className="text-sm font-semibold">Auto-grouped schedule</p>
                    <div className="mt-2 space-y-2">
                      {readyGroups.map((group) => (
                        <div key={`${group.date}-${group.channels}`} className="rounded-lg bg-muted/30 p-2">
                          <p className="text-xs font-medium">
                            {formatShortDate(group.date)} - {group.channels}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {group.titles.length} item{group.titles.length === 1 ? "" : "s"}: {group.titles.slice(0, 2).join(", ")}
                            {group.titles.length > 2 ? ` + ${group.titles.length - 2} more` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {blockedSelected.length > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">
                      {blockedSelected.length} selected item{blockedSelected.length === 1 ? "" : "s"} still need setup
                    </p>
                    <div className="mt-2 space-y-2">
                      {blockedSelected.slice(0, 6).map(({ task, readiness, plan }) => (
                        <div key={task.id} className="rounded-lg bg-background p-2">
                          <p className="text-xs font-medium">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {plan.missingPlatforms.length > 0
                              ? `Connect ${formatPlatformList(plan.missingPlatforms)}`
                              : readiness.blockers[0] || readiness.requirements[0] || "Needs more automation detail"}
                          </p>
                          {plan.missingPlatforms.length > 0 && (
                            <Link href="/social-accounts" className="mt-1 inline-flex text-xs font-medium text-brand-600 hover:text-brand-700">
                              Connect account
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {manualSelected.length > 0 && (
                  <div className="rounded-xl border p-3 text-sm">
                    <p className="font-semibold">Cannot automate directly</p>
                    <div className="mt-2 space-y-2">
                      {manualSelected.slice(0, 6).map(({ task }) => (
                        <div key={task.id} className="rounded-lg bg-muted/30 p-2">
                          <p className="text-xs font-medium">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            This is setup, analytics, ads, or manual review work. Use AI readiness or improve strategy to turn it into content/email/social execution.
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={automationBuilder.frequency}
                      onValueChange={(value) =>
                        setAutomationBuilder((draft) => ({ ...draft, frequency: value as Frequency }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={automationBuilder.time}
                      onChange={(event) =>
                        setAutomationBuilder((draft) => ({ ...draft, time: event.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select
                      value={automationBuilder.aiTone}
                      onValueChange={(value) =>
                        setAutomationBuilder((draft) => ({ ...draft, aiTone: value }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((tone) => (
                          <SelectItem key={tone} value={tone}>
                            {tone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input
                      type="date"
                      value={automationBuilder.endDate}
                      onChange={(event) =>
                        setAutomationBuilder((draft) => ({ ...draft, endDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Channels</Label>
                  {automationPlatformOptions.length > 0 ? (
                    <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                      {automationPlatformOptions.map((platform) =>
                        renderAutomationPlatformButton(
                          platform,
                          automationBuilder.platforms.includes(platform.id),
                          () => toggleAutomationPlatform(platform.id)
                        )
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                      No connected publishing channels found. Connect Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Pinterest, or Threads before creating social automations.
                    </div>
                  )}
                </div>

                <div className="rounded-xl border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Media</p>
                      <p className="text-xs text-muted-foreground">Image or video generation</p>
                    </div>
                    <Switch
                      checked={automationBuilder.includeMedia}
                      onCheckedChange={(checked) =>
                        setAutomationBuilder((draft) => ({ ...draft, includeMedia: checked }))
                      }
                    />
                  </div>
                  {automationBuilder.includeMedia && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Select
                        value={automationBuilder.mediaType}
                        onValueChange={(value) =>
                          setAutomationBuilder((draft) => ({ ...draft, mediaType: value as "image" | "video" }))
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Image</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={automationBuilder.mediaStyle}
                        onChange={(event) =>
                          setAutomationBuilder((draft) => ({ ...draft, mediaStyle: event.target.value }))
                        }
                        placeholder="Style"
                      />
                    </div>
                  )}
                </div>

                {automationEstimate && (
                  <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                    <p className="font-semibold">Credit estimate</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p>
                        Next run: <span className="font-medium text-foreground">{requiredCredits}</span> credits
                        {perRunCredits ? ` (${perRunCredits} per scheduled run group)` : ""}
                      </p>
                      <p>
                        Projection: <span className="font-medium text-foreground">{projectedCredits}</span> credits across{" "}
                        <span className="font-medium text-foreground">{projectedRuns}</span> planned run{projectedRuns === 1 ? "" : "s"} through {formatShortDate(automationBuilder.endDate)}.
                      </p>
                      <p>Saving the automation does not deduct the full projection. Credits are deducted only when each automation run generates content.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>FlowAI direction</Label>
                  <Textarea
                    value={automationBuilder.customPrompt}
                    onChange={(event) =>
                      setAutomationBuilder((draft) => ({ ...draft, customPrompt: event.target.value }))
                    }
                    placeholder="Optional guidance to apply to every selected item"
                    className="min-h-[90px]"
                  />
                </div>

                {estimateBlocked && automationEstimate && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    The next run needs {requiredCredits} credits. Current balance is {automationEstimate.userCredits}. Projected future usage is {projectedCredits} credits.
                  </div>
                )}
              </div>
            </div>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button variant="outline" onClick={() => setAutomationConfigOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                strategy &&
                createAutomationsForTasks(
                  strategy,
                  automationReviewTasks,
                  automationBuilder,
                  "Automation set saved"
                )
              }
              disabled={
                !strategy ||
                saving ||
                estimatingAutomation ||
                readySelected.length === 0 ||
                automationBuilder.platforms.length === 0 ||
                estimateBlocked
              }
              className="bg-brand-500 text-white hover:bg-brand-600"
            >
              {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create automation set
            </Button>
          </div>
        </div>
      </FloatingPanel>
    );
  };

  const renderRunConfirmationDialog = () => {
    const preview = runPreview;
    const automation = runConfirmAutomation;
    const channelLabels =
      preview?.automation.platforms.map((platform) => {
        const option = automationPlatformOptions.find((item) => item.id === platform);
        return option?.label || platform;
      }) || [];

    return (
      <FloatingPanel
        open={!!automation}
        onOpenChange={(open) => {
          if (!open && runningId !== automation?.id) {
            setRunConfirmAutomation(null);
            setRunPreview(null);
          }
        }}
        title="Confirm Run"
        description="Review the exact job before spending credits"
        icon={<Play className="h-4 w-4" />}
        defaultSize={{ width: 720, height: 700 }}
        defaultPosition={{ x: 180, y: 100 }}
        minSize={{ width: 520, height: 380 }}
        contentClassName="space-y-4"
      >

          {loadingRunPreview ? (
            <div className="flex min-h-[220px] items-center justify-center rounded-xl border">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <AISpinner className="h-5 w-5 text-brand-500" />
                Loading run details
              </div>
            </div>
          ) : preview && automation ? (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{preview.automation.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{preview.result}</p>
                  </div>
                  <Badge variant={preview.hasEnoughCredits ? "default" : "destructive"}>
                    {preview.creditCost} credits
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">What will be created</p>
                  <p className="mt-1 text-sm font-medium">
                    One AI-generated scheduled post draft
                    {preview.automation.includeMedia
                      ? ` with ${preview.automation.mediaType || "media"}`
                      : ""}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Scheduled for</p>
                  <p className="mt-1 text-sm font-medium">
                    {new Date(preview.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Channels</p>
                  <p className="mt-1 text-sm font-medium">
                    {channelLabels.length ? channelLabels.join(", ") : "No connected destination selected"}
                  </p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground">Credit balance</p>
                  <p className={cn("mt-1 text-sm font-medium", !preview.hasEnoughCredits && "text-destructive")}>
                    {preview.userCredits} available
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-3 text-sm">
                <p className="font-medium">Generation brief</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {preview.automation.aiPrompt || preview.automation.topic || "Write an engaging social media post."}
                </p>
                {preview.automation.linkedTask && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Linked plan item: {preview.automation.linkedTask.title}
                  </p>
                )}
              </div>

              {!preview.hasEnoughCredits && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  This run needs {preview.creditCost} credits, but the account has {preview.userCredits}.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Run details could not be loaded.
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button
              variant="outline"
              onClick={() => {
                setRunConfirmAutomation(null);
                setRunPreview(null);
              }}
              disabled={!!automation && runningId === automation.id}
            >
              Cancel
            </Button>
            <Button
              onClick={() => automation && runAutomation(automation)}
              disabled={
                !automation ||
                !preview ||
                !preview.hasEnoughCredits ||
                loadingRunPreview ||
                runningId === automation.id
              }
              className="bg-brand-500 text-white hover:bg-brand-600"
            >
              {automation && runningId === automation.id ? (
                <AISpinner className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Confirm and run
            </Button>
          </div>
      </FloatingPanel>
    );
  };

  const renderFloatingPanels = () => (
    <>
      <FloatingPanel
        open={strategyBuilderOpen}
        onOpenChange={setStrategyBuilderOpen}
        title={strategyBuilderMode === "improve" && strategy ? "Improve Strategy" : "Create Strategy"}
        description={
          strategyBuilderMode === "improve" && strategy
            ? "Make the active plan automation-ready"
            : "Brand identity to plan in one click"
        }
        icon={strategyBuilderMode === "improve" && strategy ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        defaultSize={{ width: 560, height: 720 }}
        defaultPosition={{ x: 92, y: 86 }}
      >
        {renderStrategyBuilderPanel()}
      </FloatingPanel>

      <FloatingPanel
        open={workspacePanelOpen && inspectorMode !== "summary"}
        onOpenChange={(open) => {
          if (!open) closeInspector();
          else setWorkspacePanelOpen(true);
        }}
        title={inspectorMode === "task" ? "Plan Item" : "Automation"}
        description={inspectorMode === "task" ? "Plan item controls" : "Single automation controls"}
        icon={inspectorMode === "task" ? <Target className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        defaultSize={{ width: 500, height: 680 }}
        defaultPosition={{ x: 220, y: 96 }}
        contentClassName="p-0"
      >
        {renderInspector()}
      </FloatingPanel>
    </>
  );

  const renderConfirmActionDialog = () => {
    const target = confirmTarget;
    const title =
      target?.kind === "delete-task"
        ? "Delete plan item?"
        : target?.kind === "delete-automation"
          ? "Delete automation?"
          : "Cancel active automations?";
    const description =
      target?.kind === "delete-task"
        ? `This will remove "${target.name}" from the strategy plan. This action cannot be undone.`
        : target?.kind === "delete-automation"
          ? `This will permanently delete "${target.name}" and stop its future scheduled runs.`
          : `This will turn off ${target?.count || 0} active automation${target?.count === 1 ? "" : "s"} for this strategy. The saved automation cards will remain so they can be edited or enabled later.`;
    const actionLabel =
      target?.kind === "cancel-automations" ? "Cancel automations" : "Delete";

    return (
      <AlertDialog open={!!target} onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingAction}
              disabled={saving}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              {actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-2xl border bg-card">
        <div className="flex items-center gap-3 text-muted-foreground">
          <AISpinner className="h-5 w-5 text-brand-500" />
          Loading workspace
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-center gap-3 p-5">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm">{error}</p>
          <Button variant="outline" className="ml-auto" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!strategy) {
    return (
      <>
        <div className="grid min-h-[620px] place-items-center rounded-2xl border bg-card p-6">
          <div className="w-full max-w-xl rounded-2xl border bg-background p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-500/10 p-3 text-brand-600">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">Create a strategy</p>
                <p className="text-sm text-muted-foreground">
                  Strategy items and automations live in one workspace.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Input
                value={newStrategyName}
                onChange={(event) => setNewStrategyName(event.target.value)}
                placeholder="Plan name"
              />
              <Button onClick={createStrategy} disabled={saving} className="bg-brand-500 text-white hover:bg-brand-600">
                {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-1">
              <Button onClick={() => openStrategyBuilder("create")} variant="outline" className="justify-start">
                <Sparkles className="mr-2 h-4 w-4" />
                Create a strategy with FlowAI
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-end text-sm">
              <Link href="/content/schedule" className="text-muted-foreground hover:text-foreground">
                Open calendar
              </Link>
            </div>
          </div>
        </div>
        {renderFloatingPanels()}
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border bg-card shadow-sm"
      >
      <div className="flex flex-col gap-2 border-b bg-background/95 p-2 sm:p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="flex max-w-full items-center gap-2 rounded-xl border bg-muted/30 px-2 py-2 sm:px-3">
            <Target className="h-3.5 w-3.5 shrink-0 text-brand-500 sm:h-4 sm:w-4" />
            <span className="max-w-[170px] truncate text-xs font-semibold sm:max-w-[260px] sm:text-sm">{strategy.name}</span>
          </div>
          <SegmentedButton active={view === "plan"} onClick={() => setView("plan")} icon={Target}>
            Plan
          </SegmentedButton>
          <SegmentedButton active={view === "automations"} onClick={() => setView("automations")} icon={Zap}>
            Automations
          </SegmentedButton>
          <SegmentedButton active={view === "sync"} onClick={() => setView("sync")} icon={Activity}>
            Sync
          </SegmentedButton>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button variant="outline" onClick={() => openStrategyBuilder("create")} className="h-9 px-2 text-xs sm:px-3 sm:text-sm" title="Create Strategy">
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Create strategy</span>
          </Button>
          <Button variant="outline" onClick={() => openStrategyBuilder("improve")} className="h-9 px-2 text-xs sm:px-3 sm:text-sm" title="Improve strategy">
            <Wand2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Improve strategy</span>
          </Button>
          {!upcomingOpen && (
            <Button variant="outline" onClick={() => setUpcomingOpen(true)} className="h-9 px-2 text-xs sm:px-3 sm:text-sm" title="Upcoming">
              <Clock className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Upcoming</span>
            </Button>
          )}
          <Button variant="outline" asChild className="h-9 px-2 text-xs sm:px-3 sm:text-sm" title="Reports">
            <Link href="/content/strategy/reports">
              <BarChart3 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reports</span>
            </Link>
          </Button>
          <Button variant="outline" onClick={() => openNewTask()} className="h-9 px-2 text-xs sm:px-3 sm:text-sm" title="Add item">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Item</span>
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-[820px] gap-0",
          upcomingOpen && "xl:grid-cols-[minmax(0,1fr)_340px]"
        )}
      >
        <main className="min-w-0 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Plan progress" value={`${stats.progress}%`} icon={Target} detail={`${stats.completed}/${tasks.length} done`} />
            <MetricCard label="Active flows" value={stats.activeAutomations.toString()} icon={Zap} detail={`${automations.length} total`} />
            <MetricCard label="Matched activity" value={stats.matched.toString()} icon={Link2} detail={`Synced ${formatTimeAgo(strategy.lastActivitySync)}`} />
            <MetricCard label="Generated posts" value={stats.generated.toString()} icon={Copy} detail={`${stats.automated} items connected`} />
          </div>

          {view === "plan" && renderPlanView()}
          {view === "automations" && renderAutomationView()}
          {view === "sync" && renderSyncView()}
        </main>

        {upcomingOpen && (
          <aside className="border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
            <UpcomingItemsPanel strategy={strategy} onClose={() => setUpcomingOpen(false)} />
          </aside>
        )}
      </div>
      </motion.div>
      {renderFloatingPanels()}
      {renderReadinessDialog()}
      {renderAutomationConfigDialog()}
      {renderRunConfirmationDialog()}
      {renderConfirmActionDialog()}
    </>
  );
}

function SegmentedButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-2 text-xs font-medium transition sm:h-10 sm:gap-2 sm:px-3 sm:text-sm",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      title={typeof children === "string" ? children : undefined}
    >
      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <div className="rounded-lg bg-brand-500/10 p-2 text-brand-600">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function InspectorShell({
  title,
  subtitle,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-500/10 p-2 text-brand-600">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-4">{children}</div>
    </div>
  );
}

function UpcomingItemsPanel({
  strategy,
  onClose,
}: {
  strategy: Strategy;
  onClose: () => void;
}) {
  const dueSoon = strategy.tasks
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-500" />
            Next items
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[min(520px,calc(100vh-260px))] space-y-2 overflow-y-auto pr-1">
        {dueSoon.length > 0 ? (
          dueSoon.map((task) => (
            <div key={task.id} className="rounded-xl border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{task.title}</p>
                <Badge variant="outline">{formatShortDate(task.dueDate)}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {taskProgress(task)}% complete
              </p>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Add due dates to see upcoming work here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
