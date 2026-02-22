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
  Shield,
  Settings,
  Ban,
  RotateCcw,
  Pencil,
  UserPlus,
  UserMinus,
  Users,
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
import { Switch } from "@/components/ui/switch";
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

const PROJECT_TABS = ["board", "members", "settings"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

interface TeamMemberInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

// Feature categories for permissions editor
const FEATURE_CATEGORIES: { label: string; features: { key: string; label: string; cost: number }[] }[] = [
  {
    label: "Messaging",
    features: [
      { key: "EMAIL_SEND", label: "Email Send", cost: 1 },
      { key: "SMS_SEND", label: "SMS Send", cost: 3 },
      { key: "MMS_SEND", label: "MMS Send", cost: 5 },
    ],
  },
  {
    label: "AI Text",
    features: [
      { key: "AI_POST", label: "AI Post", cost: 3 },
      { key: "AI_CAPTION", label: "AI Caption", cost: 3 },
      { key: "AI_HASHTAGS", label: "AI Hashtags", cost: 2 },
      { key: "AI_IDEAS", label: "AI Ideas", cost: 3 },
      { key: "AI_AUTO", label: "AI Auto-Generate", cost: 3 },
      { key: "AI_BRAND_KIT", label: "AI Brand Kit", cost: 8 },
    ],
  },
  {
    label: "AI Image",
    features: [
      { key: "AI_VISUAL_DESIGN", label: "AI Visual Design", cost: 15 },
      { key: "AI_MARKETING_IMAGE", label: "Marketing Image", cost: 12 },
      { key: "AI_LOGO_GENERATION", label: "Logo Generation", cost: 40 },
      { key: "AI_BG_REMOVE", label: "Background Removal", cost: 1 },
    ],
  },
  {
    label: "AI Video",
    features: [
      { key: "AI_CARTOON_VIDEO", label: "Cartoon Video", cost: 80 },
      { key: "AI_VIDEO_STUDIO", label: "Video Studio", cost: 60 },
      { key: "AI_VIDEO_SLIDESHOW", label: "Slideshow Video", cost: 25 },
    ],
  },
  {
    label: "AI Chat",
    features: [
      { key: "AI_CHAT_MESSAGE", label: "Chat Message", cost: 2 },
      { key: "AI_CHAT_IMAGE", label: "Chat Image", cost: 15 },
      { key: "AI_CHAT_VIDEO", label: "Chat Video", cost: 60 },
    ],
  },
  {
    label: "Other",
    features: [
      { key: "AI_LANDING_PAGE", label: "Landing Page", cost: 20 },
    ],
  },
];

interface MemberPermissionData {
  featureKey: string;
  maxUsage: number;
  usedCount: number;
}

interface MemberPermissions {
  id: string;
  userId: string;
  user: TaskMember & { email: string };
  creditAllowance: number;
  creditsUsed: number;
  canActOnBehalf: boolean;
  expiresAt: string | null;
  isRevoked: boolean;
  permissions: MemberPermissionData[];
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ teamId: string; projectId: string }>;
}) {
  const { teamId, projectId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProjectTab>("board");

  // Project settings
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState("ACTIVE");
  const [savingProject, setSavingProject] = useState(false);
  const [showDeleteProject, setShowDeleteProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Members management
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

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

  // Permissions editor
  const [showPermissions, setShowPermissions] = useState(false);
  const [permMember, setPermMember] = useState<MemberPermissions | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permCreditAllowance, setPermCreditAllowance] = useState(0);
  const [permCanAct, setPermCanAct] = useState(false);
  const [permExpiry, setPermExpiry] = useState("");
  const [permFeatures, setPermFeatures] = useState<Record<string, { enabled: boolean; maxUsage: number }>>({});
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}`
      );
      const json = await res.json();
      if (json.success) {
        setProject(json.data);
        setEditName(json.data.name);
        setEditDesc(json.data.description || "");
        setEditDeadline(json.data.deadline ? json.data.deadline.split("T")[0] : "");
        setEditStatus(json.data.status);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [teamId, projectId]);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      const json = await res.json();
      if (json.success) {
        setTeamMembers(
          json.data.members.map((m: { user: TeamMemberInfo }) => m.user)
        );
      }
    } catch {
      /* silent */
    }
  }, [teamId]);

  useEffect(() => {
    fetchProject();
    fetchTeamMembers();
  }, [fetchProject, fetchTeamMembers]);

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

  async function openPermissionsEditor(member: ProjectMember) {
    setShowPermissions(true);
    setPermLoading(true);
    try {
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/permissions?userId=${member.userId}`
      );
      const json = await res.json();
      if (json.success) {
        const data = json.data as MemberPermissions;
        setPermMember(data);
        setPermCreditAllowance(data.creditAllowance);
        setPermCanAct(data.canActOnBehalf);
        setPermExpiry(data.expiresAt ? data.expiresAt.split("T")[0] : "");
        // Build feature state from existing permissions
        const featureState: Record<string, { enabled: boolean; maxUsage: number }> = {};
        for (const cat of FEATURE_CATEGORIES) {
          for (const f of cat.features) {
            const existing = data.permissions.find((p) => p.featureKey === f.key);
            featureState[f.key] = {
              enabled: !!existing,
              maxUsage: existing?.maxUsage ?? -1,
            };
          }
        }
        setPermFeatures(featureState);
      }
    } catch {
      /* silent */
    } finally {
      setPermLoading(false);
    }
  }

  async function handleSavePermissions() {
    if (!permMember) return;
    setPermSaving(true);
    try {
      const permissions = Object.entries(permFeatures)
        .filter(([, val]) => val.enabled)
        .map(([key, val]) => ({ featureKey: key, maxUsage: val.maxUsage }));

      await fetch(`/api/teams/${teamId}/projects/${projectId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: permMember.userId,
          creditAllowance: permCreditAllowance,
          canActOnBehalf: permCanAct,
          expiresAt: permExpiry || null,
          permissions,
        }),
      });
      setShowPermissions(false);
      setPermMember(null);
    } catch {
      /* silent */
    } finally {
      setPermSaving(false);
    }
  }

  async function handleRevokeRestore(restore: boolean) {
    if (!permMember) return;
    setPermSaving(true);
    try {
      await fetch(`/api/teams/${teamId}/projects/${projectId}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: permMember.userId, restore }),
      });
      // Refresh the permissions data
      const res = await fetch(
        `/api/teams/${teamId}/projects/${projectId}/permissions?userId=${permMember.userId}`
      );
      const json = await res.json();
      if (json.success) {
        setPermMember(json.data);
      }
    } catch {
      /* silent */
    } finally {
      setPermSaving(false);
      setShowRevokeConfirm(false);
    }
  }

  async function handleUpdateProject() {
    setSavingProject(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
          deadline: editDeadline || null,
          status: editStatus,
        }),
      });
      const json = await res.json();
      if (json.success) fetchProject();
    } catch {
      /* silent */
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDeleteProject() {
    setDeletingProject(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/projects/${projectId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) router.push(`/teams/${teamId}`);
    } catch {
      /* silent */
    } finally {
      setDeletingProject(false);
    }
  }

  async function handleAddMembers() {
    if (selectedUserIds.length === 0) return;
    setAddingMembers(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUserIds }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddMember(false);
        setSelectedUserIds([]);
        fetchProject();
      }
    } catch {
      /* silent */
    } finally {
      setAddingMembers(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setRemovingMemberId(userId);
    try {
      await fetch(`/api/teams/${teamId}/projects/${projectId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      fetchProject();
    } catch {
      /* silent */
    } finally {
      setRemovingMemberId(null);
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
            <button
              key={m.id}
              className="h-8 w-8 rounded-full border-2 border-background bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium hover:ring-2 hover:ring-orange-400 transition-all"
              title={`${m.user.name} - Click to manage permissions`}
              onClick={() => openPermissionsEditor(m)}
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
            </button>
          ))}
          {project.members.length > 5 && (
            <div className="h-8 w-8 rounded-full border-2 border-background bg-zinc-300 dark:bg-zinc-600 flex items-center justify-center text-xs">
              +{project.members.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {PROJECT_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Board Tab */}
      {tab === "board" && (
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
      )}

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Project Members ({project.members.length})
            </h2>
            <Button onClick={() => setShowAddMember(true)} size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" /> Add Member
            </Button>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {project.members.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                    {member.user.avatarUrl ? (
                      <img src={member.user.avatarUrl} alt={member.user.name} className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      member.user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openPermissionsEditor(member)}
                    >
                      <Shield className="h-3 w-3" /> Permissions
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 gap-1"
                      disabled={removingMemberId === member.userId}
                      onClick={() => handleRemoveMember(member.userId)}
                    >
                      {removingMemberId === member.userId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserMinus className="h-3 w-3" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {project.members.length === 0 && (
                <div className="p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No members yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleUpdateProject} disabled={savingProject || !editName.trim()} className="gap-2">
                {savingProject && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900/50">
            <CardHeader>
              <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this project will remove all tasks, comments, and member associations. This action cannot be undone.
              </p>
              <Button variant="destructive" onClick={() => setShowDeleteProject(true)} className="gap-2">
                <Trash2 className="h-4 w-4" /> Delete Project
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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

      {/* Permissions Editor Dialog */}
      <Dialog open={showPermissions} onOpenChange={(open) => { if (!open) { setShowPermissions(false); setPermMember(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Member Permissions
            </DialogTitle>
          </DialogHeader>

          {permLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : permMember ? (
            <div className="space-y-6 py-2">
              {/* Member Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-medium shrink-0">
                  {permMember.user.avatarUrl ? (
                    <img src={permMember.user.avatarUrl} alt={permMember.user.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    permMember.user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{permMember.user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{permMember.user.email}</p>
                </div>
                {permMember.isRevoked && (
                  <Badge variant="destructive">Revoked</Badge>
                )}
              </div>

              {/* General Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Credit Allowance</Label>
                    <Input
                      type="number"
                      min={0}
                      value={permCreditAllowance}
                      onChange={(e) => setPermCreditAllowance(parseInt(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used: {permMember.creditsUsed} / {permCreditAllowance || 0}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Expires At</Label>
                    <Input
                      type="date"
                      value={permExpiry}
                      onChange={(e) => setPermExpiry(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {permExpiry ? `Expires ${new Date(permExpiry).toLocaleDateString()}` : "No expiry"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>Act on Behalf of Owner</Label>
                    <p className="text-xs text-muted-foreground">Allow this member to use features with owner&apos;s credits</p>
                  </div>
                  <Switch checked={permCanAct} onCheckedChange={setPermCanAct} />
                </div>
              </div>

              {/* Feature Permissions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Feature Permissions</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const all: Record<string, { enabled: boolean; maxUsage: number }> = {};
                        for (const cat of FEATURE_CATEGORIES) {
                          for (const f of cat.features) {
                            all[f.key] = { enabled: true, maxUsage: permFeatures[f.key]?.maxUsage ?? -1 };
                          }
                        }
                        setPermFeatures(all);
                      }}
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const none: Record<string, { enabled: boolean; maxUsage: number }> = {};
                        for (const cat of FEATURE_CATEGORIES) {
                          for (const f of cat.features) {
                            none[f.key] = { enabled: false, maxUsage: -1 };
                          }
                        }
                        setPermFeatures(none);
                      }}
                    >
                      Disable All
                    </Button>
                  </div>
                </div>

                {FEATURE_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground">{cat.label}</h4>
                    <div className="space-y-1">
                      {cat.features.map((f) => {
                        const state = permFeatures[f.key] || { enabled: false, maxUsage: -1 };
                        const existingPerm = permMember.permissions.find((p) => p.featureKey === f.key);
                        return (
                          <div key={f.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                            <Switch
                              checked={state.enabled}
                              onCheckedChange={(checked) =>
                                setPermFeatures((prev) => ({
                                  ...prev,
                                  [f.key]: { ...prev[f.key], enabled: checked, maxUsage: prev[f.key]?.maxUsage ?? -1 },
                                }))
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{f.label}</p>
                              <p className="text-xs text-muted-foreground">{f.cost} credits/use</p>
                            </div>
                            {state.enabled && (
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Max uses:</Label>
                                <Input
                                  type="number"
                                  min={-1}
                                  className="w-20 h-8 text-sm"
                                  value={state.maxUsage}
                                  onChange={(e) =>
                                    setPermFeatures((prev) => ({
                                      ...prev,
                                      [f.key]: { ...prev[f.key], maxUsage: parseInt(e.target.value) || -1 },
                                    }))
                                  }
                                  title="-1 = unlimited"
                                />
                                {existingPerm && (
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    ({existingPerm.usedCount} used)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  {permMember.isRevoked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => handleRevokeRestore(true)}
                      disabled={permSaving}
                    >
                      <RotateCcw className="h-3 w-3" /> Restore Access
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1"
                      onClick={() => setShowRevokeConfirm(true)}
                      disabled={permSaving}
                    >
                      <Ban className="h-3 w-3" /> Revoke Access
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowPermissions(false); setPermMember(null); }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePermissions}
                    disabled={permSaving}
                    className="gap-2"
                  >
                    {permSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Permissions
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Member not found in project</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke Access Confirmation */}
      <AlertDialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke {permMember?.user.name}&apos;s ability to act on behalf of the team owner.
              They will no longer be able to use delegated features. You can restore access later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => handleRevokeRestore(false)}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {(() => {
              const existingIds = new Set(project.members.map((m) => m.userId));
              const available = teamMembers.filter((tm) => !existingIds.has(tm.id));
              if (available.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    All team members are already in this project
                  </p>
                );
              }
              return available.map((tm) => (
                <label key={tm.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300"
                    checked={selectedUserIds.includes(tm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds((prev) => [...prev, tm.id]);
                      } else {
                        setSelectedUserIds((prev) => prev.filter((id) => id !== tm.id));
                      }
                    }}
                  />
                  <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-medium shrink-0">
                    {tm.avatarUrl ? (
                      <img src={tm.avatarUrl} alt={tm.name} className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      tm.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tm.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tm.email}</p>
                  </div>
                </label>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddMember(false); setSelectedUserIds([]); }}>
              Cancel
            </Button>
            <Button onClick={handleAddMembers} disabled={addingMembers || selectedUserIds.length === 0} className="gap-2">
              {addingMembers && <Loader2 className="h-4 w-4 animate-spin" />}
              Add {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={showDeleteProject} onOpenChange={setShowDeleteProject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{project.name}&quot; and all its tasks, comments, and member data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProject}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
