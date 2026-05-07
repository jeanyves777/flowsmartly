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
  Link2,
  Mail,
  MoreHorizontal,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { useToast } from "@/hooks/use-toast";
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
  goals: string;
  timeframe: Timeframe;
  focusAreas: TaskCategory[];
  platforms: string[];
  additionalContext: string;
  competitorInfo: string;
  budget: string;
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
  userCredits: number;
  hasEnoughCredits: boolean;
  totalPosts: number;
  automatableTasks: Array<{
    taskId: string;
    title: string;
    type?: string;
    requirements?: string[];
    warnings?: string[];
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

const TONE_OPTIONS = ["professional", "friendly", "confident", "educational", "playful"];

const BRAND_HANDLE_PLATFORM: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

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
  platforms: ["feed"],
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
  platforms: ["feed"],
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

function buildBrandGoal(brand: BrandSnapshot | null) {
  if (!brand) {
    return "Build a complete marketing strategy from my saved brand identity. Prioritize brand awareness, lead generation, content cadence, email follow-up, and automation-ready tasks.";
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

  return `Build a complete marketing strategy for ${brand.name} from the saved brand identity. Create practical content, social, email, ads, analytics, and automation-ready tasks.${details ? `\n\n${details}` : ""}`;
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
    platforms: automation.platforms?.length ? automation.platforms : ["feed"],
    includeMedia: automation.includeMedia,
    mediaType: automation.mediaType === "video" ? "video" : "image",
    mediaStyle: automation.mediaStyle || "",
    startDate: automation.startDate?.slice(0, 10) || DEFAULT_AUTOMATION.startDate,
    endDate: automation.endDate?.slice(0, 10) || DEFAULT_AUTOMATION.endDate,
    strategyTaskId: automation.strategyTaskId || "",
  };
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
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<"summary" | "task" | "automation">("summary");
  const [workspacePanelOpen, setWorkspacePanelOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [strategyBuilderOpen, setStrategyBuilderOpen] = useState(false);
  const [automationBuilderOpen, setAutomationBuilderOpen] = useState(false);
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
  const [newStrategyName, setNewStrategyName] = useState("90-day content operating plan");

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
  const selectedTask = selectedTaskId
    ? tasks.find((task) => task.id === selectedTaskId) || null
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
  const connectedPlatformKeys = useMemo(
    () => connectedPlatforms.map((platform) => platform.platform),
    [connectedPlatforms]
  );
  const automationPlatformOptions = useMemo(() => {
    const connected = connectedPlatforms.map((platform) => ({
      id: platform.platform,
      label: platform.displayName || platform.name,
      detail: platform.username || platform.name,
    }));
    return [{ id: "feed", label: "Feed", detail: "FlowSmartly" }, ...connected];
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
      }),
    [automationBuilder, connectedPlatformKeys, marketingReadiness.emailReady, marketingReadiness.smsReady]
  );
  const qualifiedAutomationTasks = useMemo(
    () => readyToAutomate.filter((task) => getTaskReadiness(task, automationBuilder).qualified),
    [automationBuilder, getTaskReadiness, readyToAutomate]
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
      blockedBySetup: blocked.length,
      blockers,
    };
  }, [automationBuilder, getTaskReadiness, tasks]);

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
    setSelectedTaskId(null);
    setSelectedAutomationId(null);
    setInspectorMode("summary");
    setWorkspacePanelOpen(false);
    setAutomationBuilder((draft) => ({
      ...draft,
      selectedTaskIds: task ? [task.id] : readyToAutomate.map((item) => item.id),
      platforms: draft.platforms.filter((platform) =>
        automationPlatformOptions.some((option) => option.id === platform)
      ).length
        ? draft.platforms.filter((platform) =>
            automationPlatformOptions.some((option) => option.id === platform)
          )
        : ["feed"],
      customPrompt: task ? [task.title, task.description].filter(Boolean).join("\n\n") : draft.customPrompt,
      includeMedia:
        task && ["visual", "video"].includes(getTaskReadiness(task, draft).type)
          ? true
          : draft.includeMedia,
      mediaType: task && getTaskReadiness(task, draft).type === "video" ? "video" : draft.mediaType,
      endDate: task?.dueDate?.slice(0, 10) || draft.endDate || getDefaultAutomationEndDate(),
    }));
    setView("automations");
    setAutomationBuilderOpen(true);
  };

  const closeInspector = () => {
    setSelectedTaskId(null);
    setSelectedAutomationId(null);
    setInspectorMode("summary");
    setWorkspacePanelOpen(false);
    setTaskDraft(DEFAULT_TASK);
    setAutomationDraft(DEFAULT_AUTOMATION);
  };

  const openStrategyBuilder = () => {
    setStrategyBuilder((draft) => ({
      ...draft,
      goals:
        draft.goals ||
        (strategy
          ? `Improve "${strategy.name}" so the open plan items become automation-ready while keeping completed and already automated work intact.`
          : ""),
      platforms: draft.platforms.length
        ? draft.platforms
        : activeBrandPlatforms.length
        ? activeBrandPlatforms
        : DEFAULT_STRATEGY_BUILDER.platforms,
    }));
    setStrategyBuilderOpen(true);
  };

  const openAutomationBuilder = () => {
    setAutomationBuilder((draft) => ({
      ...draft,
      selectedTaskIds: readyToAutomate.map((task) => task.id),
      platforms: draft.platforms.filter((platform) =>
        automationPlatformOptions.some((option) => option.id === platform)
      ).length
        ? draft.platforms.filter((platform) =>
            automationPlatformOptions.some((option) => option.id === platform)
          )
        : ["feed"],
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

  const toggleStrategyFocus = (category: TaskCategory) => {
    setStrategyBuilder((draft) => ({
      ...draft,
      focusAreas: draft.focusAreas.includes(category)
        ? draft.focusAreas.filter((item) => item !== category)
        : [...draft.focusAreas, category],
    }));
  };

  const toggleStrategyPlatform = (platform: string) => {
    setStrategyBuilder((draft) => ({
      ...draft,
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
    const validationResults = selectedCandidates.map((task) => ({
      task,
      readiness: getTaskReadiness(task, options),
    }));
    const selectedTasks = validationResults
      .filter((item) => item.readiness.qualified)
      .map((item) => item.task);
    const blocked = validationResults.filter((item) => !item.readiness.qualified);

    if (selectedTasks.length === 0) {
      toast({
        title: "No automation-ready items",
        description:
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
      const estimateRes = await fetch("/api/content/strategy/automate/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: sourceStrategy.id,
          taskIds: selectedTasks.map((task) => task.id),
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
      if (!estimate.hasEnoughCredits) {
        throw new Error(
          `Not enough credits. Required: ${estimate.totalCredits}, Available: ${estimate.userCredits}`
        );
      }

      const taskConfigs = selectedTasks.map((task) => ({
        taskId: task.id,
        enabled: true,
        includeMedia: options.includeMedia,
        mediaType: options.mediaType,
        mediaStyle: options.mediaStyle,
        frequency: options.frequency,
        dayOfWeek: options.dayOfWeek,
        time: options.time,
        customPrompt: [options.customPrompt, task.title, task.description]
          .filter(Boolean)
          .join("\n\n"),
      }));

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
      toast({
        title: successTitle,
        description: `${json.data.automatedTaskCount || 0} task${json.data.automatedTaskCount === 1 ? "" : "s"} connected. ${json.data.creditEstimate?.totalCredits || estimate.totalCredits} credits validated for scheduled AI runs.`,
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
      if (strategy) {
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

  const deleteTask = async () => {
    if (!taskDraft.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/strategy/tasks?id=${taskDraft.id}`, {
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

  const deleteAutomationById = async (automationId: string, automationName?: string) => {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm(`Delete automation${automationName ? ` "${automationName}"` : ""}?`);
    if (!confirmed) return;

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
    await deleteAutomationById(automationDraft.id, automationDraft.name);
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
  }, [automationBuilder, automationBuilderOpen, strategy]);

  const renderTaskCard = (task: StrategyTask) => {
    const category = normalizeTaskCategory(task.category);
    const categoryInfo = CATEGORY_CONFIG[category];
    const PriorityDot = PRIORITY_CONFIG[task.priority || "MEDIUM"];
    const matches = parseMatches(task.matchedActivities);
    const isSelected = selectedTaskId === task.id;
    const Icon = categoryInfo.icon;

    return (
      <div
        key={task.id}
        role="button"
        tabIndex={0}
        onClick={() => openTask(task)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTask(task);
          }
        }}
        className={cn(
          "w-full rounded-xl border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          isSelected && "border-brand-500 ring-2 ring-brand-500/20"
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
              <MoreHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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

        <div className="mt-3 flex gap-1.5">
          {STATUS_COLUMNS.filter((column) => column.id !== task.status).map((column) => (
            <span
              key={column.id}
              role="button"
              tabIndex={0}
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
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderPlanView = () => (
    <div className="grid gap-3 lg:grid-cols-3">
      {STATUS_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.id);
        return (
          <div
            key={column.id}
            className={cn("flex h-[min(900px,calc(100vh-250px))] min-h-[540px] flex-col rounded-2xl border p-3", column.tone)}
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
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {columnTasks.length > 0 ? (
                columnTasks.map(renderTaskCard)
              ) : (
                <button
                  onClick={() => openNewTask(column.id)}
                  className="flex h-28 w-full items-center justify-center rounded-xl border border-dashed bg-background/60 text-sm text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add item
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
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
            <Button variant="outline" onClick={() => setAutomationBuilderOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Close setup
            </Button>
          ) : (
            <>
              <Button
                onClick={openAutomationBuilder}
                disabled={tasks.length === 0}
                className="bg-brand-500 text-white hover:bg-brand-600"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI build flows
              </Button>
              <Button variant="outline" onClick={() => openNewAutomation()}>
                <Plus className="mr-2 h-4 w-4" />
                Configure flow
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
                        deleteAutomationById(automation.id, automation.name);
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
      return (
        <InspectorShell
          title={taskDraft.id ? "Edit item" : "New item"}
          subtitle={taskDraft.id ? "Plan item details" : "Add to the current plan"}
          icon={Target}
          onClose={closeInspector}
        >
          <div className="space-y-4">
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
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Automate
                </Button>
              )}
            </div>
            {taskDraft.id && (
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={deleteTask}>
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
        title={automationDraft.id ? "Edit automation" : "New automation"}
        subtitle="Connect content generation to a plan item"
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
            <div className="grid grid-cols-2 gap-2">
              {automationPlatformOptions.map((platform) => {
                const selected = automationDraft.platforms.includes(platform.id);
                return (
                  <button
                    key={platform.id}
                    onClick={() =>
                      setAutomationDraft((draft) => ({
                        ...draft,
                        platforms: selected
                          ? draft.platforms.filter((id) => id !== platform.id)
                          : [...draft.platforms, platform.id],
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-xs",
                      selected
                        ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    <span className="block font-medium">{platform.label}</span>
                    <span className="block text-muted-foreground">{platform.detail}</span>
                  </button>
                );
              })}
            </div>
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
    const isImprove = !!strategy;

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
            setStrategyBuilder((draft) => ({ ...draft, goals: event.target.value }))
          }
          placeholder={
            isImprove
              ? "Make this plan automation-ready for recurring posts, email, and connected channels"
              : brand
              ? `Build a plan for ${brand.name}`
              : "Build a plan from my brand identity"
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
          {isImprove ? "Improve active strategy" : "Build from brand"}
        </Button>
      </div>
    </div>
    );
  };

  const renderAutomationBuilderPanel = () => {
    const validationRows = readyToAutomate.map((task) => ({
      task,
      readiness: getTaskReadiness(task, automationBuilder),
      selected: automationBuilder.selectedTaskIds.includes(task.id),
    }));
    const selectedRows = validationRows.filter((row) => row.selected);
    const readySelected = selectedRows.filter((row) => row.readiness.qualified);
    const blockedSelected = selectedRows.filter((row) => !row.readiness.qualified);
    const estimateBlocked = !!automationEstimate && !automationEstimate.hasEnoughCredits;

    return (
      <div className="rounded-2xl border bg-background">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-base font-semibold">AI automation setup</p>
            <p className="text-sm text-muted-foreground">
              {readySelected.length} ready, {blockedSelected.length} blocked, {automationEstimate?.totalCredits ?? 0} credits estimated
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAutomationBuilder((draft) => ({
                  ...draft,
                  selectedTaskIds: readyToAutomate.map((task) => task.id),
                }))
              }
              disabled={readyToAutomate.length === 0}
            >
              All items
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAutomationBuilder((draft) => ({ ...draft, selectedTaskIds: [] }))}
              disabled={readyToAutomate.length === 0}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="min-w-0 space-y-4 p-4">
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
                <p className="text-xs text-muted-foreground">Credits</p>
                <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                  {estimatingAutomation ? <AISpinner size={24} /> : automationEstimate?.totalCredits ?? 0}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className={cn("mt-1 text-2xl font-bold", estimateBlocked && "text-destructive")}>
                  {automationEstimate?.userCredits ?? "-"}
                </p>
              </div>
            </div>

            <div className="h-[min(610px,calc(100vh-420px))] min-h-[360px] overflow-y-auto rounded-xl border p-2">
              {validationRows.length > 0 ? (
                validationRows.map(({ task, readiness, selected }) => {
                  const category = normalizeTaskCategory(task.category);
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
                              readiness.qualified
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            )}
                          >
                            {readiness.qualified ? "ready" : "needs setup"}
                          </span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                            {readiness.type}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs capitalize text-muted-foreground">{category}</span>
                        {(readiness.blockers.length > 0 || readiness.requirements.length > 0 || readiness.warnings.length > 0) && (
                          <span className="mt-2 block space-y-1 text-xs">
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
                    <Button onClick={openStrategyBuilder} className="bg-brand-500 text-white hover:bg-brand-600">
                      <Sparkles className="mr-2 h-4 w-4" />
                      Improve strategy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
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
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                      <SelectItem key={tone} value={tone} className="capitalize">
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
              <div className="grid grid-cols-1 gap-2">
                {automationPlatformOptions.map((platform) => {
                  const selected = automationBuilder.platforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      onClick={() => toggleAutomationPlatform(platform.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-xs",
                        selected
                          ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-300"
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      <span className="block font-medium">{platform.label}</span>
                      <span className="block text-muted-foreground">{platform.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
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

            <div className="space-y-2">
              <Label>FlowAI direction</Label>
              <Textarea
                value={automationBuilder.customPrompt}
                onChange={(event) =>
                  setAutomationBuilder((draft) => ({ ...draft, customPrompt: event.target.value }))
                }
                placeholder="Optional guidance to apply to every selected item"
                className="min-h-[110px]"
              />
            </div>

            {estimateBlocked && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Need {automationEstimate.totalCredits} credits. Current balance is {automationEstimate.userCredits}.
              </div>
            )}

            <Button
              onClick={() => strategy && createAutomationsForTasks(strategy, readyToAutomate, automationBuilder)}
              disabled={
                !strategy ||
                saving ||
                readySelected.length === 0 ||
                automationBuilder.platforms.length === 0 ||
                estimateBlocked
              }
              className="w-full bg-brand-500 text-white hover:bg-brand-600"
            >
              {saving ? <AISpinner className="mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create validated AI automations
            </Button>
          </div>
        </div>
      </div>
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
      <Dialog
        open={!!automation}
        onOpenChange={(open) => {
          if (!open && runningId !== automation?.id) {
            setRunConfirmAutomation(null);
            setRunPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm automation run</DialogTitle>
            <DialogDescription>
              Review the exact job before FlowSmartly generates content and spends credits.
            </DialogDescription>
          </DialogHeader>

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
                    {channelLabels.length ? channelLabels.join(", ") : "Feed"}
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

          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderFloatingPanels = () => (
    <>
      <FloatingPanel
        open={strategyBuilderOpen}
        onOpenChange={setStrategyBuilderOpen}
        title={strategy ? "Improve Strategy" : "AI Strategy Builder"}
        description={strategy ? "Make the active plan automation-ready" : "Brand identity to plan in one click"}
        icon={strategy ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
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
        title={inspectorMode === "task" ? "Plan Item" : "Automation Form"}
        description={inspectorMode === "task" ? "Plan item controls" : "Automation controls"}
        icon={inspectorMode === "task" ? <Target className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        defaultSize={{ width: 500, height: 680 }}
        defaultPosition={{ x: 220, y: 96 }}
        contentClassName="p-0"
      >
        {renderInspector()}
      </FloatingPanel>
    </>
  );

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
                <p className="font-semibold">Create the operating plan</p>
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
              <Button onClick={openStrategyBuilder} variant="outline" className="justify-start">
                <Sparkles className="mr-2 h-4 w-4" />
                Build with FlowAI
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
      <div className="flex flex-col gap-3 border-b bg-background/95 p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
            <Target className="h-4 w-4 text-brand-500" />
            <span className="max-w-[260px] truncate text-sm font-semibold">{strategy.name}</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openStrategyBuilder}>
            <Wand2 className="mr-2 h-4 w-4" />
            Improve strategy
          </Button>
          {!upcomingOpen && (
            <Button variant="outline" onClick={() => setUpcomingOpen(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Upcoming
            </Button>
          )}
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            {syncing ? <AISpinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync
          </Button>
          <Button variant="outline" onClick={() => openNewTask()}>
            <Plus className="mr-2 h-4 w-4" />
            Item
          </Button>
          <Button variant="outline" onClick={() => openNewAutomation()}>
            <Wand2 className="mr-2 h-4 w-4" />
            Automation
          </Button>
          <Button
            onClick={openAutomationBuilder}
            disabled={saving || tasks.length === 0}
            className="bg-brand-500 text-white hover:bg-brand-600"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI automate {qualifiedAutomationTasks.length || ""}
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
      {renderRunConfirmationDialog()}
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
        "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
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
