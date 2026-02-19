"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Target,
  CheckCircle2,
  Clock,
  Activity,
  ListOrdered,
  FileText,
  Trophy,
  Star,
  Zap,
  Award,
  Rocket,
  Flame,
  Calendar,
  Share2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface ScoreFactors {
  completion: number;
  onTime: number;
  consistency: number;
  adherence: number;
  production: number;
}

interface RawData {
  totalTasks: number;
  completedTasks: number;
  tasksWithDueDate: number;
  onTimeTasks: number;
  lateTasks: number;
  activeDays: number;
  totalDaysInPeriod: number;
  maxGapDays: number;
  tasksCompletedInOrder: number;
  totalOrderedTasks: number;
  postsCreated: number;
  postsAlignedWithStrategy: number;
  taskCategories: string[];
}

interface Score {
  overall: number;
  factors: ScoreFactors;
  rawData: RawData;
}

interface Milestone {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  sharedToFeed: boolean;
  sharedPostId: string | null;
  achievedAt: string;
}

interface TimelineEntry {
  date: string;
  completed: number;
}

interface ReportData {
  score: Score;
  aiInsights: string;
  aiAreas: string[];
  trend: number;
  previousScore: number | null;
  milestones: Milestone[];
  timeline: TimelineEntry[];
  month: number;
  year: number;
  strategyName: string;
}

// --- Constants ---

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FACTOR_CONFIG: {
  key: keyof ScoreFactors;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  barColor: string;
  bgColor: string;
}[] = [
  { key: "completion", label: "Completion", icon: CheckCircle2, color: "text-green-500", barColor: "bg-green-500", bgColor: "bg-green-500/10" },
  { key: "onTime", label: "On-Time", icon: Clock, color: "text-blue-500", barColor: "bg-blue-500", bgColor: "bg-blue-500/10" },
  { key: "consistency", label: "Consistency", icon: Activity, color: "text-purple-500", barColor: "bg-purple-500", bgColor: "bg-purple-500/10" },
  { key: "adherence", label: "Adherence", icon: ListOrdered, color: "text-orange-500", barColor: "bg-orange-500", bgColor: "bg-orange-500/10" },
  { key: "production", label: "Production", icon: FileText, color: "text-cyan-500", barColor: "bg-cyan-500", bgColor: "bg-cyan-500/10" },
];

const MILESTONE_ICONS: Record<string, typeof Star> = {
  Rocket,
  Star,
  Flame,
  Trophy,
  Zap,
  Award,
  Calendar,
  Clock,
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// --- Helpers ---

function parseMonthParam(param: string): { year: number; month: number } | null {
  const match = param.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function toMonthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getAdjacentMonth(year: number, month: number, direction: -1 | 1): { year: number; month: number } {
  let newMonth = month + direction;
  let newYear = year;
  if (newMonth < 1) {
    newMonth = 12;
    newYear -= 1;
  } else if (newMonth > 12) {
    newMonth = 1;
    newYear += 1;
  }
  return { year: newYear, month: newMonth };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function getScoreGradient(score: number): string {
  if (score >= 80) return "from-green-500/20 via-emerald-500/10 to-teal-500/5";
  if (score >= 50) return "from-yellow-500/20 via-amber-500/10 to-orange-500/5";
  return "from-red-500/20 via-rose-500/10 to-pink-500/5";
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return "border-green-500/30";
  if (score >= 50) return "border-yellow-500/30";
  return "border-red-500/30";
}

function parseBoldMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// --- Main Component ---

export default function MonthlyReportPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [monthParam, setMonthParam] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharingMilestone, setSharingMilestone] = useState<string | null>(null);
  const [sharingScore, setSharingScore] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Resolve the async params
  useEffect(() => {
    params.then((resolved) => setMonthParam(resolved.month));
  }, [params]);

  const parsed = useMemo(() => {
    if (!monthParam) return null;
    return parseMonthParam(monthParam);
  }, [monthParam]);

  // --- Fetch report ---

  const fetchReport = useCallback(async () => {
    if (!parsed) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(
        `/api/content/strategy/score/report?month=${parsed.month}&year=${parsed.year}`
      );
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || "Failed to load report");
      }
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [parsed]);

  useEffect(() => {
    if (parsed) fetchReport();
  }, [parsed, fetchReport]);

  // --- Navigation helpers ---

  const prevMonth = useMemo(() => {
    if (!parsed) return null;
    return getAdjacentMonth(parsed.year, parsed.month, -1);
  }, [parsed]);

  const nextMonth = useMemo(() => {
    if (!parsed) return null;
    return getAdjacentMonth(parsed.year, parsed.month, 1);
  }, [parsed]);

  // --- Share handlers ---

  const handleShareMilestone = async (milestoneId: string) => {
    try {
      setSharingMilestone(milestoneId);
      const res = await fetch("/api/content/strategy/score/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to share");
      // Update local state
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          milestones: prev.milestones.map((m) =>
            m.id === milestoneId ? { ...m, sharedToFeed: true } : m
          ),
        };
      });
      toast({ title: "Milestone shared to feed!" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to share",
        variant: "destructive",
      });
    } finally {
      setSharingMilestone(null);
    }
  };

  const handleShareScore = async () => {
    if (!parsed) return;
    try {
      setSharingScore(true);
      const res = await fetch("/api/content/strategy/score/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "score", month: parsed.month, year: parsed.year }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to share");
      toast({ title: "Monthly score shared to feed!" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to share",
        variant: "destructive",
      });
    } finally {
      setSharingScore(false);
    }
  };

  // --- Timeline chart helpers ---

  const maxTimelineValue = useMemo(() => {
    if (!report?.timeline) return 1;
    return Math.max(1, ...report.timeline.map((t) => t.completed));
  }, [report]);

  // --- Render: Invalid param ---

  if (monthParam && !parsed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-4xl mx-auto"
      >
        <div className="flex items-center gap-4">
          <Link href="/content/strategy/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Invalid Report</h1>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-6">
            <Target className="h-5 w-5 text-destructive" />
            <span className="text-destructive text-sm">
              Invalid month format. Expected format: 2026-02
            </span>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // --- Render: Loading ---

  if (isLoading || !monthParam) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
        <div className="h-56 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // --- Render: Error ---

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-4xl mx-auto"
      >
        <div className="flex items-center gap-4">
          <Link href="/content/strategy/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {parsed ? `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}` : "Report"}
          </h1>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-6">
            <Target className="h-5 w-5 text-destructive" />
            <span className="text-destructive text-sm">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchReport} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (!report || !parsed) return null;

  const { score, aiInsights, aiAreas, trend, previousScore, milestones, timeline } = report;
  const monthLabel = `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8 max-w-4xl mx-auto pb-12"
    >
      {/* ===== Section 1: Back Navigation + Header ===== */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/content/strategy/reports">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{monthLabel}</h1>
            {report.strategyName && (
              <Badge
                variant="outline"
                className="mt-1 text-xs bg-purple-500/10 border-purple-500/20 text-purple-600"
              >
                <Target className="h-3 w-3 mr-1" />
                {report.strategyName}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {prevMonth && (
            <Link href={`/content/strategy/reports/${toMonthParam(prevMonth.year, prevMonth.month)}`}>
              <Button variant="ghost" size="icon" title={`${MONTH_NAMES[prevMonth.month - 1]} ${prevMonth.year}`}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
          )}
          {nextMonth && (
            <Link href={`/content/strategy/reports/${toMonthParam(nextMonth.year, nextMonth.month)}`}>
              <Button variant="ghost" size="icon" title={`${MONTH_NAMES[nextMonth.month - 1]} ${nextMonth.year}`}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </Link>
          )}
        </div>
      </motion.div>

      {/* ===== Section 2: Hero Score ===== */}
      <motion.div variants={itemVariants}>
        <Card className={`rounded-xl border overflow-hidden`}>
          <div className={`bg-gradient-to-br ${getScoreGradient(score.overall)} p-8 sm:p-12`}>
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 ${getScoreRingColor(score.overall)} bg-background/80 backdrop-blur-sm flex items-center justify-center mb-4`}
              >
                <motion.span
                  className={`text-5xl sm:text-6xl font-extrabold ${getScoreColor(score.overall)}`}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  {score.overall}
                </motion.span>
              </div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-3">
                Overall Score
              </p>
              {previousScore !== null ? (
                <Badge
                  variant="outline"
                  className={`text-sm px-3 py-1 ${
                    trend > 0
                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                      : trend < 0
                      ? "bg-red-500/10 text-red-600 border-red-500/20"
                      : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                  }`}
                >
                  {trend > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 mr-1" />
                  ) : trend < 0 ? (
                    <TrendingDown className="h-3.5 w-3.5 mr-1" />
                  ) : null}
                  {trend > 0 ? "+" : ""}
                  {trend} vs last month
                </Badge>
              ) : (
                <Badge variant="outline" className="text-sm px-3 py-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  First report
                </Badge>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ===== Section 3: Factor Breakdown ===== */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {FACTOR_CONFIG.map((factor, index) => {
            const Icon = factor.icon;
            const value = score.factors[factor.key];
            return (
              <motion.div
                key={factor.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.08 }}
              >
                <Card className="rounded-xl border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${factor.bgColor}`}>
                        <Icon className={`h-4 w-4 ${factor.color}`} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {factor.label}
                      </span>
                    </div>
                    <p className={`text-2xl font-bold ${factor.color}`}>{value}</p>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${factor.barColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.8, delay: 0.4 + index * 0.1 }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ===== Section 4: AI Insights ===== */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-xl border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Sparkles className="h-4 w-4 text-purple-500" />
              </div>
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiInsights ? (
              <>
                <div className="text-sm leading-relaxed text-foreground/90 space-y-2">
                  {aiInsights.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    return (
                      <p key={i}>{parseBoldMarkdown(trimmed)}</p>
                    );
                  })}
                </div>
                {aiAreas && aiAreas.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-semibold text-foreground mb-2">
                      Areas for Improvement
                    </p>
                    <ul className="space-y-1.5">
                      {aiAreas.map((area, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Target className="h-3.5 w-3.5 mt-0.5 text-orange-500 shrink-0" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Insights will be generated when you have more data.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Section 5: Task Completion Timeline (Bar Chart) ===== */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-xl border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <BarChart3 className="h-4 w-4 text-orange-500" />
              </div>
              Task Completion Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline && timeline.length > 0 ? (
              <div className="relative">
                {/* Chart area */}
                <div className="flex items-end gap-[3px] sm:gap-1 h-48 sm:h-56 px-1">
                  {timeline.map((entry, i) => {
                    const day = new Date(entry.date).getDate();
                    const heightPct = maxTimelineValue > 0
                      ? (entry.completed / maxTimelineValue) * 100
                      : 0;

                    return (
                      <div
                        key={entry.date}
                        className="flex-1 flex flex-col items-center justify-end h-full relative group"
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Tooltip */}
                        <AnimatePresence>
                          {hoveredBar === i && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute -top-10 bg-foreground text-background text-xs font-medium px-2 py-1 rounded-md shadow-lg z-10 whitespace-nowrap pointer-events-none"
                            >
                              {new Date(entry.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              : {entry.completed} task{entry.completed !== 1 ? "s" : ""}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Bar */}
                        <motion.div
                          className={`w-full rounded-t-sm min-h-[2px] transition-colors ${
                            hoveredBar === i
                              ? "bg-orange-400"
                              : entry.completed > 0
                              ? "bg-orange-500"
                              : "bg-muted"
                          }`}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPct, entry.completed > 0 ? 4 : 1)}%` }}
                          transition={{ duration: 0.5, delay: 0.05 * i }}
                        />

                        {/* X-axis label (show every day or spaced for small screens) */}
                        <span className={`text-[9px] sm:text-[10px] text-muted-foreground mt-1 ${
                          timeline.length > 20 && i % 2 !== 0
                            ? "hidden sm:block"
                            : ""
                        }`}>
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">
                No timeline data available for this month.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Section 6: Raw Stats Grid ===== */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Tasks
              </p>
              <p className="text-3xl font-bold mt-1">{score.rawData.totalTasks}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Completed
              </p>
              <p className="text-3xl font-bold mt-1 text-green-500">
                {score.rawData.completedTasks}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                On-Time
              </p>
              <p className="text-3xl font-bold mt-1 text-blue-500">
                {score.rawData.onTimeTasks}
                <span className="text-base font-normal text-muted-foreground">
                  /{score.rawData.tasksWithDueDate}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active Days
              </p>
              <p className="text-3xl font-bold mt-1 text-purple-500">
                {score.rawData.activeDays}
                <span className="text-base font-normal text-muted-foreground">
                  /{score.rawData.totalDaysInPeriod}
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Posts Created
              </p>
              <p className="text-3xl font-bold mt-1 text-orange-500">
                {score.rawData.postsCreated}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Strategy-Aligned Posts
              </p>
              <p className="text-3xl font-bold mt-1 text-cyan-500">
                {score.rawData.postsAlignedWithStrategy}
              </p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* ===== Section 7: Milestones ===== */}
      <motion.div variants={itemVariants}>
        <Card className="rounded-xl border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-yellow-500/10">
                <Trophy className="h-4 w-4 text-yellow-500" />
              </div>
              Milestones Achieved
            </CardTitle>
          </CardHeader>
          <CardContent>
            {milestones && milestones.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {milestones.map((milestone, index) => {
                  const IconComp = MILESTONE_ICONS[milestone.icon] || Star;
                  return (
                    <motion.div
                      key={milestone.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index }}
                    >
                      <div className="flex items-start gap-3 p-4 rounded-lg border bg-gradient-to-br from-yellow-500/5 to-orange-500/5 hover:from-yellow-500/10 hover:to-orange-500/10 transition-colors">
                        <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
                          <IconComp className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{milestone.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {milestone.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                            {new Date(milestone.achievedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {milestone.sharedToFeed ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                              Shared
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-muted-foreground hover:text-orange-600"
                              disabled={sharingMilestone === milestone.id}
                              onClick={() => handleShareMilestone(milestone.id)}
                            >
                              {sharingMilestone === milestone.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Share2 className="h-3 w-3 mr-1" />
                                  Share
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <Trophy className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No milestones this month. Keep completing tasks!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ===== Section 8: Share Score Button ===== */}
      <motion.div variants={itemVariants} className="flex justify-center pt-2">
        <Button
          onClick={handleShareScore}
          disabled={sharingScore}
          className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white px-8 py-3 h-auto text-base shadow-lg hover:shadow-xl transition-all"
        >
          {sharingScore ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Sharing...
            </>
          ) : (
            <>
              <Share2 className="h-5 w-5 mr-2" />
              Share Monthly Score
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
