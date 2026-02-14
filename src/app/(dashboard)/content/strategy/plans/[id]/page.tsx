"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  GripVertical,
  Target,
  Sparkles,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit2,
  X,
  AlertTriangle,
  RefreshCw,
  Save,
  Activity,
  ExternalLink,
  ListChecks,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Types ---

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
type TaskCategory = "content" | "social" | "ads" | "email" | "analytics";
type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

interface StrategyTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  category: TaskCategory;
  priority: TaskPriority;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  sortOrder: number;
  createdAt: string;
  autoCompleted: boolean;
  progress: number;
  matchedActivities: string;
}

interface StrategyDetail {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  aiGenerated: boolean;
  totalTasks: number;
  completedTasks: number;
  tasks: StrategyTask[];
  createdAt: string;
  updatedAt: string;
}

interface TaskFormData {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
}

interface ParsedActivity {
  activityType: string;
  activityId: string;
  activityName?: string;
  activityUrl?: string;
  matchedAt: string;
  confidence: "low" | "medium" | "high";
  matchReason: string;
}

// --- Constants ---

const CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; color: string; bgColor: string }
> = {
  content: {
    label: "Content",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  social: {
    label: "Social",
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
  ads: {
    label: "Ads",
    color: "text-orange-600",
    bgColor: "bg-orange-500/10 border-orange-500/20",
  },
  email: {
    label: "Email",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  analytics: {
    label: "Analytics",
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
  },
};

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; dotColor: string }
> = {
  HIGH: { label: "High", dotColor: "bg-red-500" },
  MEDIUM: { label: "Medium", dotColor: "bg-yellow-500" },
  LOW: { label: "Low", dotColor: "bg-green-500" },
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  TODO: { label: "To Do", icon: Circle, color: "text-gray-400" },
  IN_PROGRESS: { label: "In Progress", icon: Clock, color: "text-orange-500" },
  DONE: { label: "Done", icon: CheckCircle2, color: "text-green-500" },
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: "TODO",
};

const CATEGORY_ACTIVITY_HINT: Record<TaskCategory, string> = {
  email: "email campaigns or email automations",
  social: "social media posts",
  content: "content posts or post automations",
  ads: "promoted posts or ad campaigns",
  analytics: "strategy reports",
};

function getTaskRequirement(task: { title: string; description?: string | null; category: TaskCategory }): string {
  if (task.description) return task.description;
  const hint = CATEGORY_ACTIVITY_HINT[task.category];
  return `Complete "${task.title}" by creating relevant ${hint}.`;
}

function getWhatsLeft(
  task: { progress: number; category: TaskCategory; startDate?: string; dueDate?: string },
  activities: ParsedActivity[]
): { items: string[]; summary: string } {
  const items: string[] = [];

  if (task.progress >= 100) {
    return { items: [], summary: "All requirements met!" };
  }

  const doneByType: Record<string, number> = {};
  for (const a of activities) {
    doneByType[a.activityType] = (doneByType[a.activityType] || 0) + 1;
  }

  const bestConfidence = activities.length > 0
    ? activities.reduce((best, a) => {
        const order = { high: 3, medium: 2, low: 1 };
        return order[a.confidence] > order[best] ? a.confidence : best;
      }, "low" as "low" | "medium" | "high")
    : null;

  if (activities.length === 0) {
    items.push(`No ${CATEGORY_ACTIVITY_HINT[task.category]} detected yet`);
    items.push("Create matching activities to start making progress");
  } else {
    const doneList = Object.entries(doneByType).map(([type, count]) => {
      const labels: Record<string, string> = {
        post: "post", campaign: "campaign", automation: "automation",
        postAutomation: "post automation", adCampaign: "ad campaign",
      };
      return `${count} ${labels[type] || type}${count > 1 ? "s" : ""}`;
    });
    if (doneList.length > 0) {
      items.push(`Matched: ${doneList.join(", ")}`);
    }

    if (bestConfidence === "low") {
      items.push("Keywords in your activities don\u2019t closely match the task title \u2014 use more relevant terms");
    }
    if (bestConfidence !== "high") {
      if (!task.startDate && !task.dueDate) {
        items.push("Add start/due dates to this task for time-based matching");
      } else {
        items.push("Schedule activities within the task\u2019s date range for full auto-completion");
      }
    }
  }

  const pctLeft = 100 - task.progress;
  const summary = task.progress > 0
    ? `${pctLeft}% remaining to auto-complete`
    : "Not started \u2014 create matching activities";

  return { items, summary };
}

const DEFAULT_TASK_FORM: TaskFormData = {
  title: "",
  description: "",
  category: "content",
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
};

// --- Helpers ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --- Sortable Task Row ---

function SortableTaskRow({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  task: StrategyTask;
  onEdit: (task: StrategyTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const categoryInfo = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.content;
  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
  const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO;
  const StatusIcon = statusInfo.icon;

  // Parse matched activities for tooltip
  const parsedActivities = (() => {
    if (!task.matchedActivities) return null;
    try {
      return JSON.parse(task.matchedActivities);
    } catch {
      return null;
    }
  })();

  const showProgress = task.progress > 0 && task.status !== "DONE";
  const progressBarColor =
    task.progress >= 50
      ? "bg-green-500"
      : "bg-blue-500";

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group border border-transparent hover:border-border">
        {/* Drag handle */}
        <button
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Status icon — click to cycle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task.id, STATUS_CYCLE[task.status]);
          }}
          className={`shrink-0 ${statusInfo.color} hover:scale-110 transition-transform`}
          title={`${statusInfo.label} — click to change`}
        >
          <StatusIcon className="h-5 w-5" />
        </button>

        {/* Title + progress — click to edit */}
        <button
          onClick={() => onEdit(task)}
          className="flex-1 min-w-0 text-left"
        >
          <span
            className={`text-sm font-medium truncate block ${
              task.status === "DONE"
                ? "line-through text-muted-foreground"
                : ""
            }`}
          >
            {task.title}
          </span>
          {task.description && (
            <span className="text-xs text-muted-foreground truncate block mt-0.5">
              {task.description}
            </span>
          )}

          {/* Progress bar */}
          {showProgress && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressBarColor}`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {task.progress}%
              </span>
            </div>
          )}

          {/* Activity detected indicator */}
          {task.status === "IN_PROGRESS" && task.progress > 0 && (
            <span className="flex items-center gap-1 mt-1 text-[10px] text-orange-500/80">
              <Activity className="h-2.5 w-2.5" />
              Activity detected
            </span>
          )}
        </button>

        {/* Meta */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Auto-matched badge */}
          {task.autoCompleted && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default">
                    Auto-matched
                  </span>
                </TooltipTrigger>
                {parsedActivities && (
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p className="font-medium mb-1">Matched activities:</p>
                    {Array.isArray(parsedActivities) ? (
                      <ul className="list-disc pl-3 space-y-0.5">
                        {parsedActivities.map((a: string, i: number) => (
                          <li key={i}>{typeof a === "string" ? a : JSON.stringify(a)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{JSON.stringify(parsedActivities)}</p>
                    )}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${categoryInfo.bgColor} ${categoryInfo.color} hidden sm:inline-flex`}
          >
            {categoryInfo.label}
          </Badge>
          <div
            className={`h-2 w-2 rounded-full ${priorityInfo.dotColor}`}
            title={`${priorityInfo.label} priority`}
          />
          {task.dueDate && (
            <span className="text-[10px] text-muted-foreground items-center gap-0.5 hidden sm:flex">
              <Calendar className="h-2.5 w-2.5" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Task Row Overlay (for DragOverlay) ---

function TaskRowOverlay({ task }: { task: StrategyTask }) {
  const categoryInfo = CATEGORY_CONFIG[task.category] || CATEGORY_CONFIG.content;
  const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG.TODO;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background border border-orange-500/50 shadow-xl">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
      <span className="text-sm font-medium truncate flex-1">{task.title}</span>
      <Badge
        variant="outline"
        className={`text-[10px] px-1.5 py-0 ${categoryInfo.bgColor} ${categoryInfo.color}`}
      >
        {categoryInfo.label}
      </Badge>
    </div>
  );
}

// --- Main Component ---

export default function StrategyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const strategyId = params.id as string;
  const { toast } = useToast();

  // Strategy state
  const [strategy, setStrategy] = useState<StrategyDetail | null>(null);
  const [tasks, setTasks] = useState<StrategyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline name/description editing
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingHeader, setIsSavingHeader] = useState(false);

  // Task view/detail dialog
  const [viewingTask, setViewingTask] = useState<StrategyTask | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Task edit dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StrategyTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormData>({
    ...DEFAULT_TASK_FORM,
  });
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Inline add
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  // DnD
  const [activeDragTask, setActiveDragTask] = useState<StrategyTask | null>(
    null
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // --- Data fetching ---

  const fetchStrategy = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/content/strategy/${strategyId}`);
      const data = await response.json();

      if (!data.success)
        throw new Error(data.error?.message || "Strategy not found");

      setStrategy(data.data.strategy);
      setTasks(data.data.strategy.tasks || []);
      setEditName(data.data.strategy.name);
      setEditDescription(data.data.strategy.description || "");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load strategy"
      );
    } finally {
      setIsLoading(false);
    }
  }, [strategyId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  // Keep viewingTask in sync with tasks state
  useEffect(() => {
    if (viewingTask) {
      const updated = tasks.find((t) => t.id === viewingTask.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(viewingTask)) {
        setViewingTask(updated);
      }
    }
  }, [tasks, viewingTask]);

  // --- Computed ---

  const completedCount = tasks.filter((t) => t.status === "DONE").length;
  const totalCount = tasks.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const tasksByStatus = useMemo(() => {
    const counts: Record<TaskStatus, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    };
    tasks.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [tasks]);

  // --- Header editing ---

  const handleSaveHeader = async () => {
    if (!editName.trim()) return;
    try {
      setIsSavingHeader(true);
      const response = await fetch(`/api/content/strategy/${strategyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.error?.message || "Failed to update");

      setStrategy((prev) =>
        prev ? { ...prev, ...data.data.strategy } : prev
      );
      setIsEditingHeader(false);
      toast({ title: "Strategy updated" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setIsSavingHeader(false);
    }
  };

  // --- Task CRUD ---

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !strategy) return;

    try {
      const response = await fetch("/api/content/strategy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy.id,
          title: newTaskTitle.trim(),
          category: "content",
          priority: "MEDIUM",
        }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.error?.message || "Failed to add task");

      setTasks((prev) => [...prev, data.data.task]);
      setNewTaskTitle("");
      setIsAddingTask(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to add task",
        variant: "destructive",
      });
    }
  };

  const openViewTask = (task: StrategyTask) => {
    setViewingTask(task);
    setViewDialogOpen(true);
  };

  const openEditTask = (task: StrategyTask) => {
    setViewDialogOpen(false);
    setViewingTask(null);
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      category: task.category,
      priority: task.priority,
      startDate: task.startDate ? task.startDate.split("T")[0] : "",
      dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
    });
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim() || !editingTask) return;

    try {
      setIsSavingTask(true);
      const response = await fetch("/api/content/strategy/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTask.id,
          title: taskForm.title,
          description: taskForm.description || null,
          category: taskForm.category,
          priority: taskForm.priority,
          startDate: taskForm.startDate || null,
          dueDate: taskForm.dueDate || null,
        }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.error?.message || "Failed to update");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id ? { ...t, ...data.data.task } : t
        )
      );
      setTaskDialogOpen(false);
      toast({ title: "Task updated" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update task",
        variant: "destructive",
      });
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch(
        `/api/content/strategy/tasks?id=${id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!data.success)
        throw new Error(data.error?.message || "Failed to delete");

      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (taskDialogOpen && editingTask?.id === id) {
        setTaskDialogOpen(false);
      }
      if (viewDialogOpen && viewingTask?.id === id) {
        setViewDialogOpen(false);
        setViewingTask(null);
      }
      toast({ title: "Task removed" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: TaskStatus
  ) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completedAt:
                newStatus === "DONE"
                  ? new Date().toISOString()
                  : t.status === "DONE"
                  ? undefined
                  : t.completedAt,
            }
          : t
      )
    );

    try {
      const response = await fetch("/api/content/strategy/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });
      const data = await response.json();
      if (!data.success)
        throw new Error(data.error?.message || "Failed to update");

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...data.data.task } : t))
      );
    } catch (err) {
      fetchStrategy();
      toast({
        title: err instanceof Error ? err.message : "Failed to update task",
        variant: "destructive",
      });
    }
  };

  // --- DnD ---

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveDragTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex).map((t, i) => ({
      ...t,
      sortOrder: i,
    }));
    setTasks(reordered);

    try {
      await fetch("/api/content/strategy/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: active.id as string,
          sortOrder: newIndex,
        }),
      });
    } catch {
      fetchStrategy();
      toast({ title: "Failed to reorder", variant: "destructive" });
    }
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !strategy) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/content/strategy/plans")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Strategy Not Found</h1>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-destructive text-sm">
              {error || "Strategy not found"}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStrategy}
              className="ml-auto"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  const statusBadgeClass =
    strategy.status === "ACTIVE"
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : strategy.status === "PAUSED"
      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      : "bg-gray-500/10 text-gray-500 border-gray-500/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/content/strategy/plans")}
          className="shrink-0 mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          {isEditingHeader ? (
            <div className="space-y-3">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-xl font-bold"
                placeholder="Strategy name"
                autoFocus
              />
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Strategy description..."
                className="resize-none min-h-[60px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveHeader}
                  disabled={isSavingHeader || !editName.trim()}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  {isSavingHeader ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditingHeader(false);
                    setEditName(strategy.name);
                    setEditDescription(strategy.description || "");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setIsEditingHeader(true)}
                  className="group flex items-center gap-2"
                >
                  <h1 className="text-2xl font-bold tracking-tight group-hover:text-orange-600 transition-colors">
                    {strategy.name}
                  </h1>
                  <Edit2 className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                {strategy.aiGenerated && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-purple-500/10 border-purple-500/20 text-purple-600"
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    AI
                  </Badge>
                )}
                <Badge variant="outline" className={statusBadgeClass}>
                  {strategy.status.charAt(0) +
                    strategy.status.slice(1).toLowerCase()}
                </Badge>
              </div>
              {strategy.description && (
                <p className="text-muted-foreground mt-2 text-sm">
                  {strategy.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Created {formatFullDate(strategy.createdAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progress + Stats */}
      {totalCount > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <Progress value={progressPct} className="h-2 flex-1" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {completedCount}/{totalCount} ({progressPct}%)
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3 text-gray-400" />
              {tasksByStatus.TODO} to do
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-orange-500" />
              {tasksByStatus.IN_PROGRESS} in progress
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {tasksByStatus.DONE} done
            </span>
          </div>
        </div>
      )}

      {/* Task List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              Tasks
              {totalCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalCount}
                </Badge>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsAddingTask(true);
                setNewTaskTitle("");
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    onEdit={openViewTask}
                    onDelete={handleDeleteTask}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragTask ? (
                <TaskRowOverlay task={activeDragTask} />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Inline add */}
          <AnimatePresence>
            {isAddingTask && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 overflow-hidden"
              >
                <div className="flex gap-2">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="New task title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTaskTitle.trim())
                        handleAddTask();
                      if (e.key === "Escape") setIsAddingTask(false);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleAddTask}
                    disabled={!newTaskTitle.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAddingTask(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tasks.length === 0 && !isAddingTask && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p>No tasks yet</p>
              <p className="mt-1">
                Click &quot;Add Task&quot; to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail/Summary Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] !flex !flex-col gap-0 p-0">
          {viewingTask && (() => {
            const vCat = CATEGORY_CONFIG[viewingTask.category] || CATEGORY_CONFIG.content;
            const vPriority = PRIORITY_CONFIG[viewingTask.priority] || PRIORITY_CONFIG.MEDIUM;
            const vStatus = STATUS_CONFIG[viewingTask.status] || STATUS_CONFIG.TODO;
            const VStatusIcon = vStatus.icon;
            const vProgressBar = viewingTask.progress >= 50 ? "bg-green-500" : "bg-blue-500";
            let activities: ParsedActivity[] = [];
            try {
              const raw = JSON.parse(viewingTask.matchedActivities || "[]");
              if (Array.isArray(raw)) activities = raw;
            } catch { /* ignore */ }
            const confidenceColor: Record<string, string> = {
              low: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
              high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
            };
            const activityIcon: Record<string, string> = {
              post: "📝",
              campaign: "📧",
              automation: "⚡",
              postAutomation: "🤖",
              adCampaign: "📢",
            };

            return (
              <>
                {/* Fixed header */}
                <div className="shrink-0 px-6 pt-6 pb-3">
                  <DialogHeader>
                    <DialogTitle className="flex items-start gap-2 pr-6">
                      <VStatusIcon className={`h-5 w-5 shrink-0 mt-0.5 ${vStatus.color}`} />
                      <span className="break-words">{viewingTask.title}</span>
                    </DialogTitle>
                  </DialogHeader>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] ${vCat.bgColor} ${vCat.color}`}>
                      {vCat.label}
                    </Badge>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <div className={`h-1.5 w-1.5 rounded-full ${vPriority.dotColor}`} />
                      {vPriority.label}
                    </span>
                    {viewingTask.autoCompleted && (
                      <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                        Auto-completed
                      </Badge>
                    )}
                  </div>

                  {(viewingTask.startDate || viewingTask.dueDate) && (
                    <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                      {viewingTask.startDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          Start: {formatFullDate(viewingTask.startDate)}
                        </span>
                      )}
                      {viewingTask.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          Due: {formatFullDate(viewingTask.dueDate)}
                        </span>
                      )}
                    </div>
                  )}

                  {viewingTask.progress > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{viewingTask.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${vProgressBar}`}
                          style={{ width: `${viewingTask.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Requirement & What's Left */}
                  {(() => {
                    const requirement = getTaskRequirement(viewingTask);
                    const whatsLeft = getWhatsLeft(viewingTask, activities);
                    return (
                      <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/40">
                        <div className="space-y-1">
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <ListChecks className="h-3.5 w-3.5 text-blue-500" />
                            Requirement
                          </h4>
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {requirement}
                          </p>
                        </div>
                        {viewingTask.status === "DONE" ? (
                          <div className="pt-1 border-t border-border/30">
                            <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              All requirements met — task is complete!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5 pt-1 border-t border-border/30">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <ArrowRight className="h-3.5 w-3.5 text-orange-500" />
                              What&apos;s Left
                              <span className="text-[10px] font-normal normal-case tracking-normal ml-auto">
                                {whatsLeft.summary}
                              </span>
                            </h4>
                            <ul className="space-y-0.5">
                              {whatsLeft.items.map((item, idx) => (
                                <li key={idx} className="text-xs text-foreground/80 leading-relaxed flex items-start gap-1.5">
                                  <span className="text-muted-foreground mt-1 shrink-0">•</span>
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Matched Activities with links */}
                  {activities.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-orange-500" />
                        Triggered by ({activities.length})
                      </h4>
                      <div className="space-y-1.5">
                        {activities.map((act, i) => (
                          <div
                            key={i}
                            className="p-2 rounded-md bg-muted/40 border border-border/40 space-y-1"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-1.5 min-w-0">
                                <span className="text-sm shrink-0">{activityIcon[act.activityType] || "📋"}</span>
                                {act.activityUrl ? (
                                  <Link
                                    href={act.activityUrl}
                                    className="text-xs font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline break-words"
                                    onClick={() => setViewDialogOpen(false)}
                                  >
                                    {act.activityName || act.matchReason}
                                  </Link>
                                ) : (
                                  <span className="text-xs font-medium break-words">
                                    {act.activityName || act.matchReason}
                                  </span>
                                )}
                                {act.activityUrl && (
                                  <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0 mt-0.5" />
                                )}
                              </div>
                              <span className={`text-[9px] px-1.5 py-0 rounded-full shrink-0 whitespace-nowrap ${confidenceColor[act.confidence] || confidenceColor.low}`}>
                                {act.confidence}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed break-words">
                              {act.matchReason}
                            </p>
                            <span className="text-[9px] text-muted-foreground/60">
                              {formatFullDate(act.matchedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activities.length === 0 && viewingTask.status === "TODO" && (
                    <div className="text-center py-3 text-[11px] text-muted-foreground bg-muted/30 rounded-md">
                      <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground/40" />
                      No matched activities yet. Activities will be detected automatically.
                    </div>
                  )}
                </div>

                {/* Fixed footer */}
                <div className="shrink-0 px-6 pb-6 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        Object.entries(STATUS_CONFIG) as [
                          TaskStatus,
                          (typeof STATUS_CONFIG)[TaskStatus],
                        ][]
                      ).map(([status, cfg]) => {
                        const Icon = cfg.icon;
                        const isActive = viewingTask.status === status;
                        return (
                          <button
                            key={status}
                            onClick={() => {
                              if (!isActive) {
                                handleStatusChange(viewingTask.id, status);
                                setViewingTask((prev) =>
                                  prev ? { ...prev, status } : prev
                                );
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] transition-colors ${
                              isActive
                                ? `${cfg.color} border-current bg-current/5 font-medium`
                                : "border-border text-muted-foreground hover:border-muted-foreground/40"
                            }`}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditTask(viewingTask)}
                      className="h-7 text-xs shrink-0"
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Task title"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description..."
                className="resize-none min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={taskForm.category}
                  onValueChange={(val) =>
                    setTaskForm((f) => ({
                      ...f,
                      category: val as TaskCategory,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        {cfg.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(val) =>
                    setTaskForm((f) => ({
                      ...f,
                      priority: val as TaskPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${cfg.dotColor}`}
                          />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={taskForm.startDate}
                  onChange={(e) =>
                    setTaskForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Status change in dialog */}
            {editingTask && (
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-2">
                  {(
                    Object.entries(STATUS_CONFIG) as [
                      TaskStatus,
                      (typeof STATUS_CONFIG)[TaskStatus],
                    ][]
                  ).map(([status, cfg]) => {
                    const Icon = cfg.icon;
                    const isActive = editingTask.status === status;
                    return (
                      <button
                        key={status}
                        onClick={() => {
                          if (!isActive) {
                            handleStatusChange(editingTask.id, status);
                            setEditingTask((prev) =>
                              prev ? { ...prev, status } : prev
                            );
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          isActive
                            ? `${cfg.color} border-current bg-current/5 font-medium`
                            : "border-border text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (editingTask) handleDeleteTask(editingTask.id);
                }}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>

              <Button
                onClick={handleSaveTask}
                disabled={isSavingTask || !taskForm.title.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isSavingTask ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
