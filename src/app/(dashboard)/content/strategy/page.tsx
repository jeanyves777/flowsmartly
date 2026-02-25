"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Sparkles,
  Plus,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Trash2,
  GripVertical,
  LayoutGrid,
  CheckCircle2,
  TrendingUp,
  Flame,
  X,
  Activity,
  Edit2,
  Clock,
  Circle,
  ExternalLink,
  ListChecks,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  DragOverEvent,
  useDroppable,
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
type ViewMode = "kanban" | "timeline";

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
  automationStatus: string;
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

interface Strategy {
  id: string;
  name: string;
  tasks: StrategyTask[];
  createdAt: string;
  aiGenerated: boolean;
  status: string;
}

interface TaskFormData {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
}

// --- Constants ---

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const CATEGORY_CONFIG: Record<
  TaskCategory,
  { label: string; color: string; bgColor: string }
> = {
  content: { label: "Content", color: "text-blue-600", bgColor: "bg-blue-500/10 border-blue-500/20" },
  social: { label: "Social", color: "text-green-600", bgColor: "bg-green-500/10 border-green-500/20" },
  ads: { label: "Ads", color: "text-orange-600", bgColor: "bg-orange-500/10 border-orange-500/20" },
  email: { label: "Email", color: "text-purple-600", bgColor: "bg-purple-500/10 border-purple-500/20" },
  analytics: { label: "Analytics", color: "text-cyan-600", bgColor: "bg-cyan-500/10 border-cyan-500/20" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; dotColor: string }> = {
  HIGH: { label: "High", dotColor: "bg-red-500" },
  MEDIUM: { label: "Medium", dotColor: "bg-yellow-500" },
  LOW: { label: "Low", dotColor: "bg-green-500" },
};

const STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "TODO", label: "To Do" },
  { id: "IN_PROGRESS", label: "In Progress" },
  { id: "DONE", label: "Done" },
];

const TIMELINE_BAR_COLORS: Record<TaskCategory, string> = {
  content: "bg-blue-500",
  social: "bg-green-500",
  ads: "bg-orange-500",
  email: "bg-purple-500",
  analytics: "bg-cyan-500",
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  TODO: { label: "To Do", icon: Circle, color: "text-muted-foreground" },
  IN_PROGRESS: { label: "In Progress", icon: Clock, color: "text-orange-500" },
  DONE: { label: "Done", icon: CheckCircle2, color: "text-green-500" },
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

  // Count what's been done by type
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
    // Show what's been done
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

    // Show what's still needed based on confidence
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
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
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

function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

// --- Sortable Task Card ---

function SortableTaskCard({
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
  } = useSortable({ id: task.id, data: { task, status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const categoryInfo = CATEGORY_CONFIG[task.category];
  const priorityInfo = PRIORITY_CONFIG[task.priority];

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow group"
        onClick={() => onEdit(task)}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <button
              {...listeners}
              className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm leading-snug truncate">
                {task.title}
              </p>
            </div>
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

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 ml-6 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${categoryInfo.bgColor} ${categoryInfo.color}`}
            >
              {categoryInfo.label}
            </Badge>
            <div className="flex items-center gap-1" title={`${priorityInfo.label} priority`}>
              <div className={`h-2 w-2 rounded-full ${priorityInfo.dotColor}`} />
              <span className="text-[10px] text-muted-foreground">
                {priorityInfo.label}
              </span>
            </div>
            {task.dueDate && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Calendar className="h-2.5 w-2.5" />
                {formatDate(task.dueDate)}
              </span>
            )}
            {task.automationStatus === "AUTOMATED" && (
              <Badge className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                <Zap className="h-2.5 w-2.5 mr-0.5" /> Automated
              </Badge>
            )}
            {task.automationStatus === "AUTOMATABLE" && (
              <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/20">
                Can Automate
              </Badge>
            )}
            {task.automationStatus === "MANUAL_ONLY" && (
              <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">
                Manual
              </Badge>
            )}
          </div>

          {/* Status quick-change buttons */}
          <div className="flex items-center gap-1.5 ml-6 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {STATUS_COLUMNS.filter((col) => col.id !== task.status).map((col) => (
              <button
                key={col.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, col.id);
                }}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  col.id === "DONE"
                    ? "border-green-500/30 text-green-600 hover:bg-green-500/10"
                    : col.id === "IN_PROGRESS"
                    ? "border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                    : "border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                }`}
              >
                {col.label}
              </button>
            ))}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors ml-auto"
            >
              Remove
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Task Card Overlay (for DragOverlay) ---

function TaskCardOverlay({ task }: { task: StrategyTask }) {
  const categoryInfo = CATEGORY_CONFIG[task.category];
  const priorityInfo = PRIORITY_CONFIG[task.priority];

  return (
    <Card className="shadow-xl border-orange-500/50 rotate-2 w-[280px]">
      <CardContent className="p-3 space-y-2">
        <p className="font-medium text-sm leading-snug truncate">{task.title}</p>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${categoryInfo.bgColor} ${categoryInfo.color}`}
          >
            {categoryInfo.label}
          </Badge>
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${priorityInfo.dotColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Droppable Column ---

function DroppableColumn({
  status,
  label,
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onAddClick,
}: {
  status: TaskStatus;
  label: string;
  tasks: StrategyTask[];
  onEdit: (task: StrategyTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAddClick: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-muted/30 rounded-xl p-3 min-h-[400px] transition-colors ${
        isOver ? "bg-orange-500/5 ring-2 ring-orange-500/30" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm text-foreground">{label}</h3>
          <Badge
            variant="secondary"
            className="text-xs h-5 min-w-[20px] justify-center"
          >
            {tasks.length}
          </Badge>
        </div>
      </div>

      {/* Sortable cards */}
      <div className="flex-1 space-y-2 min-h-[100px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && !isOver && (
          <div className="text-center py-8 text-xs text-muted-foreground">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => onAddClick(status)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mt-2 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors w-full"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    </div>
  );
}

// --- Timeline View ---

function TimelineView({
  tasks,
  onEdit,
}: {
  tasks: StrategyTask[];
  onEdit: (task: StrategyTask) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute the timeline range
  const { scheduledTasks, unscheduledTasks, timelineStart, timelineEnd, totalDays, months } =
    useMemo(() => {
      const scheduled = tasks.filter((t) => t.startDate || t.dueDate);
      const unscheduled = tasks.filter((t) => !t.startDate && !t.dueDate);

      if (scheduled.length === 0) {
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        return {
          scheduledTasks: [],
          unscheduledTasks: unscheduled,
          timelineStart: now,
          timelineEnd: end,
          totalDays: 30,
          months: [] as { label: string; startPct: number; weeks: number[] }[],
        };
      }

      const allDates = scheduled.flatMap((t) => {
        const dates: Date[] = [];
        if (t.startDate) dates.push(new Date(t.startDate));
        if (t.dueDate) dates.push(new Date(t.dueDate));
        return dates;
      });

      const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

      // Add padding
      const start = new Date(minDate);
      start.setDate(start.getDate() - 7);
      const end = new Date(maxDate);
      end.setDate(end.getDate() + 14);

      const total = Math.max(getDaysBetween(start, end), 14);

      // Generate month labels with week markers
      const monthMap: { label: string; startPct: number; weeks: number[] }[] = [];
      const cursor = new Date(start);
      let currentMonthKey = "";

      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
        const pct = (getDaysBetween(start, cursor) / total) * 100;

        if (key !== currentMonthKey) {
          currentMonthKey = key;
          monthMap.push({
            label: cursor.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            }),
            startPct: pct,
            weeks: [],
          });
        }

        // Track week starts (Mondays)
        if (cursor.getDay() === 1 && monthMap.length > 0) {
          monthMap[monthMap.length - 1].weeks.push(pct);
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      return {
        scheduledTasks: scheduled,
        unscheduledTasks: unscheduled,
        timelineStart: start,
        timelineEnd: end,
        totalDays: total,
        months: monthMap,
      };
    }, [tasks]);

  const getBarPosition = (task: StrategyTask) => {
    const taskStart = task.startDate
      ? new Date(task.startDate)
      : task.dueDate
      ? new Date(task.dueDate)
      : timelineStart;
    const taskEnd = task.dueDate
      ? new Date(task.dueDate)
      : task.startDate
      ? new Date(new Date(task.startDate).getTime() + 86400000 * 3)
      : new Date(timelineStart.getTime() + 86400000 * 3);

    const leftPct = Math.max(
      0,
      (getDaysBetween(timelineStart, taskStart) / totalDays) * 100
    );
    const widthPct = Math.max(
      2,
      (getDaysBetween(taskStart, taskEnd) / totalDays) * 100
    );

    return { left: `${leftPct}%`, width: `${Math.min(widthPct, 100 - leftPct)}%` };
  };

  return (
    <div className="space-y-4">
      {/* Timeline area */}
      <Card>
        <CardContent className="p-4">
          <div
            ref={scrollRef}
            className="overflow-x-auto"
          >
            <div className="relative min-w-[800px]">
              {/* Month headers */}
              <div className="relative h-10 border-b mb-2">
                {months.map((month, i) => (
                  <div
                    key={`${month.label}-${i}`}
                    className="absolute top-0 flex flex-col"
                    style={{ left: `${month.startPct}%` }}
                  >
                    <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                      {month.label}
                    </span>
                    <div className="h-3 border-l border-border mt-0.5" />
                  </div>
                ))}
                {/* Week markers in header */}
                {months.flatMap((month) =>
                  month.weeks.map((weekPct, wi) => (
                    <div
                      key={`week-${month.label}-${wi}`}
                      className="absolute bottom-0 h-2 border-l border-border/50"
                      style={{ left: `${weekPct}%` }}
                    />
                  ))
                )}
              </div>

              {/* Task bars area */}
              <div className="relative py-2">
                {/* Week gridlines extending through task area */}
                {months.flatMap((month) =>
                  month.weeks.map((weekPct, wi) => (
                    <div
                      key={`gridline-${month.label}-${wi}`}
                      className="absolute top-0 bottom-0 w-px bg-border/30"
                      style={{ left: `${weekPct}%` }}
                    />
                  ))
                )}

                {/* Today marker line */}
                {(() => {
                  const today = new Date();
                  if (today >= timelineStart && today <= timelineEnd) {
                    const todayPct =
                      (getDaysBetween(timelineStart, today) / totalDays) * 100;
                    return (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-orange-500/60 z-10"
                        style={{ left: `${todayPct}%` }}
                      >
                        <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-background" />
                      </div>
                    );
                  }
                  return null;
                })()}

                {scheduledTasks.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    No scheduled tasks to display on the timeline
                  </div>
                )}

                <div className="relative space-y-2">
                  {scheduledTasks.map((task) => {
                    const pos = getBarPosition(task);
                    const barColor =
                      TIMELINE_BAR_COLORS[task.category] || "bg-gray-500";
                    const priorityDot = PRIORITY_CONFIG[task.priority].dotColor;
                    const statusOpacity = task.status === "DONE" ? "opacity-60" : "";

                    return (
                      <div key={task.id} className="relative h-9">
                        <button
                          onClick={() => onEdit(task)}
                          className={`absolute top-0 h-full rounded-md ${barColor} ${statusOpacity} hover:brightness-110 transition-all flex items-center px-3 gap-1.5 text-white text-xs font-medium overflow-hidden group shadow-sm`}
                          style={{ left: pos.left, width: pos.width }}
                          title={`${task.title}${task.dueDate ? ` (Due: ${formatDate(task.dueDate)})` : ""}`}
                        >
                          <div className={`h-2 w-2 rounded-full ${priorityDot} shrink-0 ring-1 ring-white/30`} />
                          <span className="truncate">{task.title}</span>
                          {task.status === "DONE" && (
                            <CheckCircle2 className="h-3 w-3 shrink-0 ml-auto" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unscheduled section */}
      {unscheduledTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Unscheduled ({unscheduledTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unscheduledTasks.map((task) => {
                const catInfo = CATEGORY_CONFIG[task.category];
                const priInfo = PRIORITY_CONFIG[task.priority];
                return (
                  <button
                    key={task.id}
                    onClick={() => onEdit(task)}
                    className="text-left p-3 rounded-lg border hover:shadow-sm transition-shadow"
                  >
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${catInfo.bgColor} ${catInfo.color}`}
                      >
                        {catInfo.label}
                      </Badge>
                      <div
                        className={`h-2 w-2 rounded-full ${priInfo.dotColor}`}
                        title={priInfo.label}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Main Component ---

export default function MarketingStrategyPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [tasks, setTasks] = useState<StrategyTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  // Task view/detail dialog
  const [viewingTask, setViewingTask] = useState<StrategyTask | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Task edit dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StrategyTask | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormData>({ ...DEFAULT_TASK_FORM });
  const [isSavingTask, setIsSavingTask] = useState(false);

  // Inline add form
  const [addingToColumn, setAddingToColumn] = useState<TaskStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState("");

  // DnD
  const [activeDragTask, setActiveDragTask] = useState<StrategyTask | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // --- Data fetching ---

  const fetchStrategy = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/content/strategy");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch strategy");
      }

      setStrategy(data.data?.strategy || null);
      setTasks(data.data?.strategy?.tasks || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy");
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // --- Computed values ---

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, StrategyTask[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    tasks
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach((task) => {
        if (grouped[task.status]) {
          grouped[task.status].push(task);
        }
      });
    return grouped;
  }, [tasks]);

  const completedCount = tasks.filter((t) => t.status === "DONE").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const completedThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return tasks.filter(
      (t) => t.status === "DONE" && t.completedAt && new Date(t.completedAt) >= weekAgo
    ).length;
  }, [tasks]);

  const daysActive = useMemo(() => {
    if (!strategy?.createdAt) return 0;
    return Math.max(
      1,
      getDaysBetween(new Date(strategy.createdAt), new Date())
    );
  }, [strategy]);

  // --- Task CRUD ---

  const handleAddTask = async (status: TaskStatus) => {
    if (!inlineTitle.trim()) {
      setAddingToColumn(null);
      return;
    }

    try {
      const response = await fetch("/api/content/strategy/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategyId: strategy!.id,
          title: inlineTitle.trim(),
          status,
          category: "content",
          priority: "MEDIUM",
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to add task");

      setTasks((prev) => [...prev, data.data.task]);
      setInlineTitle("");
      setAddingToColumn(null);
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
      if (!data.success) throw new Error(data.error?.message || "Failed to update");

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...data.data.task } : t))
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
      const response = await fetch(`/api/content/strategy/tasks?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to delete");

      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (taskDialogOpen && editingTask?.id === id) {
        setTaskDialogOpen(false);
      }
      if (viewDialogOpen && viewingTask?.id === id) {
        setViewDialogOpen(false);
        setViewingTask(null);
      }
      toast({ title: "Task deleted" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  // --- Status change ---

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
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
      if (!data.success) throw new Error(data.error?.message || "Failed to update");

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

  // --- DnD handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveDragTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping over a column
    const isOverColumn = STATUS_COLUMNS.some((col) => col.id === overId);
    if (isOverColumn) {
      const newStatus = overId as TaskStatus;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId && t.status !== newStatus
            ? { ...t, status: newStatus }
            : t
        )
      );
    } else {
      // Dropping over another card
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        const activeTask = tasks.find((t) => t.id === activeId);
        if (activeTask && activeTask.status !== overTask.status) {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === activeId ? { ...t, status: overTask.status } : t
            )
          );
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    // Determine target status
    let targetStatus = task.status;
    const isOverColumn = STATUS_COLUMNS.some((col) => col.id === overId);
    if (isOverColumn) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;

        // Reorder within same column
        if (task.status === overTask.status) {
          const columnTasks = tasksByStatus[targetStatus];
          const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
          const newIndex = columnTasks.findIndex((t) => t.id === overId);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = arrayMove(columnTasks, oldIndex, newIndex);
            setTasks((prev) => {
              const otherTasks = prev.filter((t) => t.status !== targetStatus);
              return [...otherTasks, ...reordered.map((t, i) => ({ ...t, sortOrder: i }))];
            });
          }
        }
      }
    }

    // Persist to API
    try {
      await fetch("/api/content/strategy/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeId,
          status: targetStatus,
          sortOrder: task.sortOrder,
        }),
      });
    } catch {
      // Revert on failure
      fetchStrategy();
      toast({ title: "Failed to move task", variant: "destructive" });
    }
  };

  // --- Render ---

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Target className="w-4 h-4 text-white" />
            </div>
            Marketing Strategy
            {strategy?.status && (
              <Badge
                variant="outline"
                className={
                  strategy.status === "ACTIVE"
                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                    : strategy.status === "PAUSED"
                    ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }
              >
                {strategy.status.charAt(0) + strategy.status.slice(1).toLowerCase()}
              </Badge>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "timeline"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="h-4 w-4" />
              Timeline
            </button>
          </div>

          <Button
            variant="outline"
            onClick={() => router.push("/content/strategy/plans")}
            className="text-sm"
          >
            <Target className="h-4 w-4 mr-2" />
            All Plans
          </Button>
          <Button
            onClick={() => router.push("/content/strategy/generate")}
            className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate with AI
          </Button>
          {strategy && (
            <Button
              onClick={() => router.push(`/content/automation?strategy=${strategy.id}`)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            >
              <Zap className="h-4 w-4 mr-2" />
              Automate Strategy
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-4"
        >
          <div className="flex-1">
            <Progress value={progressPct} className="h-2" />
          </div>
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            {completedCount}/{totalCount} tasks completed
          </span>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm">{error}</span>
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
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/30 rounded-xl p-3 animate-pulse">
              <div className="h-5 w-24 bg-muted rounded mb-4" />
              <div className="space-y-3">
                <div className="h-20 bg-muted rounded-lg" />
                <div className="h-20 bg-muted rounded-lg" />
                <div className="h-16 bg-muted rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      {!isLoading && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* Kanban View */}
          {viewMode === "kanban" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {STATUS_COLUMNS.map((col) => (
                  <DroppableColumn
                    key={col.id}
                    status={col.id}
                    label={col.label}
                    tasks={tasksByStatus[col.id]}
                    onEdit={openViewTask}
                    onDelete={handleDeleteTask}
                    onStatusChange={handleStatusChange}
                    onAddClick={(status) => {
                      setAddingToColumn(status);
                      setInlineTitle("");
                    }}
                  />
                ))}
              </motion.div>

              <DragOverlay>
                {activeDragTask ? (
                  <TaskCardOverlay task={activeDragTask} />
                ) : null}
              </DragOverlay>
            </DndContext>
          )}

          {/* Timeline View */}
          {viewMode === "timeline" && (
            <motion.div variants={itemVariants}>
              <TimelineView tasks={tasks} onEdit={openViewTask} />
            </motion.div>
          )}

          {/* Accomplishment Section */}
          {totalCount > 0 && (
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8"
            >
              <Card>
                <CardContent className="flex items-center gap-3 py-5 px-5">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {completedThisWeek}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Completed this week
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 py-5 px-5">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {progressPct}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Overall progress
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-3 py-5 px-5">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Flame className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {daysActive}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Days active
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Inline add task popover */}
      <AnimatePresence>
        {addingToColumn !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="w-80 shadow-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      Add to{" "}
                      {STATUS_COLUMNS.find((c) => c.id === addingToColumn)?.label}
                    </CardTitle>
                    <button
                      onClick={() => setAddingToColumn(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Task title..."
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTask(addingToColumn);
                      if (e.key === "Escape") setAddingToColumn(null);
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAddTask(addingToColumn)}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Add Task
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingToColumn(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                placeholder="Optional description..."
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, description: e.target.value }))
                }
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={taskForm.category}
                  onValueChange={(val) =>
                    setTaskForm((f) => ({ ...f, category: val as TaskCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
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
                    setTaskForm((f) => ({ ...f, priority: val as TaskPriority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2 w-2 rounded-full ${config.dotColor}`}
                          />
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-start">Start Date</Label>
                <Input
                  id="task-start"
                  type="date"
                  value={taskForm.startDate}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due">Due Date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {editingTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleDeleteTask(editingTask.id);
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete
                </Button>
              )}

              <Button
                onClick={handleSaveTask}
                disabled={isSavingTask || !taskForm.title.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white ml-auto"
              >
                {isSavingTask ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
