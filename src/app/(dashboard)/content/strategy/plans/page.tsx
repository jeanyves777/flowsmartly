"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Trash2,
  Play,
  Pause,
  Archive,
  Target,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  aiGenerated: boolean;
  totalTasks: number;
  completedTasks: number;
  createdAt: string;
  updatedAt: string;
}

// --- Constants ---

const STATUS_CONFIG: Record<
  Strategy["status"],
  { label: string; dotColor: string; bgColor: string; textColor: string }
> = {
  ACTIVE: {
    label: "Active",
    dotColor: "bg-green-500",
    bgColor: "bg-green-500/10",
    textColor: "text-green-600",
  },
  PAUSED: {
    label: "Paused",
    dotColor: "bg-yellow-500",
    bgColor: "bg-yellow-500/10",
    textColor: "text-yellow-600",
  },
  ARCHIVED: {
    label: "Archived",
    dotColor: "bg-gray-400",
    bgColor: "bg-gray-400/10",
    textColor: "text-gray-500",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// --- Helpers ---

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getProgressPercent(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// --- Main Component ---

export default function StrategyPlansPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- Data fetching ---

  const fetchStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/content/strategy/plans");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch strategies");
      }

      setStrategies(data.data?.strategies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategies");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // --- Confirm delete timer ---

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  // --- Actions ---

  const handleStatusChange = async (id: string, newStatus: Strategy["status"]) => {
    try {
      setUpdatingId(id);
      const response = await fetch(`/api/content/strategy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update strategy");
      }

      setStrategies((prev) =>
        prev.map((s) => {
          if (s.id === id) return { ...s, ...data.data.strategy };
          // When activating one, backend archives all other ACTIVE ones
          if (newStatus === "ACTIVE" && s.status === "ACTIVE") return { ...s, status: "ARCHIVED" as const };
          return s;
        })
      );
      toast({ title: `Strategy ${newStatus.toLowerCase()}` });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    try {
      setUpdatingId(id);
      setConfirmDeleteId(null);
      const response = await fetch(`/api/content/strategy/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to delete strategy");
      }

      setStrategies((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Strategy deleted" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // --- Computed stats ---

  const totalPlans = strategies.length;
  const activePlans = strategies.filter((s) => s.status === "ACTIVE").length;
  const completedPlans = strategies.filter(
    (s) => s.completedTasks === s.totalTasks && s.totalTasks > 0
  ).length;

  // --- Render ---

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/content/strategy")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              Strategy Plans
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all your marketing strategies
            </p>
          </div>
        </div>

        <Button
          onClick={() => router.push("/content/strategy/generate")}
          className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Generate New
        </Button>
      </div>

      {/* Stats Row */}
      {!isLoading && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <Card>
            <CardContent className="flex items-center gap-3 py-5 px-5">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalPlans}</p>
                <p className="text-xs text-muted-foreground">Total Plans</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 py-5 px-5">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <div className="relative">
                  <Play className="h-5 w-5 text-green-500" />
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activePlans}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 py-5 px-5">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedPlans}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error State */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStrategies}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-5 space-y-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-5 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-2/3 bg-muted rounded" />
                <div className="h-2 w-full bg-muted rounded-full" />
                <div className="flex gap-2">
                  <div className="h-8 w-20 bg-muted rounded" />
                  <div className="h-8 w-20 bg-muted rounded" />
                  <div className="h-8 w-8 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Strategy Cards Grid */}
      {!isLoading && !error && strategies.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <AnimatePresence>
            {strategies.map((strategy) => {
              const statusConfig = STATUS_CONFIG[strategy.status];
              const progressPct = getProgressPercent(
                strategy.completedTasks,
                strategy.totalTasks
              );
              const isUpdating = updatingId === strategy.id;
              const isConfirmingDelete = confirmDeleteId === strategy.id;

              return (
                <motion.div
                  key={strategy.id}
                  variants={itemVariants}
                  layout
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="rounded-xl border hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-4">
                      {/* Name + AI Badge + Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => router.push(`/content/strategy/plans/${strategy.id}`)}
                              className="font-bold text-base leading-tight truncate hover:text-orange-600 transition-colors text-left"
                            >
                              {strategy.name}
                            </button>
                            {strategy.aiGenerated && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-purple-500/10 border-purple-500/20 text-purple-600 shrink-0"
                              >
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs px-2 py-0.5 ${statusConfig.bgColor} ${statusConfig.textColor} border-transparent`}
                        >
                          <div
                            className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor} mr-1.5`}
                          />
                          {statusConfig.label}
                        </Badge>
                      </div>

                      {/* Description */}
                      {strategy.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {strategy.description}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">
                            {strategy.completedTasks}/{strategy.totalTasks} ({progressPct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${
                              progressPct === 100
                                ? "bg-green-500"
                                : progressPct > 50
                                ? "bg-emerald-500"
                                : progressPct > 0
                                ? "bg-orange-500"
                                : "bg-muted"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Created date */}
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(strategy.createdAt)}
                      </p>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {strategy.status !== "ACTIVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(strategy.id, "ACTIVE")}
                            className="text-green-600 border-green-500/30 hover:bg-green-500/10 hover:text-green-700"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Play className="h-3.5 w-3.5 mr-1" />
                            )}
                            Set Active
                          </Button>
                        )}

                        {strategy.status === "ACTIVE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(strategy.id, "PAUSED")}
                            className="text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-700"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Pause className="h-3.5 w-3.5 mr-1" />
                            )}
                            Pause
                          </Button>
                        )}

                        {strategy.status !== "ARCHIVED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => handleStatusChange(strategy.id, "ARCHIVED")}
                            className="text-gray-500 border-gray-400/30 hover:bg-gray-400/10 hover:text-gray-600"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Archive className="h-3.5 w-3.5 mr-1" />
                            )}
                            Archive
                          </Button>
                        )}

                        <div className="ml-auto">
                          <Button
                            variant="outline"
                            size="icon"
                            disabled={isUpdating}
                            onClick={() => handleDelete(strategy.id)}
                            className={`h-8 w-8 transition-colors ${
                              isConfirmingDelete
                                ? "border-red-500 bg-red-500 text-white hover:bg-red-600 hover:text-white"
                                : "text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
                            }`}
                            title={isConfirmingDelete ? "Click again to confirm" : "Delete strategy"}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isConfirmingDelete ? (
                              <span className="text-[10px] font-bold">?</span>
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && !error && strategies.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center mb-4">
                <Target className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                No strategies yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Create your first AI-powered marketing strategy to start organizing
                and tracking your marketing efforts.
              </p>
              <Button
                onClick={() => router.push("/content/strategy/generate")}
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate your first strategy
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
