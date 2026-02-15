"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  LogIn,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Loader2,
  Briefcase,
  CalendarDays,
  FileText,
  Megaphone,
  Target,
  Zap,
  BarChart3,
  PenSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ClientUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  plan: string;
  createdAt: string;
  bio?: string;
  website?: string;
}

interface AgentClientData {
  id: string;
  status: string;
  monthlyPriceCents: number;
  startDate: string;
  endDate: string | null;
  warningCount: number;
  clientUser: ClientUser;
  warnings: Array<{
    id: string;
    level: string;
    reason: string;
    isResolved: boolean;
    createdAt: string;
  }>;
}

interface Strategy {
  id: string;
  name: string;
  status: string;
  tasks: StrategyTask[];
}

interface StrategyTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progress: number;
  sortOrder: number;
}

interface StrategyScore {
  id: string;
  year: number;
  month: number;
  overallScore: number;
  completionScore: number;
  onTimeScore: number;
  consistencyScore: number;
}

interface Activity {
  id: string;
  type: "post" | "campaign" | "task" | "automation";
  title: string;
  description?: string;
  status: "on_time" | "late" | "needs_attention";
  date: string;
  metadata?: Record<string, unknown>;
}

interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
  inProgress: number;
}

interface ActivitySummary {
  total: number;
  onTime: number;
  late: number;
  needsAttention: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-200";
    case "PAUSED":
      return "bg-amber-500/10 text-amber-600 border-amber-200";
    case "TERMINATED":
      return "bg-red-500/10 text-red-600 border-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getActivityStatusIcon(status: "on_time" | "late" | "needs_attention") {
  switch (status) {
    case "on_time":
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case "late":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "needs_attention":
      return <Clock className="h-4 w-4 text-amber-500" />;
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case "post":
      return <PenSquare className="h-4 w-4 text-brand-500" />;
    case "campaign":
      return <Megaphone className="h-4 w-4 text-violet-500" />;
    case "task":
      return <Target className="h-4 w-4 text-emerald-500" />;
    case "automation":
      return <Zap className="h-4 w-4 text-amber-500" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
}

function getTaskStatusBadge(status: string) {
  switch (status) {
    case "DONE":
      return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Done</Badge>;
    case "IN_PROGRESS":
      return <Badge variant="outline" className="bg-brand-500/10 text-brand-600 border-brand-200">In Progress</Badge>;
    case "TODO":
      return <Badge variant="outline" className="bg-muted text-muted-foreground">To Do</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AgentClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [clientData, setClientData] = useState<AgentClientData | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [scores, setScores] = useState<StrategyScore[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activityStatusFilter, setActivityStatusFilter] = useState("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [impersonateDialog, setImpersonateDialog] = useState(false);
  const [impersonateReason, setImpersonateReason] = useState("");
  const [isImpersonating, setIsImpersonating] = useState(false);

  const fetchClientDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/agent/clients/${clientId}`);
      const data = await res.json();
      if (data.success) {
        setClientData(data.data.client);
        setStrategies(data.data.strategies || []);
        setScores(data.data.scores || []);
        setTaskStats(data.data.taskStats || null);
      }
    } catch (error) {
      console.error("Failed to fetch client detail:", error);
    }
  }, [clientId]);

  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activityStatusFilter !== "all") params.set("status", activityStatusFilter);
      if (activityTypeFilter !== "all") params.set("type", activityTypeFilter);

      const res = await fetch(`/api/agent/clients/${clientId}/activities?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.data.activities || []);
        setActivitySummary(data.data.summary || null);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    }
  }, [clientId, activityStatusFilter, activityTypeFilter]);

  useEffect(() => {
    Promise.all([fetchClientDetail(), fetchActivities()]).finally(() =>
      setIsLoading(false)
    );
  }, [fetchClientDetail, fetchActivities]);

  const handleImpersonate = async () => {
    if (!clientData) return;
    setIsImpersonating(true);
    try {
      const res = await fetch("/api/agent/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientData.id,
          reason: impersonateReason || "Managing client account",
        }),
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.data.redirectUrl || "/dashboard";
      }
    } catch (error) {
      console.error("Failed to start impersonation:", error);
    } finally {
      setIsImpersonating(false);
      setImpersonateDialog(false);
      setImpersonateReason("");
    }
  };

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatDateTime = (date: string) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Client not found</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/agent/clients")}>
          Back to Clients
        </Button>
      </div>
    );
  }

  const allTasks = strategies.flatMap((s) => s.tasks);
  const latestScore = scores[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agent/clients">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Clients
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {clientData.clientUser.avatarUrl ? (
              <img
                src={clientData.clientUser.avatarUrl}
                alt={clientData.clientUser.name}
                className="h-14 w-14 rounded-full object-cover"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-brand-500/10 flex items-center justify-center">
                <span className="text-xl font-semibold text-brand-500">
                  {clientData.clientUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{clientData.clientUser.name}</h1>
                <Badge variant="outline" className={getStatusColor(clientData.status)}>
                  {clientData.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{clientData.clientUser.email}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="capitalize">{clientData.clientUser.plan} plan</span>
                <span>Since {formatDate(clientData.startDate)}</span>
                <span>{formatCurrency(clientData.monthlyPriceCents)}/mo</span>
              </div>
            </div>
          </div>

          {clientData.status === "ACTIVE" && (
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => setImpersonateDialog(true)}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Login as Client
            </Button>
          )}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{latestScore?.overallScore || 0}%</p>
                <p className="text-xs text-muted-foreground">Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {taskStats?.completed || 0}/{taskStats?.total || 0}
                </p>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats?.overdue || 0}</p>
                <p className="text-xs text-muted-foreground">Overdue Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats?.inProgress || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity Center</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{clientData.clientUser.plan}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member Since</span>
                  <span className="font-medium">{formatDate(clientData.clientUser.createdAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Rate</span>
                  <span className="font-medium">{formatCurrency(clientData.monthlyPriceCents)}</span>
                </div>
                {clientData.clientUser.website && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Website</span>
                    <a
                      href={clientData.clientUser.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-500 hover:underline"
                    >
                      {clientData.clientUser.website}
                    </a>
                  </div>
                )}
                {clientData.clientUser.bio && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Bio</p>
                    <p className="text-sm">{clientData.clientUser.bio}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Strategy Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Strategies</CardTitle>
              </CardHeader>
              <CardContent>
                {strategies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active strategies</p>
                ) : (
                  <div className="space-y-3">
                    {strategies.map((strategy) => {
                      const total = strategy.tasks.length;
                      const done = strategy.tasks.filter((t) => t.status === "DONE").length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                      return (
                        <div key={strategy.id} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{strategy.name}</span>
                            <span className="text-muted-foreground">
                              {done}/{total} tasks
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          {clientData.warnings && clientData.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-red-600">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {clientData.warnings.map((warning) => (
                    <div
                      key={warning.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-200"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-red-600 border-red-200">
                            {warning.level}
                          </Badge>
                          {warning.isResolved && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1">{warning.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(warning.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Center Tab */}
        <TabsContent value="activity" className="space-y-4">
          {/* Activity Summary */}
          {activitySummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{activitySummary.total}</p>
                  <p className="text-xs text-muted-foreground">Total Activities</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-emerald-600">{activitySummary.onTime}</p>
                  <p className="text-xs text-muted-foreground">On Time</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-red-600">{activitySummary.late}</p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{activitySummary.needsAttention}</p>
                  <p className="text-xs text-muted-foreground">Needs Attention</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Activity Filters */}
          <div className="flex gap-3">
            <Select value={activityStatusFilter} onValueChange={setActivityStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on_time">On Time</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="needs_attention">Needs Attention</SelectItem>
              </SelectContent>
            </Select>
            <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="post">Posts</SelectItem>
                <SelectItem value="campaign">Campaigns</SelectItem>
                <SelectItem value="task">Tasks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Activity Feed */}
          <div className="space-y-2">
            {activities.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No activities found</p>
                </CardContent>
              </Card>
            ) : (
              activities.map((activity) => (
                <Card key={`${activity.type}-${activity.id}`} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {getTypeIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getActivityStatusIcon(activity.status)}
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(activity.date)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          {allTasks.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No strategy tasks found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allTasks.map((task) => {
                const isOverdue =
                  task.status !== "DONE" &&
                  task.dueDate &&
                  new Date(task.dueDate) < new Date();

                return (
                  <Card
                    key={task.id}
                    className={`hover:shadow-sm transition-shadow ${
                      isOverdue ? "border-red-200" : ""
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {getTaskStatusBadge(task.status)}
                            {isOverdue && (
                              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {task.category && <span className="capitalize">{task.category}</span>}
                            <span className="capitalize">{task.priority} priority</span>
                            {task.dueDate && (
                              <span>Due {formatDate(task.dueDate)}</span>
                            )}
                          </div>
                        </div>
                        {task.progress > 0 && (
                          <div className="w-16 text-right">
                            <p className="text-xs font-medium">{task.progress}%</p>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                              <div
                                className="h-full bg-brand-500 rounded-full"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {scores.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No performance data yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Score Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-brand-500">
                      {latestScore?.overallScore || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Overall Score</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-500">
                      {latestScore?.completionScore || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Completion</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-violet-500">
                      {latestScore?.onTimeScore || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">On-Time Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-amber-500">
                      {latestScore?.consistencyScore || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Consistency</p>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly Score History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scores.map((score) => {
                      const monthName = new Date(score.year, score.month - 1).toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" }
                      );
                      return (
                        <div key={score.id} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-32 shrink-0">
                            {monthName}
                          </span>
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full transition-all"
                              style={{ width: `${score.overallScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold w-12 text-right">
                            {score.overallScore}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Impersonation Dialog */}
      <Dialog
        open={impersonateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setImpersonateDialog(false);
            setImpersonateReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login as Client</DialogTitle>
            <DialogDescription>
              You are about to start managing{" "}
              <strong>{clientData.clientUser.name}</strong>&apos;s account.
              A banner will be displayed showing you are in Agent Mode.
              Financial actions (purchases, withdrawals) will be restricted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <label className="text-sm font-medium">Reason for login (optional)</label>
              <Input
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                placeholder="e.g., Creating weekly content posts"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImpersonateDialog(false);
                setImpersonateReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={handleImpersonate}
              disabled={isImpersonating}
            >
              {isImpersonating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Session...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Start Agent Session
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
