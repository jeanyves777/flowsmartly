"use client";

import { useState } from "react";
import {
  Clock,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
  Zap,
  CreditCard,
  Heart,
  Globe,
  Mail,
  BarChart3,
  ListChecks,
  ShoppingBag,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CronJob {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  schedule: string;
  frequency: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "subscriptions" | "credits" | "domains" | "content" | "ecommerce" | "engagement";
}

interface RunResult {
  jobId: string;
  success: boolean;
  data: Record<string, unknown>;
  timestamp: string;
  duration: number;
}

const CRON_JOBS: CronJob[] = [
  {
    id: "subscriptions",
    name: "Subscription Manager",
    description: "Reset expired plans to STARTER, send renewal reminders (7d/2d), dunning for failed payments",
    endpoint: "/api/cron/subscriptions",
    schedule: "0 2 * * *",
    frequency: "Daily at 2:00 AM UTC",
    icon: CreditCard,
    category: "subscriptions",
  },
  {
    id: "credits",
    name: "Credit Manager",
    description: "Check low credit balances, send warnings, safety-net monthly credit allocation",
    endpoint: "/api/cron/credits",
    schedule: "0 3 * * *",
    frequency: "Daily at 3:00 AM UTC",
    icon: Zap,
    category: "credits",
  },
  {
    id: "domain-renewals",
    name: "Domain Renewals",
    description: "Check expiring domains, send reminders (30d/7d/1d), auto-renew, retry failed registrations",
    endpoint: "/api/cron/domain-renewals",
    schedule: "0 8 * * *",
    frequency: "Daily at 8:00 AM UTC",
    icon: Globe,
    category: "domains",
  },
  {
    id: "reengagement",
    name: "Re-engagement Emails",
    description: "Send 'we miss you' emails to users inactive for 30+ days",
    endpoint: "/api/cron/reengagement",
    schedule: "0 9 * * 1",
    frequency: "Weekly on Monday at 9:00 AM UTC",
    icon: Heart,
    category: "engagement",
  },
  {
    id: "content-automation",
    name: "Content Automation",
    description: "Generate AI content and schedule posts based on user automations",
    endpoint: "/api/content/automation/scheduler",
    schedule: "*/15 * * * *",
    frequency: "Every 15 minutes",
    icon: MessageSquare,
    category: "content",
  },
  {
    id: "strategy-reminders",
    name: "Strategy Reminders",
    description: "Send reminders for content strategy tasks due within 3 days",
    endpoint: "/api/content/strategy/reminders",
    schedule: "0 7 * * *",
    frequency: "Daily at 7:00 AM UTC",
    icon: ListChecks,
    category: "content",
  },
  {
    id: "strategy-digest",
    name: "Weekly Strategy Digest",
    description: "Send weekly summary of completed, upcoming, and overdue strategy tasks",
    endpoint: "/api/content/strategy/weekly-digest",
    schedule: "0 9 * * 1",
    frequency: "Weekly on Monday at 9:00 AM UTC",
    icon: Mail,
    category: "content",
  },
  {
    id: "intelligence-weekly",
    name: "Intelligence Reports",
    description: "Generate e-commerce intelligence reports for all active stores",
    endpoint: "/api/cron/intelligence-weekly",
    schedule: "0 6 * * 0",
    frequency: "Weekly on Sunday at 6:00 AM UTC",
    icon: BarChart3,
    category: "ecommerce",
  },
  {
    id: "listsmartly-monthly",
    name: "ListSmartly Monthly",
    description: "Generate monthly presence reports for all ListSmartly profiles",
    endpoint: "/api/cron/listsmartly-monthly",
    schedule: "0 5 1 * *",
    frequency: "Monthly on the 1st at 5:00 AM UTC",
    icon: TrendingUp,
    category: "engagement",
  },
  {
    id: "trial-check",
    name: "E-commerce Trial Check",
    description: "Send trial reminders and expire free trials past their end date",
    endpoint: "/api/ecommerce/trial-check",
    schedule: "0 */6 * * *",
    frequency: "Every 6 hours",
    icon: ShoppingBag,
    category: "ecommerce",
  },
  {
    id: "stripe-sync",
    name: "Stripe Subscription Sync",
    description: "Audit all Stripe subscriptions vs local DB, report discrepancies",
    endpoint: "/api/admin/stripe-sync",
    schedule: "0 4 * * *",
    frequency: "Daily at 4:00 AM UTC",
    icon: RefreshCw,
    category: "subscriptions",
  },
];

const categoryColors: Record<string, string> = {
  subscriptions: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  credits: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  domains: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  content: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ecommerce: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  engagement: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const categoryLabels: Record<string, string> = {
  subscriptions: "Subscriptions & Billing",
  credits: "Credits",
  domains: "Domains",
  content: "Content",
  ecommerce: "E-Commerce",
  engagement: "Engagement",
};

export default function AdminCronJobsPage() {
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Map<string, RunResult>>(new Map());
  const [filter, setFilter] = useState<string>("all");

  const runJob = async (job: CronJob) => {
    setRunningJobs((prev) => new Set(prev).add(job.id));

    const start = Date.now();
    try {
      const res = await fetch(job.endpoint, {
        headers: { "x-cron-secret": "admin-manual-trigger" },
      });
      const data = await res.json();
      const duration = Date.now() - start;

      setResults((prev) => {
        const next = new Map(prev);
        next.set(job.id, {
          jobId: job.id,
          success: data.success ?? res.ok,
          data,
          timestamp: new Date().toISOString(),
          duration,
        });
        return next;
      });
    } catch (err) {
      const duration = Date.now() - start;
      setResults((prev) => {
        const next = new Map(prev);
        next.set(job.id, {
          jobId: job.id,
          success: false,
          data: { error: err instanceof Error ? err.message : "Failed" },
          timestamp: new Date().toISOString(),
          duration,
        });
        return next;
      });
    } finally {
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  const runAll = async () => {
    const jobs = filteredJobs.filter((j) => !runningJobs.has(j.id));
    for (const job of jobs) {
      await runJob(job);
    }
  };

  const categories = Array.from(new Set(CRON_JOBS.map((j) => j.category)));
  const filteredJobs = filter === "all" ? CRON_JOBS : CRON_JOBS.filter((j) => j.category === filter);

  const successCount = Array.from(results.values()).filter((r) => r.success).length;
  const failCount = Array.from(results.values()).filter((r) => !r.success).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-orange-500" />
            Cron Jobs & Scheduled Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor, trigger, and manage all automated background tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResults(new Map())}
            disabled={results.size === 0}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Clear Results
          </Button>
          <Button
            size="sm"
            onClick={runAll}
            disabled={runningJobs.size > 0}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Play className="h-4 w-4 mr-1" />
            Run All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground font-medium">Total Jobs</div>
            <div className="text-2xl font-bold mt-1">{CRON_JOBS.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground font-medium">Running</div>
            <div className="text-2xl font-bold mt-1 text-blue-500">{runningJobs.size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground font-medium">Succeeded</div>
            <div className="text-2xl font-bold mt-1 text-green-500">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground font-medium">Failed</div>
            <div className="text-2xl font-bold mt-1 text-red-500">{failCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          All ({CRON_JOBS.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === cat
                ? categoryColors[cat]
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {categoryLabels[cat]} ({CRON_JOBS.filter((j) => j.category === cat).length})
          </button>
        ))}
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const isRunning = runningJobs.has(job.id);
          const result = results.get(job.id);
          const Icon = job.icon;

          return (
            <Card key={job.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-lg shrink-0 ${categoryColors[job.category]}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{job.name}</h3>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {job.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {job.frequency}
                      </span>
                      <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {job.schedule}
                      </span>
                    </div>
                  </div>

                  {/* Status + Action */}
                  <div className="flex items-center gap-2 shrink-0">
                    {result && !isRunning && (
                      <div className="flex items-center gap-1.5">
                        {result.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {(result.duration / 1000).toFixed(1)}s
                        </span>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant={isRunning ? "secondary" : "outline"}
                      onClick={() => runJob(job)}
                      disabled={isRunning}
                      className="min-w-[80px]"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          Running
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1" />
                          Run Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Result Details */}
                {result && !isRunning && (
                  <div className={`mt-3 p-3 rounded-lg text-xs font-mono overflow-x-auto ${
                    result.success
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={result.success ? "text-green-400" : "text-red-400"}>
                        {result.success ? "SUCCESS" : "FAILED"} — {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-muted-foreground">{result.duration}ms</span>
                    </div>
                    <pre className="text-[11px] whitespace-pre-wrap break-all text-muted-foreground">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Crontab Reference */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Server Crontab (Production)
          </h3>
          <pre className="text-[11px] font-mono bg-muted p-3 rounded-lg overflow-x-auto text-muted-foreground whitespace-pre">
{`# Subscription checks - daily 2am UTC
0 2 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/cron/subscriptions

# Credit checks - daily 3am UTC
0 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/cron/credits

# Stripe sync - daily 4am UTC
0 4 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/admin/stripe-sync

# Domain renewals - daily 8am UTC
0 8 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/cron/domain-renewals

# Re-engagement - weekly Monday 9am UTC
0 9 * * 1 curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/cron/reengagement

# Content automation - every 15 minutes
*/15 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://flowsmartly.com/api/content/automation/scheduler`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
