"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Trophy,
  ArrowLeft,
  Calendar,
  Target,
  CheckCircle2,
  Clock,
  Activity,
  ListOrdered,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- Types ---

interface ReportSummary {
  id: string;
  month: number;
  year: number;
  overallScore: number;
  completionScore: number;
  onTimeScore: number;
  consistencyScore: number;
  adherenceScore: number;
  productionScore: number;
  previousScore: number | null;
  milestoneCount: number;
  trend: number | null;
}

interface CurrentMonth {
  month: number;
  year: number;
  overallScore: number;
  factors: {
    completion: number;
    onTime: number;
    consistency: number;
    adherence: number;
    production: number;
  };
  trend: number | null;
  milestoneCount: number;
}

// --- Constants ---

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FACTOR_CONFIG = [
  { key: "completion" as const, label: "Completion", color: "bg-green-500", icon: CheckCircle2 },
  { key: "onTime" as const, label: "On-Time", color: "bg-blue-500", icon: Clock },
  { key: "consistency" as const, label: "Consistency", color: "bg-purple-500", icon: Activity },
  { key: "adherence" as const, label: "Adherence", color: "bg-orange-500", icon: ListOrdered },
  { key: "production" as const, label: "Production", color: "bg-cyan-500", icon: FileText },
];

const REPORT_FACTOR_KEYS: Record<string, keyof ReportSummary> = {
  completion: "completionScore",
  onTime: "onTimeScore",
  consistency: "consistencyScore",
  adherence: "adherenceScore",
  production: "productionScore",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// --- Helpers ---

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-500/10";
  if (score >= 50) return "bg-yellow-500/10";
  return "text-red-500/10";
}

function getReportPath(year: number, month: number): string {
  return `/content/strategy/reports/${year}-${String(month).padStart(2, "0")}`;
}

// --- Factor Bars Component ---

function FactorBars({
  factors,
}: {
  factors: { key: string; value: number }[];
}) {
  return (
    <div className="space-y-2">
      {factors.map(({ key, value }) => {
        const config = FACTOR_CONFIG.find((f) => f.key === key);
        if (!config) return null;
        const Icon = config.icon;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{config.label}</span>
              </div>
              <span className="text-xs font-medium text-foreground">{value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
                className={`h-full rounded-full ${config.color}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Trend Indicator Component ---

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null || trend === undefined) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <span className="inline-block w-3 text-center">--</span>
        <span>No previous data</span>
      </span>
    );
  }

  if (trend > 0) {
    return (
      <span className="text-xs text-green-600 flex items-center gap-1 font-medium">
        <TrendingUp className="h-3.5 w-3.5" />
        +{trend} pts
      </span>
    );
  }

  if (trend < 0) {
    return (
      <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
        <TrendingDown className="h-3.5 w-3.5" />
        {trend} pts
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <span className="inline-block w-3 text-center">=</span>
      <span>No change</span>
    </span>
  );
}

// --- Main Component ---

export default function StrategyReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CurrentMonth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data fetching ---

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/content/strategy/score/report?list=true");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch reports");
      }

      setReports(data.data?.reports || []);
      setCurrentMonth(data.data?.currentMonth || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // --- Render ---

  const hasContent = currentMonth !== null || reports.length > 0;

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
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              Strategy Reports
            </h1>
            <p className="text-muted-foreground mt-1">
              Monthly performance scores for your marketing strategy
            </p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-6">
          {/* Current month skeleton */}
          <Card className="rounded-xl">
            <CardContent className="p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-16 w-16 bg-muted rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-32 bg-muted rounded" />
                  <div className="h-4 w-48 bg-muted rounded" />
                </div>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-3 w-8 bg-muted rounded" />
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report cards skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="rounded-xl">
                <CardContent className="p-5 space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 bg-muted rounded-xl" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-28 bg-muted rounded" />
                      <div className="h-3 w-20 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-muted rounded-full" />
                    <div className="h-1.5 w-full bg-muted rounded-full" />
                    <div className="h-1.5 w-full bg-muted rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <BarChart3 className="h-5 w-5 text-destructive" />
              <span className="text-destructive text-sm">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchReports}
                className="ml-auto"
              >
                <Loader2 className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="rounded-xl">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">
                No Reports Yet
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                Complete tasks in your strategy to build your first performance report.
              </p>
              <Link href="/content/strategy">
                <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
                  <Target className="h-4 w-4 mr-2" />
                  Go to Strategy
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Content */}
      {!isLoading && !error && hasContent && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Current Month Card */}
          {currentMonth && (
            <motion.div variants={itemVariants}>
              <Card
                className="rounded-xl border hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                onClick={() => router.push(getReportPath(currentMonth.year, currentMonth.month))}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-red-500/5 pointer-events-none" />
                <CardContent className="p-6 relative">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    {/* Score Circle */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div
                        className={`w-20 h-20 rounded-2xl flex items-center justify-center ${getScoreBgColor(
                          currentMonth.overallScore
                        )}`}
                      >
                        <span
                          className={`text-3xl font-bold ${getScoreColor(
                            currentMonth.overallScore
                          )}`}
                        >
                          {currentMonth.overallScore}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-orange-500/10 border-orange-500/20 text-orange-600 text-xs"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Current Month
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h2 className="text-lg font-bold text-foreground">
                            {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
                          </h2>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Live performance tracking for this month
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {currentMonth.milestoneCount > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 border-amber-500/20 text-amber-600 text-xs"
                            >
                              <Trophy className="h-3 w-3 mr-1" />
                              {currentMonth.milestoneCount}{" "}
                              {currentMonth.milestoneCount === 1 ? "Milestone" : "Milestones"}
                            </Badge>
                          )}
                          <TrendIndicator trend={currentMonth.trend} />
                        </div>
                      </div>

                      {/* Factor Bars */}
                      <FactorBars
                        factors={FACTOR_CONFIG.map((f) => ({
                          key: f.key,
                          value: currentMonth.factors[f.key],
                        }))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Previous Reports */}
          {reports.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Previous Reports
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {reports.map((report) => (
                  <motion.div key={report.id} variants={itemVariants}>
                    <Card
                      className="rounded-xl border hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() =>
                        router.push(getReportPath(report.year, report.month))
                      }
                    >
                      <CardContent className="p-5 space-y-4">
                        {/* Header: Month + Score */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center ${getScoreBgColor(
                                report.overallScore
                              )}`}
                            >
                              <span
                                className={`text-xl font-bold ${getScoreColor(
                                  report.overallScore
                                )}`}
                              >
                                {report.overallScore}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground group-hover:text-orange-600 transition-colors">
                                {MONTH_NAMES[report.month - 1]} {report.year}
                              </h3>
                              <TrendIndicator trend={report.trend} />
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {report.milestoneCount > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 border-amber-500/20 text-amber-600 text-[10px] px-1.5 py-0"
                              >
                                <Trophy className="h-2.5 w-2.5 mr-0.5" />
                                {report.milestoneCount}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Factor Bars */}
                        <FactorBars
                          factors={FACTOR_CONFIG.map((f) => ({
                            key: f.key,
                            value: report[REPORT_FACTOR_KEYS[f.key] as keyof ReportSummary] as number,
                          }))}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
