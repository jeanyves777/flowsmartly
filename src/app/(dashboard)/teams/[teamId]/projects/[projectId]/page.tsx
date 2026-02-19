"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Clock,
  CalendarDays,
  MessageSquare,
  Paperclip,
  X,
  Send,
  MoreVertical,
  Trash2,
  User,
  GripVertical,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Circle,
  Timer,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface TaskMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface TaskComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: TaskMember;
}

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  assignee?: TaskMember | null;
  createdById: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  progress: number;
  attachments: string;
  createdAt: string;
  updatedAt: string;
  _count?: { comments: number };
}

interface ProjectMember {
  id: string;
  userId: string;
  user: TaskMember & { email: string };
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: string;
  deadline: string | null;
  totalTasks: number;
  completedTasks: number;
  createdBy: string;
  tasks: TaskData[];
  members: ProjectMember[];
}

const COLUMNS = [
  { id: "TODO", label: "To Do", icon: Circle, color: "text-zinc-400" },
  { id: "IN_PROGRESS", label: "In Progress", icon: Timer, color: "text-blue-500" },
  { id: "REVIEW", label: "Review", icon: Eye, color: "text-amber-500" },
  { id: "DONE", label: "Done", icon: CheckCircle2, color: "text-green-500" },
] as const;

const priorityColors: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  LOW: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; projectId: string }>;
}) {
  const { teamId, projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Task creation
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskColumn, setNewTaskColumn] = useState("TODO");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    assigneeId: "",
    dueDate: "",
  });
  const [creatingTask, setCreatingTask] = useState(false);

  // Task detail sheet
  const [selectedTask, setSelectedTask] = useState<TaskData | null>(null);
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}`
      );
      const json = await res.json();
      if (json.success) setProject(json.data);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [teamId, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const fetchComments = useCallback(
    async (taskId: string) => {
      setLoadingComments(true);
      try {
        const res = await fetch(
          `/api/teams/${teamId}/projects/${projectId}/tasks/${taskId}/comments`
        );
        const json = await res.json();
        if (json.success) setTaskComments(json.data || []);
      } catch {
        /* silent */
      } finally {
        setLoadingComments(false);
      }
    },
    [teamId, projectId]
  );

  function openTaskDetail(task: TaskData) {
    setSelectedTask(task);
    fetchComments(task.id);
  }

  async function handleCreateTask() {
    if (!newTask.title.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newTask.title.trim(),
            description: newTask.description.trim() || undefined,
            status: newTaskColumn,
            priority: newTask.priority,
            assigneeId: newTask.assigneeId || undefined,
            dueDate: newTask.dueDate || undefined,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setShowNewTask(false);
        setNewTask({
          title: "",
          description: "",
          priority: "MEDIUM",
          assigneeId: "",
          dueDate: "",
        });
        fetchProject();
      }
    } catch {
      /* silent */
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleUpdateTask(taskId: string, updates: Record<string, unknown>) {
    setUpdatingTask(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/tasks`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId, ...updates }),
        }
      );
      const json = await res.json();
      if (json.success) {
        fetchProject();
        if (selectedTask?.id === taskId) {
          setSelectedTask((prev) =>
            prev ? { ...prev, ...updates } as TaskData : null
          );
        }
      }
    } catch {
      /* silent */
    } finally {
      setUpdatingTask(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await fetch(
        `/api/teams/${teamId}/projects/${projectId}/tasks`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId }),
        }
      );
      setSelectedTask(null);
      fetchProject();
    } catch {
      /* silent */
    }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !selectedTask) return;
    setSendingComment(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/tasks/${selectedTask.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setNewComment("");
        fetchComments(selectedTask.id);
      }
    } catch {
      /* silent */
    } finally {
      setSendingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!selectedTask) return;
    try {
      await fetch(
        `/api/teams/${teamId}/projects/${projectId}/tasks/${selectedTask.id}/comments`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: commentId }),
        }
      );
      fetchComments(selectedTask.id);
    } catch {
      /* silent */
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Project not found</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push(`/teams/${teamId}`)}
        >
          Back to Team
        </Button>
      </div>
    );
  }

  const tasks = project.tasks || [];
  const progress =
    project.totalTasks > 0
      ? Math.round((project.completedTasks / project.totalTasks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/teams/${teamId}`)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {project.deadline && (
            <Badge variant="outline" className="gap-1">
              <CalendarDays className="h-3 w-3" />
              {new Date(project.deadline).toLocaleDateString()}
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={
              project.status === "ACTIVE"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : project.status === "COMPLETED"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : ""
            }
          >
            {project.status}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {project.completedTasks}/{project.totalTasks} tasks completed
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {/* Member avatars */}
        <div className="flex -space-x-2">
          {project.members.slice(0, 5).map((m) => (
            <div
              key={m.id}
              className="h-8 w-8 rounded-full border-2 border-background bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium"
              title={m.user.name}
            >
              {m.user.avatarUrl ? (
                <img
                  src={m.user.avatarUrl}
                  alt={m.user.name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                m.user.name.charAt(0).toUpperCase()
              )}
            </div>
          ))}
          {project.members.length > 5 && (
            <div className="h-8 w-8 rounded-full border-2 border-background bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-xs">
              +{project.members.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((t) => t.status === column.id);
          return (
            <div key={column.id} className="space-y-3">
              {/* Column Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <column.icon className={`h-4 w-4 ${column.color}`} />
                  <h3 className="font-semibold text-sm">{column.label}</h3>
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {columnTasks.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setNewTaskColumn(column.id);
                    setShowNewTask(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Task Cards */}
              <div className="space-y-2 min-h-[100px]">
                {columnTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openTaskDetail(task)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium leading-tight">
                          {task.title}
                        </h4>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 shrink-0 ${
                            priorityColors[task.priority] || ""
                          }`}
                        >
                          {task.priority}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(task.dueDate).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                          )}
                          {(task._count?.comments ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {task._count?.comments}
                            </span>
                          )}
                        </div>
                        {task.assignee ? (
                          <div
                            className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium"
                            title={task.assignee.name}
                          >
                            {task.assignee.avatarUrl ? (
                              <img
                                src={task.assignee.avatarUrl}
                                alt={task.assignee.name}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              task.assignee.name.charAt(0).toUpperCase()
                            )}
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* New Task Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Add more details..."
                value={newTask.description}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(val) =>
                    setNewTask((prev) => ({ ...prev, priority: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignee (optional)</Label>
                <Select
                  value={newTask.assigneeId}
                  onValueChange={(val) =>
                    setNewTask((prev) => ({
                      ...prev,
                      assigneeId: val === "none" ? "" : val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {project.members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={newTask.dueDate}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={creatingTask || !newTask.title.trim()}
              className="gap-2"
            >
              {creatingTask && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <Sheet
        open={!!selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTask && (
            <div className="space-y-6 pt-6">
              <SheetHeader>
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-left leading-tight">
                    {selectedTask.title}
                  </SheetTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteTask(selectedTask.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </SheetHeader>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Select
                    value={selectedTask.status}
                    onValueChange={(val) =>
                      handleUpdateTask(selectedTask.id, { status: val })
                    }
                    disabled={updatingTask}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Priority</Label>
                  <Select
                    value={selectedTask.priority}
                    onValueChange={(val) =>
                      handleUpdateTask(selectedTask.id, { priority: val })
                    }
                    disabled={updatingTask}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select
                  value={selectedTask.assigneeId || "none"}
                  onValueChange={(val) =>
                    handleUpdateTask(selectedTask.id, {
                      assigneeId: val === "none" ? null : val,
                    })
                  }
                  disabled={updatingTask}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {project.members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={
                    selectedTask.dueDate
                      ? new Date(selectedTask.dueDate)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  onChange={(e) =>
                    handleUpdateTask(selectedTask.id, {
                      dueDate: e.target.value || null,
                    })
                  }
                  disabled={updatingTask}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                {selectedTask.description ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description
                  </p>
                )}
              </div>

              {/* Comments */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">Comments</Label>
                </div>

                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {taskComments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No comments yet
                      </p>
                    ) : (
                      taskComments.map((comment) => (
                        <div key={comment.id} className="flex gap-2 group">
                          <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-medium shrink-0 mt-0.5">
                            {comment.user.avatarUrl ? (
                              <img
                                src={comment.user.avatarUrl}
                                alt={comment.user.name}
                                className="h-7 w-7 rounded-full object-cover"
                              />
                            ) : (
                              comment.user.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">
                                {comment.user.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleString(
                                  undefined,
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                              </button>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Add Comment */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    className="h-9"
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={handleAddComment}
                    disabled={sendingComment || !newComment.trim()}
                  >
                    {sendingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Meta */}
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <p>
                  Created{" "}
                  {new Date(selectedTask.createdAt).toLocaleDateString()}
                </p>
                {selectedTask.completedAt && (
                  <p>
                    Completed{" "}
                    {new Date(selectedTask.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
