"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Globe, AlertTriangle, Star, Search, RefreshCw, ChevronLeft, ChevronRight, Check, Clock, MessageSquare, Sparkles, Zap, TrendingUp, ExternalLink, Settings, Activity, ThumbsUp, ThumbsDown, Minus, Play, ClipboardCheck, KeyRound, Bell, CheckCircle2, ShieldCheck, Inbox, PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AISpinner } from "@/components/shared/ai-generation-loader";

// ── Types ──

interface ProfileStats {
  citationScore: number;
  liveListings: number;
  missingListings: number;
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  coveragePercent: number;
  consistencyPercent: number;
  reviewScorePercent: number;
  plan: "basic" | "pro";
}

interface Listing {
  id: string;
  directoryName: string;
  directoryUrl: string;
  listingUrl?: string;
  submitUrl?: string;
  claimUrl?: string;
  tier: number;
  status: "live" | "missing" | "unverified" | "needs_update" | "submitted" | "claimed" | "error";
  lastChecked: string;
  iconUrl?: string;
}

interface Review {
  id: string;
  platform: string;
  authorName: string;
  rating: number;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  hasResponse: boolean;
  responseText?: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface TierBreakdown {
  tier: number;
  name: string;
  live: number;
  total: number;
}

interface AutopilotTask {
  id: string;
  listingId?: string;
  type: string;
  status: "queued" | "in_progress" | "needs_user" | "blocked" | "completed" | "failed";
  priority: number;
  title: string;
  description?: string;
  requiredAction?: string;
  assignedTo: "agent" | "user" | "admin";
  payload?: {
    directory?: { url?: string; submitUrl?: string; claimUrl?: string; apiAvailable?: boolean };
    safety?: { mode?: string; pacing?: string; policy?: string };
    steps?: string[];
  };
  directory?: { name: string; url: string; tier: number; slug: string } | null;
  listingStatus?: string | null;
  listingUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountCredential {
  id: string;
  listingId?: string;
  directoryName: string;
  loginUrl?: string;
  accountEmail?: string;
  username?: string;
  recoveryEmail?: string;
  passwordHint?: string;
  secureNotes?: string;
  verificationStatus: "pending" | "email_required" | "verified" | "blocked";
  updatedAt: string;
}

interface AutopilotState {
  settings: {
    enabled: boolean;
    autoFix: boolean;
    autoDescriptions: boolean;
    mode: string;
    lastRunAt?: string;
  };
  stats: {
    taskCounts: Record<string, number>;
    listingStatusCounts: Record<string, number>;
    savedAccounts: number;
  };
  tasks: AutopilotTask[];
  credentials: AccountCredential[];
}

// ── Constants ──

const LISTING_STATUSES: Record<string, { label: string; color: string }> = {
  live: { label: "Live", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  missing: { label: "Missing", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  unverified: { label: "Needs Verification", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  needs_update: { label: "Needs Update", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  claimed: { label: "Claimed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  error: { label: "Error", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

const TIER_NAMES: Record<number, string> = {
  1: "Essential",
  2: "Major",
  3: "Industry",
  4: "Regional",
  5: "Niche",
  6: "Emerging",
  7: "Supplementary",
};

// ── Helpers ──

function scoreColor(score: number): string {
  if (score >= 70) return "text-green-500";
  if (score >= 40) return "text-yellow-500";
  return "text-red-500";
}

function scoreBgColor(score: number): string {
  if (score >= 70) return "stroke-green-500";
  if (score >= 40) return "stroke-yellow-500";
  return "stroke-red-500";
}

function sentimentIcon(sentiment: string) {
  switch (sentiment) {
    case "positive":
      return <ThumbsUp className="h-3.5 w-3.5" />;
    case "negative":
      return <ThumbsDown className="h-3.5 w-3.5" />;
    default:
      return <Minus className="h-3.5 w-3.5" />;
  }
}

function sentimentColor(sentiment: string): string {
  switch (sentiment) {
    case "positive":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case "negative":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Score Gauge SVG ──

function ScoreGauge({ score, size = 160 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={scoreBgColor(score)}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">out of 100</span>
      </div>
    </div>
  );
}

// ── Component ──

export default function ListSmartlyDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsTotal, setListingsTotal] = useState(0);
  const [listingsPage, setListingsPage] = useState(1);
  const [listingsFilter, setListingsFilter] = useState("all");
  const [listingsTier, setListingsTier] = useState("all");
  const [listingsSearch, setListingsSearch] = useState("");
  const [listingsLoading, setListingsLoading] = useState(false);
  const [scanRunning, setScanRunning] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewPlatform, setReviewPlatform] = useState("all");
  const [reviewSentiment, setReviewSentiment] = useState("all");
  const [reviewResponseFilter, setReviewResponseFilter] = useState("all");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [tierBreakdown, setTierBreakdown] = useState<TierBreakdown[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  // Autopilot
  const [autoFixEnabled, setAutoFixEnabled] = useState(false);
  const [autoDescEnabled, setAutoDescEnabled] = useState(false);
  const [autopilotState, setAutopilotState] = useState<AutopilotState | null>(null);
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [autopilotActionLoading, setAutopilotActionLoading] = useState(false);
  const [credentialDraft, setCredentialDraft] = useState<{
    listingId: string;
    directoryName: string;
    loginUrl: string;
    accountEmail: string;
    username: string;
    recoveryEmail: string;
    passwordHint: string;
    secureNotes: string;
    verificationStatus: string;
  } | null>(null);

  const LIMIT = 250;
  const totalPages = Math.max(1, Math.ceil(listingsTotal / LIMIT));

  // ── Data Fetching ──

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/listsmartly/analytics");
      if (res.status === 404) return; // No profile yet — use defaults
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      if (json.success) {
        const sc = json.data.scores || {};
        const lc = json.data.listings?.statusCounts || {};
        const rv = json.data.reviews || {};
        setStats((prev) => ({
          ...(prev || {}),
          citationScore: sc.citationScore ?? 0,
          coveragePercent: sc.coverageScore ?? 0,
          consistencyPercent: sc.consistencyScore ?? 0,
          reviewScorePercent: sc.reviewScore ?? 0,
          liveListings: lc.live ?? 0,
          missingListings: lc.missing ?? 0,
          totalReviews: rv.total ?? 0,
          averageRating: rv.averageRating ?? 0,
          responseRate: rv.responseRate ?? 0,
          plan: prev?.plan || "basic",
        } as ProfileStats));
      }
    } catch {
      toast({ title: "Error", description: "Failed to load stats", variant: "destructive" });
    }
  }, [toast]);

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(listingsPage),
        limit: String(LIMIT),
      });
      if (listingsFilter !== "all") params.set("status", listingsFilter);
      if (listingsTier !== "all") params.set("tier", listingsTier);
      if (listingsSearch) params.set("search", listingsSearch);

      const res = await fetch(`/api/listsmartly/listings?${params}`);
      if (res.status === 404) { setListingsLoading(false); return; }
      if (!res.ok) throw new Error("Failed to fetch listings");
      const data = await res.json();
      const payload = data.data || data;
      setListings(payload.listings || []);
      setListingsTotal(payload.pagination?.total || payload.total || 0);
    } catch {
      toast({ title: "Error", description: "Failed to load listings", variant: "destructive" });
    } finally {
      setListingsLoading(false);
    }
  }, [listingsPage, listingsFilter, listingsTier, listingsSearch, toast]);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const params = new URLSearchParams();
      if (reviewPlatform !== "all") params.set("platform", reviewPlatform);
      if (reviewSentiment !== "all") params.set("sentiment", reviewSentiment);
      if (reviewResponseFilter !== "all") params.set("responded", reviewResponseFilter);

      const res = await fetch(`/api/listsmartly/reviews?${params}`);
      if (res.status === 404) { setReviewsLoading(false); return; }
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      const payload = data.data || data;
      setReviews(payload.reviews || []);
    } catch {
      toast({ title: "Error", description: "Failed to load reviews", variant: "destructive" });
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewPlatform, reviewSentiment, reviewResponseFilter, toast]);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/listsmartly/sync");
      if (!res.ok) return;
      const json = await res.json();
      const syncJob = json.data?.syncJob || json.data;
      if (json.success && syncJob) {
        setActivities([{
          id: syncJob.id,
          type: syncJob.type,
          message: `${syncJob.type} - checked ${syncJob.checkedCount}, fixed ${syncJob.fixedCount}`,
          createdAt: syncJob.createdAt,
        }]);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchTierBreakdown = useCallback(async () => {
    try {
      const res = await fetch("/api/listsmartly/analytics");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.data.listingsByTier) {
        setTierBreakdown(json.data.listingsByTier);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const fetchAutopilotSettings = useCallback(async () => {
    setAutopilotLoading(true);
    try {
      const res = await fetch("/api/listsmartly/autopilot");
      if (!res.ok) return;
      const json = await res.json();
      const state = json.data as AutopilotState;
      setAutopilotState(state);
      setAutoFixEnabled(state.settings.autoFix || false);
      setAutoDescEnabled(state.settings.autoDescriptions || false);
    } catch {
      // Non-critical
    } finally {
      setAutopilotLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchStats();
      setLoading(false);
    }
    init();
  }, [fetchStats]);

  // Tab-specific data
  useEffect(() => {
    if (activeTab === "listings") fetchListings();
  }, [activeTab, fetchListings]);

  useEffect(() => {
    if (activeTab === "reviews") fetchReviews();
  }, [activeTab, fetchReviews]);

  useEffect(() => {
    if (activeTab === "overview") {
      fetchActivities();
    }
  }, [activeTab, fetchActivities]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchTierBreakdown();
    }
  }, [activeTab, fetchTierBreakdown]);

  useEffect(() => {
    if (activeTab === "autopilot") {
      fetchAutopilotSettings();
    }
  }, [activeTab, fetchAutopilotSettings]);

  // ── Actions ──

  async function runScan() {
    setScanRunning(true);
    try {
      const res = await fetch("/api/listsmartly/listings/scan", { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      toast({ title: "Scan started", description: "Directory scan is running in the background." });
      // Refresh after a short delay
      setTimeout(() => {
        fetchListings();
        fetchReviews();
        fetchStats();
      }, 3000);
    } catch {
      toast({ title: "Error", description: "Failed to start scan", variant: "destructive" });
    } finally {
      setScanRunning(false);
    }
  }

  async function toggleAutopilot(setting: "autoFix" | "autoDescriptions", value: boolean) {
    try {
      const res = await fetch("/api/listsmartly/autopilot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [setting]: value }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const json = await res.json();
      if (json.success && json.data) setAutopilotState(json.data);
      if (setting === "autoFix") setAutoFixEnabled(value);
      else setAutoDescEnabled(value);
      toast({ title: "Updated", description: `${setting === "autoFix" ? "Auto-fix" : "Auto-descriptions"} ${value ? "enabled" : "disabled"}.` });
    } catch {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    }
  }

  async function runAutopilotAction(action: string, body: Record<string, unknown> = {}) {
    setAutopilotActionLoading(true);
    try {
      const res = await fetch("/api/listsmartly/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      if (!res.ok) throw new Error("Action failed");
      const json = await res.json();
      if (json.success && json.data?.state) {
        setAutopilotState(json.data.state);
        setAutoFixEnabled(json.data.state.settings.autoFix || false);
        setAutoDescEnabled(json.data.state.settings.autoDescriptions || false);
      }
      toast({
        title: "Autopilot updated",
        description:
          action === "prepare_queue"
            ? "The guided listing queue is ready."
            : "The workflow has been updated.",
      });
    } catch {
      toast({ title: "Error", description: "Failed to run autopilot action", variant: "destructive" });
    } finally {
      setAutopilotActionLoading(false);
    }
  }

  async function saveCredentialDraft() {
    if (!credentialDraft) return;
    await runAutopilotAction("save_credential", { credential: credentialDraft });
    setCredentialDraft(null);
  }

  // ── Loading State ──

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // ── Overview Tab ──

  function renderOverview() {
    const s = stats;
    if (!s) return null;

    return (
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Citation Score</p>
                  <p className={`text-2xl font-bold ${scoreColor(s.citationScore)}`}>
                    {s.citationScore}
                  </p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  s.citationScore >= 70 ? "bg-green-500/10" : s.citationScore >= 40 ? "bg-yellow-500/10" : "bg-red-500/10"
                }`}>
                  <BarChart3 className={`h-5 w-5 ${scoreColor(s.citationScore)}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Live Listings</p>
                  <p className="text-2xl font-bold text-green-500">{s.liveListings}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Missing</p>
                  <p className="text-2xl font-bold text-red-500">{s.missingListings}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reviews</p>
                  <p className="text-2xl font-bold text-blue-500">{s.totalReviews}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Score Tracker + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Tracker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center mb-6">
                <ScoreGauge score={s.citationScore} size={160} />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="text-foreground font-medium">{s.coveragePercent}%</span>
                  </div>
                  <Progress value={s.coveragePercent} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Consistency</span>
                    <span className="text-foreground font-medium">{s.consistencyPercent}%</span>
                  </div>
                  <Progress value={s.consistencyPercent} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Reviews</span>
                    <span className="text-foreground font-medium">{s.reviewScorePercent}%</span>
                  </div>
                  <Progress value={s.reviewScorePercent} className="h-2" />
                </div>
              </div>

              <div className="mt-6 p-3 rounded-lg bg-muted text-center">
                <p className="text-xs text-muted-foreground">6-month trend coming soon</p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity + Priority Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="text-center py-6">
                    <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div>
                          <p className="text-sm text-foreground">{a.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Priority Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {s.missingListings > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {s.missingListings} missing listing{s.missingListings !== 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submit to improve your citation score
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveTab("listings")}>
                        View
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All caught up!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ── Listings Tab ──

  function renderListings() {
    const groups = [
      {
        title: "Action Queue",
        description: "Directories that need creation, claiming, or correction.",
        icon: AlertTriangle,
        statuses: ["missing", "needs_update"],
        accent: "border-red-500/20 bg-red-500/5",
      },
      {
        title: "Needs Verification",
        description: "Not confirmed missing yet. These need another check before submission.",
        icon: Search,
        statuses: ["unverified"],
        accent: "border-amber-500/20 bg-amber-500/5",
      },
      {
        title: "Live & Submitted",
        description: "Listings already found, claimed, or submitted.",
        icon: CheckCircle2,
        statuses: ["live", "submitted", "claimed"],
        accent: "border-green-500/20 bg-green-500/5",
      },
      {
        title: "Needs Attention",
        description: "Errors or blocked records that need a manual review.",
        icon: PauseCircle,
        statuses: ["error"],
        accent: "border-border bg-card",
      },
    ];

    const filteredGroups = groups
      .map((group) => ({
        ...group,
        items: listings.filter((listing) => group.statuses.includes(listing.status)),
      }))
      .filter((group) => group.items.length > 0);

    const groupByTier = (items: Listing[]) => {
      const grouped = new Map<number, Listing[]>();
      for (const item of items) {
        const current = grouped.get(item.tier) || [];
        current.push(item);
        grouped.set(item.tier, current);
      }
      return Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([tier, tierItems]) => ({ tier, items: tierItems }));
    };

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search directories..."
              value={listingsSearch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setListingsSearch(e.target.value);
                setListingsPage(1);
              }}
              className="pl-10"
            />
          </div>

          <select
            value={listingsFilter}
            onChange={(e) => { setListingsFilter(e.target.value); setListingsPage(1); }}
            className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="live">Live</option>
            <option value="missing">Missing</option>
            <option value="unverified">Needs Verification</option>
            <option value="needs_update">Needs Update</option>
            <option value="submitted">Submitted</option>
          </select>

          <select
            value={listingsTier}
            onChange={(e) => { setListingsTier(e.target.value); setListingsPage(1); }}
            className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
          >
            <option value="all">All Tiers</option>
            {[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <option key={t} value={String(t)}>Tier {t} - {TIER_NAMES[t]}</option>
            ))}
          </select>

          <Button variant="outline" onClick={runScan} disabled={scanRunning}>
            {scanRunning ? (
              <AISpinner className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Scan
          </Button>
        </div>

        {/* Listings grouped by workflow state */}
        {listingsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Globe className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">No listings found</p>
              <p className="text-sm text-muted-foreground">
                {listingsSearch || listingsFilter !== "all" || listingsTier !== "all"
                  ? "Try adjusting your filters."
                  : "Run a scan to discover your directory listings."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const Icon = group.icon;
                return (
                  <details
                    key={group.title}
                    className={`rounded-md border ${group.accent}`}
                    open={group.items.length <= 12}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Icon className="h-4 w-4 shrink-0" />
                          {group.title}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{group.description}</span>
                      </span>
                      <Badge variant="secondary" className="shrink-0">{group.items.length}</Badge>
                    </summary>
                    <div className="space-y-3 border-t border-border p-4">
                      {groupByTier(group.items).map(({ tier, items }) => (
                        <details
                          key={`${group.title}-${tier}`}
                          className="rounded-md border border-border bg-background/60"
                          open={items.length <= 6}
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                            <span className="text-sm font-medium text-foreground">
                              Tier {tier} - {TIER_NAMES[tier] || "Directory"}
                            </span>
                            <Badge variant="outline" className="shrink-0">{items.length}</Badge>
                          </summary>
                          <div className="max-h-[420px] space-y-2 overflow-y-auto border-t border-border p-3">
                            {items.map((listing) => {
                              const statusInfo = LISTING_STATUSES[listing.status] || LISTING_STATUSES.error;
                              const primaryUrl =
                                listing.listingUrl ||
                                listing.submitUrl ||
                                listing.claimUrl ||
                                listing.directoryUrl;
                              return (
                                <div
                                  key={listing.id}
                                  className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                                >
                                  <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground">
                                      {listing.directoryName}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <Badge className={`text-[10px] h-5 ${statusInfo.color}`}>{statusInfo.label}</Badge>
                                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {listing.lastChecked
                                          ? new Date(listing.lastChecked).toLocaleDateString()
                                          : "Never checked"}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {listing.status !== "live" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="hidden sm:inline-flex"
                                        onClick={() => {
                                          setActiveTab("autopilot");
                                          setTimeout(() => {
                                            void runAutopilotAction("prepare_queue");
                                          }, 0);
                                        }}
                                      >
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        Queue
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" asChild>
                                      <a href={primaryUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ))}
                    </div>
                  </details>
                );
              })}

              {filteredGroups.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-foreground font-medium mb-1">No matching listings</p>
                    <p className="text-sm text-muted-foreground">Try a broader filter or search term.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(listingsPage - 1) * LIMIT + 1}-{Math.min(listingsPage * LIMIT, listingsTotal)} of {listingsTotal}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setListingsPage((p) => Math.max(1, p - 1))}
                    disabled={listingsPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setListingsPage((p) => Math.min(totalPages, p + 1))}
                    disabled={listingsPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Reviews Tab ──

  function renderReviews() {
    return (
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 p-1 rounded-lg bg-muted">
            {["all", "google", "yelp", "facebook"].map((p) => (
              <button
                key={p}
                onClick={() => setReviewPlatform(p)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  reviewPlatform === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={reviewSentiment}
            onChange={(e) => setReviewSentiment(e.target.value)}
            className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          <select
            value={reviewResponseFilter}
            onChange={(e) => setReviewResponseFilter(e.target.value)}
            className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
          >
            <option value="all">All Responses</option>
            <option value="true">Responded</option>
            <option value="false">Not Responded</option>
          </select>

          <Button variant="outline" onClick={runScan} disabled={scanRunning}>
            {scanRunning ? (
              <AISpinner className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Reviews
          </Button>
        </div>

        {/* Reviews list */}
        {reviewsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-foreground font-medium mb-1">No reviews found</p>
              <p className="text-sm text-muted-foreground">
                Reviews will appear here once they are synced from your listings.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground">{review.authorName}</span>
                        <Badge variant="secondary" className="text-[10px]">{review.platform}</Badge>
                        <Badge className={`text-[10px] ${sentimentColor(review.sentiment)}`}>
                          {sentimentIcon(review.sentiment)}
                          <span className="ml-1">{review.sentiment}</span>
                        </Badge>
                      </div>
                      <StarRating rating={review.rating} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-foreground mt-2">{review.text}</p>

                  {review.hasResponse && review.responseText && (
                    <div className="mt-3 p-3 rounded-lg bg-muted">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Your Response</p>
                      <p className="text-sm text-foreground">{review.responseText}</p>
                    </div>
                  )}

                  {!review.hasResponse && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Coming Soon",
                            description: "AI-powered review responses will be available soon.",
                          });
                        }}
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Draft AI Response
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Analytics Tab ──

  function renderAnalytics() {
    const s = stats;
    if (!s) return null;

    return (
      <div className="space-y-6">
        {/* Score gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Citation Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ScoreGauge score={s.citationScore} size={200} />
            <div className="mt-4 p-3 rounded-lg bg-muted w-full text-center">
              <p className="text-xs text-muted-foreground">Score trend coming in monthly reports</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tier breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Coverage by Tier</CardTitle>
            </CardHeader>
            <CardContent>
              {tierBreakdown.length === 0 ? (
                <div className="text-center py-6">
                  <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No tier data available yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tierBreakdown.map((tier) => {
                    const pct = tier.total > 0 ? Math.round((tier.live / tier.total) * 100) : 0;
                    return (
                      <div key={tier.tier}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-foreground">
                            Tier {tier.tier} - {tier.name}
                          </span>
                          <span className="text-muted-foreground">
                            {tier.live}/{tier.total} ({pct}%)
                          </span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Total Reviews</span>
                  <span className="text-lg font-bold text-foreground">{s.totalReviews}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Average Rating</span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={Math.round(s.averageRating)} />
                    <span className="text-lg font-bold text-foreground">{s.averageRating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <span className="text-sm text-muted-foreground">Response Rate</span>
                  <span className="text-lg font-bold text-foreground">{s.responseRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Autopilot Tab ──

  function renderAutopilot() {
    const hasAccess = true;
    const state = autopilotState;
    const tasks = state?.tasks || [];
    const credentials = state?.credentials || [];
    const nextTask = tasks.find((task) => ["queued", "needs_user", "in_progress"].includes(task.status));
    const taskGroups = [
      { key: "needs_user", title: "Needs Your Validation", icon: Bell },
      { key: "in_progress", title: "Agent Working", icon: Sparkles },
      { key: "queued", title: "Prepared Queue", icon: ClipboardCheck },
      { key: "blocked", title: "Blocked", icon: PauseCircle },
      { key: "completed", title: "Verified Done", icon: CheckCircle2 },
    ].map((group) => ({
      ...group,
      items: tasks.filter((task) => task.status === group.key),
      count: state?.stats.taskCounts[group.key] || 0,
    }));

    const groupTasksByTier = (items: AutopilotTask[]) => {
      const grouped = new Map<number, AutopilotTask[]>();
      for (const item of items) {
        const tier = item.directory?.tier || Math.max(1, Math.min(7, item.priority % 10 || 7));
        const current = grouped.get(tier) || [];
        current.push(item);
        grouped.set(tier, current);
      }
      return Array.from(grouped.entries())
        .sort(([a], [b]) => a - b)
        .map(([tier, tierItems]) => ({ tier, items: tierItems }));
    };

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Listing Agent
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { label: "Prepared", value: state?.stats.taskCounts.queued || 0, icon: ClipboardCheck },
                { label: "Autopilot Working", value: state?.stats.taskCounts.in_progress || 0, icon: Sparkles },
                { label: "Needs User", value: state?.stats.taskCounts.needs_user || 0, icon: Bell },
                { label: "Verified Done", value: state?.stats.taskCounts.completed || 0, icon: CheckCircle2 },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-background/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Controlled, human-safe submission flow</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The agent prepares each directory, stores account progress, and pauses for email, SMS, CAPTCHA,
                    phone, or admin approval. It uses official integrations or guided handoff only.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => runAutopilotAction("prepare_queue")}
                disabled={autopilotActionLoading || autopilotLoading}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Prepare Agent Queue
              </Button>
              <Button
                variant="outline"
                onClick={() => runAutopilotAction("run_next")}
                disabled={autopilotActionLoading || autopilotLoading}
              >
                <Play className="h-4 w-4 mr-2" />
                Run Autopilot
              </Button>
              {nextTask && (
                <p className="text-xs text-muted-foreground">
                  Active: <span className="text-foreground font-medium">{nextTask.title}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workflow Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                key: "autoFix" as const,
                enabled: autoFixEnabled,
                title: "Auto-fix Inconsistencies",
                description: "Prepare correction tasks when NAP data does not match your business profile.",
              },
              {
                key: "autoDescriptions" as const,
                enabled: autoDescEnabled,
                title: "Auto-generate Descriptions",
                description: "Draft directory-specific descriptions for approval before submission.",
              },
            ].map((setting) => (
              <div key={setting.key} className="flex items-center justify-between rounded-md border border-border p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{setting.title}</p>
                  <p className="text-xs text-muted-foreground">{setting.description}</p>
                </div>
                <button
                  onClick={() => hasAccess && toggleAutopilot(setting.key, !setting.enabled)}
                  disabled={!hasAccess}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    setting.enabled && hasAccess ? "bg-primary" : "bg-muted"
                  } ${!hasAccess ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow transition-transform ${
                      setting.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progressive Work Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {autopilotLoading ? (
              <Skeleton className="h-40" />
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <Zap className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No workflow yet</p>
                <p className="text-xs text-muted-foreground mt-1">Prepare the queue to build a careful listing plan.</p>
              </div>
            ) : (
              taskGroups.filter((group) => group.count > 0).map((group) => {
                const Icon = group.icon;
                return (
                  <details
                    key={group.key}
                    className="rounded-md border border-border bg-background/50"
                    open={group.key === "in_progress" || group.key === "needs_user"}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Icon className="h-4 w-4" />
                        {group.title}
                      </span>
                      <Badge variant="secondary">{group.count}</Badge>
                    </summary>
                    <div className="space-y-3 border-t border-border p-4">
                      {group.items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No preview rows loaded for this status. Use the summary count to track it.
                        </p>
                      ) : (
                        groupTasksByTier(group.items).map(({ tier, items }) => (
                          <details
                            key={`${group.key}-${tier}`}
                            className="rounded-md border border-border bg-card"
                            open={items.length <= 4}
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                              <span className="text-sm font-medium text-foreground">
                                Tier {tier} - {TIER_NAMES[tier] || "Directory"}
                              </span>
                              <Badge variant="outline">{items.length}</Badge>
                            </summary>
                            <div className="max-h-[420px] divide-y divide-border overflow-y-auto border-t border-border">
                              {items.map((task) => {
                                const canWork = task.status === "in_progress" || task.status === "needs_user";
                                return (
                                  <div key={task.id} className="p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                                          <Badge variant="outline" className="text-[10px]">Priority {task.priority}</Badge>
                                          <Badge variant="secondary" className="text-[10px]">{task.assignedTo}</Badge>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">{task.requiredAction || task.description}</p>
                                        {task.payload?.safety?.mode && (
                                          <p className="mt-1 text-[11px] text-muted-foreground">
                                            Mode: {task.payload.safety.mode.replaceAll("_", " ")}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {task.status === "needs_user" ? (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                const directoryUrl =
                                                  task.payload?.directory?.submitUrl ||
                                                  task.payload?.directory?.claimUrl ||
                                                  task.payload?.directory?.url ||
                                                  task.directory?.url ||
                                                  "";
                                                setCredentialDraft({
                                                  listingId: task.listingId || "",
                                                  directoryName: task.directory?.name || task.title,
                                                  loginUrl: directoryUrl,
                                                  accountEmail: "",
                                                  username: "",
                                                  recoveryEmail: "",
                                                  passwordHint: "",
                                                  secureNotes: "",
                                                  verificationStatus: "pending",
                                                });
                                              }}
                                            >
                                              <KeyRound className="h-3 w-3 mr-1" />
                                              Save Verification Result
                                            </Button>
                                            <Button
                                              size="sm"
                                              onClick={() => runAutopilotAction("complete_task", { taskId: task.id, result: { completedBy: "user" } })}
                                            >
                                              <Check className="h-3 w-3 mr-1" />
                                              Mark Verified
                                            </Button>
                                          </>
                                        ) : canWork ? (
                                          <Badge variant="secondary">Autopilot working</Badge>
                                        ) : (
                                          <Badge variant="secondary">Prepared</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        ))
                      )}
                      {group.items.length > 0 && group.count > group.items.length && (
                        <p className="text-xs text-muted-foreground">
                          Showing {group.items.length} preview item{group.items.length === 1 ? "" : "s"} of {group.count}.
                        </p>
                      )}
                    </div>
                  </details>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Listing Account Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {credentialDraft && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Save verified listing access</p>
                    <p className="text-xs text-muted-foreground">{credentialDraft.directoryName}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setCredentialDraft(null)}>
                    Cancel
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    placeholder="Login URL"
                    value={credentialDraft.loginUrl}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, loginUrl: e.target.value })}
                  />
                  <Input
                    placeholder="Account email used after creation"
                    value={credentialDraft.accountEmail}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, accountEmail: e.target.value })}
                  />
                  <Input
                    placeholder="Username after creation"
                    value={credentialDraft.username}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, username: e.target.value })}
                  />
                  <Input
                    placeholder="Recovery email"
                    value={credentialDraft.recoveryEmail}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, recoveryEmail: e.target.value })}
                  />
                  <Input
                    placeholder="Password hint or vault reference"
                    value={credentialDraft.passwordHint}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, passwordHint: e.target.value })}
                  />
                  <select
                    value={credentialDraft.verificationStatus}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, verificationStatus: e.target.value })}
                    className="rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm"
                  >
                    <option value="pending">Pending</option>
                    <option value="email_required">Email verification required</option>
                    <option value="verified">Verified</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <Input
                    className="md:col-span-2"
                    placeholder="Verification notes or vault reference (no raw passwords)"
                    value={credentialDraft.secureNotes}
                    onChange={(e) => setCredentialDraft({ ...credentialDraft, secureNotes: e.target.value })}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button onClick={saveCredentialDraft} disabled={autopilotActionLoading}>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Save Details
                  </Button>
                </div>
              </div>
            )}

            {credentials.length === 0 ? (
              <div className="text-center py-8">
                <KeyRound className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No listing accounts saved yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Verified created accounts appear here after the agent or user saves real access details.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {credentials.map((credential) => (
                  <div key={credential.id} className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{credential.directoryName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {credential.accountEmail || credential.username || "Account details saved"}
                        </p>
                      </div>
                      <Badge variant="secondary">{credential.verificationStatus.replace("_", " ")}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {credential.loginUrl && (
                        <a className="inline-flex items-center gap-1 text-blue-500 hover:underline" href={credential.loginUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                          Open portal
                        </a>
                      )}
                      {credential.passwordHint && <p>Hint: {credential.passwordHint}</p>}
                      {credential.secureNotes && <p>{credential.secureNotes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Main Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ListSmartly</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business listings across 161+ directories
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/listsmartly/settings")}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="listings">
            <Globe className="h-4 w-4 mr-1.5" />
            Listings
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Reviews
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="autopilot">
            <Sparkles className="h-4 w-4 mr-1.5" />
            Autopilot
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>
        <TabsContent value="listings" className="mt-6">
          {renderListings()}
        </TabsContent>
        <TabsContent value="reviews" className="mt-6">
          {renderReviews()}
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          {renderAnalytics()}
        </TabsContent>
        <TabsContent value="autopilot" className="mt-6">
          {renderAutopilot()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
