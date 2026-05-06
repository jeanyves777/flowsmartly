"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Rss,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Wand2,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TaskCategory = "content" | "social" | "ads" | "email" | "analytics";
type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
type ViewMode = "plan" | "automations" | "sync";

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
  category: TaskCategory | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  autoCompleted: boolean;
  progress: number;
  matchedActivities: string;
  automationStatus?: string;
  automationId?: string | null;
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

const PLATFORM_OPTIONS = [
  { id: "feed", label: "Feed" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
];

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

function parseMatches(raw: string): MatchedActivity[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    category: task.category || "content",
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
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [inspectorMode, setInspectorMode] = useState<"summary" | "task" | "automation">("summary");
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(DEFAULT_TASK);
  const [automationDraft, setAutomationDraft] = useState<AutomationDraft>(DEFAULT_AUTOMATION);
  const [newStrategyName, setNewStrategyName] = useState("90-day content operating plan");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [strategyRes, automationRes] = await Promise.all([
        fetch("/api/content/strategy"),
        fetch("/api/content/automation"),
      ]);
      const [strategyJson, automationJson] = await Promise.all([
        strategyRes.json(),
        automationRes.json(),
      ]);

      if (!strategyRes.ok || !strategyJson.success) {
        throw new Error(strategyJson.error?.message || "Failed to load strategy");
      }
      if (!automationRes.ok || !automationJson.success) {
        throw new Error(automationJson.error?.message || "Failed to load automations");
      }

      setStrategy(strategyJson.data?.strategy || null);
      setAutomations(automationJson.data?.automations || []);
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
        const category = task.category || "content";
        return (
          task.status !== "DONE" &&
          !task.automationId &&
          task.automationStatus !== "AUTOMATED" &&
          ["content", "social", "email"].includes(category)
        );
      }),
    [tasks]
  );

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
  };

  const openNewTask = (status: TaskStatus = "TODO") => {
    setSelectedAutomationId(null);
    setSelectedTaskId(null);
    setInspectorMode("task");
    setTaskDraft({ ...DEFAULT_TASK, status });
  };

  const openAutomation = (automation: Automation) => {
    setSelectedAutomationId(automation.id);
    setSelectedTaskId(null);
    setInspectorMode("automation");
    setAutomationDraft(automationToDraft(automation));
  };

  const openNewAutomation = (task?: StrategyTask) => {
    const base = { ...DEFAULT_AUTOMATION };
    if (task) {
      base.name = `${task.title} content flow`;
      base.topic = task.title;
      base.aiPrompt = [task.title, task.description].filter(Boolean).join("\n");
      base.strategyTaskId = task.id;
      if (task.startDate) base.startDate = task.startDate.slice(0, 10);
      if (task.dueDate) base.endDate = task.dueDate.slice(0, 10);
    }
    setSelectedTaskId(null);
    setSelectedAutomationId(null);
    setInspectorMode("automation");
    setAutomationDraft(base);
    setView("automations");
  };

  const closeInspector = () => {
    setSelectedTaskId(null);
    setSelectedAutomationId(null);
    setInspectorMode("summary");
    setTaskDraft(DEFAULT_TASK);
    setAutomationDraft(DEFAULT_AUTOMATION);
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

  const deleteAutomation = async () => {
    if (!automationDraft.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/automation?id=${automationDraft.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation was not deleted");
      closeInspector();
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

  const runAutomation = async (automation: Automation) => {
    setRunningId(automation.id);
    try {
      const res = await fetch(`/api/content/automation/${automation.id}/run`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automation run failed");
      await loadData();
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

  const launchReadyTasks = async () => {
    if (!strategy || readyToAutomate.length === 0) return;
    setSaving(true);
    try {
      const taskConfigs = readyToAutomate.map((task) => ({
        taskId: task.id,
        enabled: true,
        includeMedia: false,
        mediaType: "image",
        mediaStyle: "",
        frequency: "WEEKLY",
        dayOfWeek: 1,
        time: "09:00",
        customPrompt: [task.title, task.description].filter(Boolean).join("\n"),
      }));
      const endDate = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return d.toISOString().slice(0, 10);
      })();
      const res = await fetch("/api/content/strategy/automate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy.id,
          taskConfigs,
          globalTone: "professional",
          globalEndDate: endDate,
          platforms: ["feed"],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Automations were not launched");
      await loadData();
      setView("automations");
      toast({
        title: "Automations launched",
        description: `${json.data.automatedTaskCount || 0} task${json.data.automatedTaskCount === 1 ? "" : "s"} connected`,
      });
    } catch (err) {
      toast({
        title: "Automations were not launched",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderTaskCard = (task: StrategyTask) => {
    const category = task.category || "content";
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
            <span>{task.progress}% complete</span>
            <span>{matches.length} match{matches.length === 1 ? "" : "es"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
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
            className={cn("flex min-h-[520px] flex-col rounded-2xl border p-3", column.tone)}
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
            <div className="flex-1 space-y-2">
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

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Last run: {formatTimeAgo(automation.lastTriggered)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={(event) => {
                    event.stopPropagation();
                    runAutomation(automation);
                  }}
                  disabled={runningId === automation.id}
                >
                  {runningId === automation.id ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Run
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {automations.length === 0 && (
        <button
          onClick={() => openNewAutomation()}
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
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
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
              {PLATFORM_OPTIONS.map((platform) => {
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
                    {platform.label}
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
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
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

  if (loading) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-2xl border bg-card">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
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
      <div className="grid min-h-[620px] place-items-center rounded-2xl border bg-card p-6">
        <div className="w-full max-w-xl rounded-2xl border bg-background p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-500/10 p-3 text-brand-600">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Create the operating plan</p>
              <p className="text-sm text-muted-foreground">
                Strategy items and automations now live in one workspace.
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
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm">
            <Link href="/content/strategy/generate" className="text-brand-600 hover:underline">
              Generate with FlowAI
            </Link>
            <Link href="/content/schedule" className="text-muted-foreground hover:text-foreground">
              Open calendar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
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
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
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
            onClick={launchReadyTasks}
            disabled={saving || readyToAutomate.length === 0}
            className="bg-brand-500 text-white hover:bg-brand-600"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-sync {readyToAutomate.length || ""}
          </Button>
        </div>
      </div>

      <div className="grid min-h-[720px] gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
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

        <aside className="border-t bg-muted/20 p-4 xl:border-l xl:border-t-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${inspectorMode}-${selectedTaskId || "task-new"}-${selectedAutomationId || "automation-new"}-${view}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {inspectorMode !== "summary" ? (
                renderInspector()
              ) : (
                <WorkspaceSummary
                  strategy={strategy}
                  readyToAutomate={readyToAutomate}
                  onNewTask={() => openNewTask()}
                  onNewAutomation={() => openNewAutomation()}
                  onLaunchReady={launchReadyTasks}
                  saving={saving}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </motion.div>
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

function WorkspaceSummary({
  strategy,
  readyToAutomate,
  onNewTask,
  onNewAutomation,
  onLaunchReady,
  saving,
}: {
  strategy: Strategy;
  readyToAutomate: StrategyTask[];
  onNewTask: () => void;
  onNewAutomation: () => void;
  onLaunchReady: () => void;
  saving: boolean;
}) {
  const dueSoon = strategy.tasks
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-brand-500" />
            Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={onNewTask} variant="outline" className="w-full justify-start">
            <Plus className="mr-2 h-4 w-4" />
            Add plan item
          </Button>
          <Button onClick={onNewAutomation} variant="outline" className="w-full justify-start">
            <Zap className="mr-2 h-4 w-4" />
            Add automation
          </Button>
          <Button
            onClick={onLaunchReady}
            disabled={saving || readyToAutomate.length === 0}
            className="w-full justify-start bg-brand-500 text-white hover:bg-brand-600"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Connect ready items
          </Button>
          <Link href="/content/strategy/reports">
            <Button variant="ghost" className="w-full justify-start">
              <Eye className="mr-2 h-4 w-4" />
              View reports
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-brand-500" />
            Next items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dueSoon.length > 0 ? (
            dueSoon.map((task) => (
              <div key={task.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{task.title}</p>
                  <Badge variant="outline">{formatShortDate(task.dueDate)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.progress}% complete
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
    </div>
  );
}
