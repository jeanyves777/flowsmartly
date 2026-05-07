"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  ListOrdered,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";

interface ScoreFactors {
  completion: number;
  onTime: number;
  consistency: number;
  adherence: number;
  production: number;
}

interface ReportMonth {
  id: string;
  month: number;
  year: number;
  overallScore: number | null;
  factors: ScoreFactors | null;
  trend: number | null;
  previousScore: number | null;
  milestoneCount: number;
  status: "stored" | "generated" | "current" | "upcoming";
  hasReport: boolean;
  emailEligible: boolean;
}

interface CurrentMonth {
  month: number;
  year: number;
  overallScore: number;
  factors: ScoreFactors;
  trend: number | null;
  milestoneCount: number;
  status?: string;
}

interface EmailAutomation {
  enabled: boolean;
  recipient: string;
  cadence: string;
  schedule: string;
}

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

const statusConfig: Record<ReportMonth["status"], { label: string; className: string }> = {
  current: {
    label: "Current month",
    className: "border-orange-500/20 bg-orange-500/10 text-orange-600",
  },
  stored: {
    label: "Saved report",
    className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
  },
  generated: {
    label: "Generated",
    className: "border-blue-500/20 bg-blue-500/10 text-blue-600",
  },
  upcoming: {
    label: "Upcoming",
    className: "border-muted bg-muted/40 text-muted-foreground",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-muted/50";
  if (score >= 80) return "bg-green-500/10";
  if (score >= 50) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getReportPath(year: number, month: number): string {
  return `/content/strategy/reports/${year}-${String(month).padStart(2, "0")}`;
}

function TrendIndicator({ trend }: { trend: number | null }) {
  if (trend === null || trend === undefined) {
    return <span className="text-xs text-muted-foreground">No previous data</span>;
  }

  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
        <TrendingUp className="h-3.5 w-3.5" />
        +{trend} pts
      </span>
    );
  }

  if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
        <TrendingDown className="h-3.5 w-3.5" />
        {trend} pts
      </span>
    );
  }

  return <span className="text-xs text-muted-foreground">No change</span>;
}

function FactorBars({ factors }: { factors: ScoreFactors | null }) {
  return (
    <div className="space-y-2">
      {FACTOR_CONFIG.map((config) => {
        const Icon = config.icon;
        const value = factors ? factors[config.key] : null;
        return (
          <div key={config.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-xs text-muted-foreground">{config.label}</span>
              </div>
              <span className="text-xs font-medium text-foreground">
                {value === null ? "--" : `${value}%`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${value || 0}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className={cn("h-full rounded-full", value === null ? "bg-muted" : config.color)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StrategyReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const initialYear = new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [yearOptions, setYearOptions] = useState<number[]>([initialYear]);
  const [months, setMonths] = useState<ReportMonth[]>([]);
  const [currentMonth, setCurrentMonth] = useState<CurrentMonth | null>(null);
  const [emailAutomation, setEmailAutomation] = useState<EmailAutomation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/content/strategy/score/report?list=true&year=${selectedYear}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch reports");
      }

      setMonths(data.data?.months || []);
      setCurrentMonth(data.data?.currentMonth || null);
      setEmailAutomation(data.data?.emailAutomation || null);
      setYearOptions(data.data?.years?.length ? data.data.years : [selectedYear]);
      if (data.data?.selectedYear && data.data.selectedYear !== selectedYear) {
        setSelectedYear(data.data.selectedYear);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const hasContent = months.some((month) => month.hasReport);

  const yearStats = useMemo(() => {
    const completed = months.filter((month) => month.hasReport).length;
    const saved = months.filter((month) => month.status === "stored").length;
    const average =
      completed > 0
        ? Math.round(
            months.reduce((sum, month) => sum + (month.overallScore || 0), 0) / completed
          )
        : 0;
    return { completed, saved, average };
  }, [months]);

  const sendReportEmail = async (month: number, year: number) => {
    const key = `${year}-${month}`;
    setSendingKey(key);
    try {
      const response = await fetch("/api/content/strategy/score/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Report email failed");
      }
      toast({
        title: "Report email sent",
        description: `Sent to ${data.data.sentTo}`,
      });
    } catch (err) {
      toast({
        title: "Report email was not sent",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingKey(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white">
                <BarChart3 className="h-5 w-5" />
              </div>
              Strategy Reports
            </h1>
            <p className="mt-1 text-muted-foreground">
              Yearly monthly reports, performance tracking, and email delivery.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {yearOptions.map((year) => (
            <Button
              key={year}
              variant={year === selectedYear ? "default" : "outline"}
              onClick={() => setSelectedYear(year)}
              className={year === selectedYear ? "bg-brand-500 text-white hover:bg-brand-600" : ""}
            >
              {year}
            </Button>
          ))}
          <Button variant="outline" onClick={fetchReports} disabled={isLoading}>
            {isLoading ? <AISpinner className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-4 p-5">
                <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="space-y-2">
                  <div className="h-2 animate-pulse rounded bg-muted" />
                  <div className="h-2 animate-pulse rounded bg-muted" />
                  <div className="h-2 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <BarChart3 className="h-5 w-5 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
            <Button variant="outline" size="sm" onClick={fetchReports} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && !hasContent && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10">
              <BarChart3 className="h-8 w-8 text-orange-500" />
            </div>
            <h3 className="mb-2 text-lg font-bold">No Reports Yet</h3>
            <p className="mb-6 max-w-sm text-sm text-muted-foreground">
              Complete strategy tasks or publish aligned content to generate the first monthly report.
            </p>
            <Link href="/content/strategy">
              <Button className="bg-brand-500 text-white hover:bg-brand-600">
                <Target className="mr-2 h-4 w-4" />
                Go to Strategy
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && hasContent && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-brand-500" />
                  {selectedYear} report year
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Generated months</p>
                  <p className="mt-1 text-2xl font-bold">{yearStats.completed}/12</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Saved reports</p>
                  <p className="mt-1 text-2xl font-bold">{yearStats.saved}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Average score</p>
                  <p className={cn("mt-1 text-2xl font-bold", getScoreColor(yearStats.average))}>
                    {yearStats.average}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-brand-500" />
                  Monthly email automation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {emailAutomation?.enabled ? "Automatic delivery active" : "Email delivery paused"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {emailAutomation?.schedule || "First day of each month"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      emailAutomation?.enabled
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                        : "border-muted bg-muted/40 text-muted-foreground"
                    }
                  >
                    {emailAutomation?.enabled ? "Enabled" : "Paused"}
                  </Badge>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Recipient: {emailAutomation?.recipient || "Current account email"}
                </div>
                {currentMonth && (
                  <Button
                    onClick={() => sendReportEmail(currentMonth.month, currentMonth.year)}
                    disabled={sendingKey === `${currentMonth.year}-${currentMonth.month}`}
                    className="w-full bg-brand-500 text-white hover:bg-brand-600"
                  >
                    {sendingKey === `${currentMonth.year}-${currentMonth.month}` ? (
                      <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send current report now
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly reports
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {months.map((month) => {
              const status = statusConfig[month.status];
              const key = `${month.year}-${month.month}`;
              return (
                <motion.div key={key} variants={itemVariants}>
                  <Card
                    role={month.hasReport ? "button" : undefined}
                    tabIndex={month.hasReport ? 0 : -1}
                    onClick={() => month.hasReport && router.push(getReportPath(month.year, month.month))}
                    onKeyDown={(event) => {
                      if (month.hasReport && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        router.push(getReportPath(month.year, month.month));
                      }
                    }}
                    className={cn(
                      "transition",
                      month.hasReport
                        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                        : "opacity-75"
                    )}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={cn(
                              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                              getScoreBgColor(month.overallScore)
                            )}
                          >
                            <span className={cn("text-xl font-bold", getScoreColor(month.overallScore))}>
                              {month.overallScore === null ? "--" : month.overallScore}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {MONTH_NAMES[month.month - 1]} {month.year}
                            </h3>
                            <TrendIndicator trend={month.trend} />
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("shrink-0 text-[10px]", status.className)}>
                          {status.label}
                        </Badge>
                      </div>

                      <FactorBars factors={month.factors} />

                      <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {month.milestoneCount > 0 ? (
                            <>
                              <Trophy className="h-3.5 w-3.5 text-amber-500" />
                              {month.milestoneCount} milestone{month.milestoneCount === 1 ? "" : "s"}
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              {month.hasReport ? "Report ready" : "Scheduled"}
                            </>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            sendReportEmail(month.month, month.year);
                          }}
                          disabled={!month.emailEligible || sendingKey === key}
                        >
                          {sendingKey === key ? (
                            <AISpinner className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Mail className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Email
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
