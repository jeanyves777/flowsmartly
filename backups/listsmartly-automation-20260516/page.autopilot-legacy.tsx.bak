"use client";

import { useState, useEffect, useCallback, useRef, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Globe, AlertTriangle, Star, Search, RefreshCw, ChevronLeft, ChevronRight, Check, Clock, MessageSquare, Sparkles, Zap, TrendingUp, ExternalLink, Settings, Activity, ThumbsUp, ThumbsDown, Minus, Play, ClipboardCheck, KeyRound, Bell, CheckCircle2, ShieldCheck, Inbox, PauseCircle, Monitor, MousePointer2, Keyboard } from "lucide-react";
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
import { LISTSMARTLY_EXTRA_RUN_CREDIT_COST } from "@/lib/constants/listsmartly";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";

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
  directoryCategory?: string;
  priority?: number;
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

interface AutopilotProgressEvent {
  stage: string;
  label: string;
  status: "done" | "active" | "waiting" | "failed";
  detail?: string;
  at?: string;
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
  result?: {
    stage?: string;
    statusMessage?: string;
    progress?: AutopilotProgressEvent[];
    portalUrl?: string;
    discoveredLinks?: string[];
    listingUrl?: string;
    error?: string;
    agentAttemptedAccountCreation?: boolean;
    accountCreationBlocker?: string;
    accountCreated?: boolean;
    credentialSaved?: boolean;
    emailSentByFlowSmartly?: boolean;
    verificationCodeAttempted?: boolean;
    verificationCodeAttemptCount?: number;
    browserSessionHeld?: boolean;
    browserSessionResumed?: boolean;
    browserSessionExpiresAt?: string;
    userActionTitle?: string;
    userActionMessage?: string;
    userActionButtonLabel?: string;
    userActionInputKind?: "verification_code";
    userActionInputLabel?: string;
    userActionInputPlaceholder?: string;
    userActionInputRequired?: boolean;
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
  runtime?: {
    queueReady: boolean;
    canPrepareQueue: boolean;
    canRun: boolean;
    canRunExtra?: boolean;
    extraRunCost?: number;
    creditsAvailable?: number;
    activeTask?: {
      id: string;
      title: string;
      status: string;
      stage?: string;
      statusMessage?: string;
      progress?: AutopilotProgressEvent[];
      canRetry?: boolean;
      retryLabel?: string;
      retryMessage?: string | null;
      updatedAt: string;
      directory?: { name: string; url: string; tier: number; slug: string } | null;
    } | null;
    lastStartedAt?: string | null;
    nextRunAt?: string | null;
    message?: string;
  };
  tasks: AutopilotTask[];
  credentials: AccountCredential[];
}

interface LiveBrowserView {
  active: boolean;
  url?: string;
  title?: string;
  image?: string;
  contentType?: string;
  viewport?: { width: number; height: number };
  expiresAt?: string;
  directoryName?: string;
  cursor?: { x: number; y: number; at: string };
  lastHumanActionAt?: string;
  reason?: string;
}

type LiveBrowserControlOptions = {
  background?: boolean;
  refreshState?: boolean;
  suppressToast?: boolean;
  timeoutMs?: number;
};

type LiveBrowserPoint = { x: number; y: number };

// ── Constants ──

const LISTING_STATUSES: Record<string, { label: string; color: string }> = {
  live: { label: "Live", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  missing: { label: "Missing", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  unverified: { label: "Not Scanned", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
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

function formatWorkflowMode(mode?: string): string {
  if (!mode) return "Directory web workflow";
  if (mode === "api_or_web_workflow") return "Web workflow";
  if (mode === "web_workflow") return "Web workflow";
  if (mode === "assisted_manual_handoff") return "Web workflow with user validation";
  if (mode === "official_api_or_assisted") return "Web workflow";
  return mode.replaceAll("_", " ");
}

function formatNextRun(value?: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function progressStatusClass(status: AutopilotProgressEvent["status"]): string {
  if (status === "done") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (status === "active") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  if (status === "waiting") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-red-500/40 bg-red-500/10 text-red-300";
}

function progressDotClass(status: AutopilotProgressEvent["status"]): string {
  if (status === "done") return "bg-emerald-500";
  if (status === "active") return "bg-sky-500";
  if (status === "waiting") return "bg-amber-500";
  return "bg-red-500";
}

function userActionBadgeLabel(blocker?: string): string {
  if (blocker === "waiting_for_email_verification") return "Email code needed";
  if (blocker === "waiting_for_phone_verification") return "Phone code needed";
  if (blocker === "waiting_for_captcha") return "Portal validation";
  if (blocker === "waiting_for_business_email") return "Profile info needed";
  if (blocker === "business_email_required" || blocker === "business_email_missing") return "Profile info needed";
  if (blocker === "email_confirmation_required") return "Email validation likely";
  if (blocker === "captcha_required") return "Portal validation";
  if (blocker === "creation_page_unreachable") return "Portal access needed";
  return "Portal step needed";
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
  const [lastAutopilotRefresh, setLastAutopilotRefresh] = useState<string | null>(null);
  const [verificationInputs, setVerificationInputs] = useState<Record<string, string>>({});
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
  const [liveBrowserView, setLiveBrowserView] = useState<LiveBrowserView | null>(null);
  const [liveBrowserLoading, setLiveBrowserLoading] = useState(false);
  const [liveBrowserError, setLiveBrowserError] = useState<string | null>(null);
  const [liveControlText, setLiveControlText] = useState("");
  const [liveControlLoading, setLiveControlLoading] = useState(false);
  const liveBrowserRef = useRef<HTMLImageElement | null>(null);
  const livePointerDraggingRef = useRef(false);
  const livePointerIdRef = useRef<number | null>(null);
  const liveMoveTimerRef = useRef<number | null>(null);
  const liveMoveSentAtRef = useRef(0);
  const liveMoveInFlightRef = useRef(false);
  const livePendingMoveRef = useRef<(LiveBrowserPoint & { taskId: string }) | null>(null);
  const livePointerCommandRef = useRef<Promise<void>>(Promise.resolve());

  const LIMIT = 250;
  const totalPages = Math.max(1, Math.ceil(listingsTotal / LIMIT));
  const liveBrowserTaskId =
    autopilotState?.runtime?.activeTask?.id ||
    autopilotState?.tasks.find((task) => task.status === "needs_user")?.id ||
    null;

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

  const fetchAutopilotSettings = useCallback(async (silent = false) => {
    if (!silent) setAutopilotLoading(true);
    try {
      const res = await fetch("/api/listsmartly/autopilot");
      if (!res.ok) return;
      const json = await res.json();
      const state = json.data as AutopilotState;
      setAutopilotState(state);
      setAutoFixEnabled(state.settings.autoFix || false);
      setAutoDescEnabled(state.settings.autoDescriptions || false);
      setLastAutopilotRefresh(new Date().toISOString());
    } catch {
      // Non-critical
    } finally {
      if (!silent) setAutopilotLoading(false);
    }
  }, []);

  const fetchLiveBrowser = useCallback(async (taskId?: string | null, silent = true) => {
    if (!taskId) {
      setLiveBrowserView(null);
      setLiveBrowserError(null);
      return;
    }
    if (!silent) setLiveBrowserLoading(true);
    try {
      const res = await fetch(`/api/listsmartly/autopilot/browser?taskId=${encodeURIComponent(taskId)}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message || "Failed to load live browser");
      setLiveBrowserView(json.data as LiveBrowserView);
      setLiveBrowserError(null);
    } catch (error) {
      setLiveBrowserView(null);
      setLiveBrowserError(error instanceof Error ? error.message : "Failed to load live browser");
    } finally {
      if (!silent) setLiveBrowserLoading(false);
    }
  }, []);

  const sendLiveBrowserControl = useCallback(async (
    taskId: string | null | undefined,
    control: Record<string, unknown>,
    options: LiveBrowserControlOptions = {}
  ) => {
    const action = String(control.action || "");
    const pointerAction = action === "move" || action === "mouse_down" || action === "mouse_up";
    const background = options.background ?? pointerAction;
    if (!taskId || (!background && liveControlLoading)) return;
    if (!background) setLiveControlLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      options.timeoutMs || (action === "press_hold" ? 40000 : pointerAction ? 8000 : 12000)
    );
    try {
      const res = await fetch("/api/listsmartly/autopilot/browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ taskId, ...control }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message || "Failed to control live browser");
      const nextView = json?.data as LiveBrowserView | undefined;
      if (nextView) {
        setLiveBrowserView((current) =>
          nextView.active
            ? {
                ...(current || {}),
                ...nextView,
                image: nextView.image || current?.image,
                contentType: nextView.contentType || current?.contentType,
              }
            : nextView
        );
      }
      setLiveBrowserError(null);
      if (options.refreshState ?? (!pointerAction || action === "mouse_up")) {
        void fetchAutopilotSettings(true);
      }
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "The browser command took too long. Refresh the live browser and try again."
          : error instanceof Error
            ? error.message
            : "Failed to control live browser";
      if (!options.suppressToast) {
        setLiveBrowserError(message);
        toast({ title: "Live browser control failed", description: message, variant: "destructive" });
      }
    } finally {
      window.clearTimeout(timeout);
      if (!background) setLiveControlLoading(false);
    }
  }, [fetchAutopilotSettings, liveControlLoading, toast]);

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

  useEffect(() => {
    if (activeTab !== "autopilot") return;
    const refreshMs = autopilotState?.runtime?.activeTask ? 5000 : 15000;
    const interval = window.setInterval(() => {
      fetchAutopilotSettings(true);
    }, refreshMs);
    return () => window.clearInterval(interval);
  }, [activeTab, fetchAutopilotSettings, autopilotState?.runtime?.activeTask?.id]);

  useEffect(() => {
    if (activeTab !== "autopilot" || !liveBrowserTaskId) {
      setLiveBrowserView(null);
      setLiveBrowserError(null);
      return;
    }
    if (typeof window.EventSource === "undefined") {
      void fetchLiveBrowser(liveBrowserTaskId, false);
      const interval = window.setInterval(() => {
        void fetchLiveBrowser(liveBrowserTaskId, true);
      }, 1800);
      return () => window.clearInterval(interval);
    }

    setLiveBrowserLoading(true);
    const source = new window.EventSource(
      `/api/listsmartly/autopilot/browser?taskId=${encodeURIComponent(liveBrowserTaskId)}&stream=1`
    );
    const handleView = (event: MessageEvent) => {
      const view = JSON.parse(event.data) as LiveBrowserView;
      setLiveBrowserView(view);
      setLiveBrowserError(null);
      setLiveBrowserLoading(false);
    };
    const handleStreamError = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as { message?: string };
      setLiveBrowserError(payload.message || "Live browser stream interrupted");
      setLiveBrowserLoading(false);
    };
    source.addEventListener("view", handleView);
    source.addEventListener("stream_error", handleStreamError);
    source.onerror = () => {
      setLiveBrowserLoading(false);
      setLiveBrowserError("Live browser stream is reconnecting.");
    };
    return () => {
      source.removeEventListener("view", handleView);
      source.removeEventListener("stream_error", handleStreamError);
      source.close();
    };
  }, [activeTab, liveBrowserTaskId, fetchLiveBrowser]);

  useEffect(() => {
    const clearLivePointerState = () => {
      livePointerDraggingRef.current = false;
      livePointerIdRef.current = null;
      livePendingMoveRef.current = null;
      livePointerCommandRef.current = Promise.resolve();
      if (liveMoveTimerRef.current) {
        window.clearTimeout(liveMoveTimerRef.current);
        liveMoveTimerRef.current = null;
      }
    };
    clearLivePointerState();
    return clearLivePointerState;
  }, [liveBrowserTaskId]);

  // ── Actions ──

  async function runScan() {
    setScanRunning(true);
    try {
      const res = await fetch("/api/listsmartly/listings/scan", { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      const json = await res.json();
      const summary = json.data?.summary || {};
      await Promise.all([fetchListings(), fetchReviews(), fetchStats()]);
      toast({
        title: "Scan completed",
        description: `${summary.searched || 0} directories checked. ${summary.live || 0} live, ${summary.missing || 0} missing, ${summary.errors || 0} scan errors.`,
      });
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
    if (autopilotActionLoading) return;
    setAutopilotActionLoading(true);
    try {
      const res = await fetch("/api/listsmartly/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Action failed");
      if (json.success && json.data?.state) {
        setAutopilotState(json.data.state);
        setAutoFixEnabled(json.data.state.settings.autoFix || false);
        setAutoDescEnabled(json.data.state.settings.autoDescriptions || false);
      }
      if (typeof json.data?.result?.creditsRemaining === "number") {
        emitCreditsUpdate(json.data.result.creditsRemaining);
      }
      if (action === "continue_task" && typeof body.taskId === "string") {
        setVerificationInputs((prev) => ({ ...prev, [body.taskId as string]: "" }));
      }
      const resultMessage =
        action === "continue_task"
          ? typeof body.verificationCode === "string" && body.verificationCode
            ? "Code received. The agent is submitting it in the live browser session; this panel will refresh as it works."
            : json.data?.result?.message || "The agent is continuing this workflow now."
          : action === "run_extra"
          ? json.data?.result?.message || "Extra run started. 250 credits were charged and the agent is working now."
          : action === "run_next"
          ? "Agent started. The live status panel will refresh as it inspects the directory workflow."
          : json.data?.result?.message || (
              action === "prepare_queue"
                ? "The agent queue is ready."
                : "The workflow has been updated."
            );
      toast({
        title:
          action === "run_extra"
            ? "Extra run started"
            : action === "run_next"
              ? "Autopilot started"
              : action === "continue_task"
                ? "Agent resumed"
                : "Autopilot updated",
        description: resultMessage,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to run autopilot action",
        variant: "destructive",
      });
    } finally {
      setAutopilotActionLoading(false);
    }
  }

  function continueAutopilotTask(task: AutopilotTask) {
    const verificationCode =
      task.result?.userActionInputKind === "verification_code"
        ? (verificationInputs[task.id] || "").trim()
        : "";
    if (task.result?.userActionInputRequired && !verificationCode) {
      toast({
        title: "Verification code required",
        description: "Enter the code from the directory email so the AI agent can continue.",
        variant: "destructive",
      });
      return;
    }
    void runAutopilotAction("continue_task", {
      taskId: task.id,
      ...(verificationCode ? { verificationCode } : {}),
    });
  }

  async function saveCredentialDraft() {
    if (!credentialDraft) return;
    await runAutopilotAction("save_credential", { credential: credentialDraft });
    setCredentialDraft(null);
  }

  function getLiveBrowserPoint(event: PointerEvent<HTMLImageElement>): LiveBrowserPoint | null {
    const view = liveBrowserView;
    if (!view?.active || !view.viewport) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.max(0, Math.min(view.viewport.width, ((event.clientX - rect.left) / rect.width) * view.viewport.width));
    const y = Math.max(0, Math.min(view.viewport.height, ((event.clientY - rect.top) / rect.height) * view.viewport.height));
    return { x, y };
  }

  function enqueueLiveBrowserPointerControl(
    taskId: string,
    control: Record<string, unknown>,
    options: LiveBrowserControlOptions
  ) {
    const command = livePointerCommandRef.current
      .catch(() => undefined)
      .then(() => sendLiveBrowserControl(taskId, control, options));
    livePointerCommandRef.current = command;
    return command;
  }

  function flushLiveBrowserMove() {
    if (liveMoveInFlightRef.current) return;
    const pending = livePendingMoveRef.current;
    if (!pending) return;
    livePendingMoveRef.current = null;
    liveMoveInFlightRef.current = true;
    liveMoveSentAtRef.current = Date.now();
    void enqueueLiveBrowserPointerControl(
      pending.taskId,
      { action: "move", x: pending.x, y: pending.y },
      { background: true, refreshState: false, suppressToast: true, timeoutMs: 5000 }
    ).finally(() => {
      liveMoveInFlightRef.current = false;
      if (!livePendingMoveRef.current) return;
      const minDelay = livePointerDraggingRef.current ? 45 : 140;
      const elapsed = Date.now() - liveMoveSentAtRef.current;
      if (elapsed >= minDelay) {
        flushLiveBrowserMove();
      } else if (!liveMoveTimerRef.current) {
        liveMoveTimerRef.current = window.setTimeout(() => {
          liveMoveTimerRef.current = null;
          flushLiveBrowserMove();
        }, minDelay - elapsed);
      }
    });
  }

  function queueLiveBrowserMove(taskId: string, point: LiveBrowserPoint, immediate = false) {
    livePendingMoveRef.current = { taskId, ...point };
    const minDelay = livePointerDraggingRef.current ? 45 : 140;
    const elapsed = Date.now() - liveMoveSentAtRef.current;
    if (immediate || elapsed >= minDelay) {
      if (liveMoveTimerRef.current) {
        window.clearTimeout(liveMoveTimerRef.current);
        liveMoveTimerRef.current = null;
      }
      flushLiveBrowserMove();
      return;
    }
    if (!liveMoveTimerRef.current) {
      liveMoveTimerRef.current = window.setTimeout(() => {
        liveMoveTimerRef.current = null;
        flushLiveBrowserMove();
      }, minDelay - elapsed);
    }
  }

  function handleLiveBrowserPointerDown(event: PointerEvent<HTMLImageElement>, taskId: string) {
    if (event.button !== 0) return;
    const point = getLiveBrowserPoint(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    livePointerDraggingRef.current = true;
    livePointerIdRef.current = event.pointerId;
    livePendingMoveRef.current = null;
    if (liveMoveTimerRef.current) {
      window.clearTimeout(liveMoveTimerRef.current);
      liveMoveTimerRef.current = null;
    }
    void enqueueLiveBrowserPointerControl(
      taskId,
      { action: "mouse_down", x: point.x, y: point.y },
      { background: true, refreshState: false, suppressToast: true, timeoutMs: 8000 }
    );
  }

  function handleLiveBrowserPointerMove(event: PointerEvent<HTMLImageElement>, taskId: string) {
    const point = getLiveBrowserPoint(event);
    if (!point) return;
    if (livePointerDraggingRef.current) event.preventDefault();
    queueLiveBrowserMove(taskId, point);
  }

  function finishLiveBrowserPointer(event: PointerEvent<HTMLImageElement>, taskId: string) {
    if (livePointerIdRef.current !== null && livePointerIdRef.current !== event.pointerId) return;
    const point = getLiveBrowserPoint(event) || livePendingMoveRef.current;
    const wasDragging = livePointerDraggingRef.current;
    livePointerDraggingRef.current = false;
    livePointerIdRef.current = null;
    livePendingMoveRef.current = null;
    if (liveMoveTimerRef.current) {
      window.clearTimeout(liveMoveTimerRef.current);
      liveMoveTimerRef.current = null;
    }
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (!wasDragging || !point) return;
    event.preventDefault();
    void enqueueLiveBrowserPointerControl(
      taskId,
      { action: "mouse_up", x: point.x, y: point.y },
      { background: true, refreshState: true, suppressToast: false, timeoutMs: 12000 }
    );
  }

  function typeIntoLiveBrowser(taskId: string) {
    const text = liveControlText;
    if (!text.trim()) return;
    setLiveControlText("");
    void sendLiveBrowserControl(taskId, { action: "type", text });
  }

  function pressHoldLiveBrowser(taskId: string) {
    const cursor = liveBrowserView?.cursor;
    void sendLiveBrowserControl(taskId, {
      action: "press_hold",
      ...(cursor ? { x: cursor.x, y: cursor.y } : {}),
      durationMs: 18000,
    });
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
        title: "Not Scanned Yet",
        description: "Directories waiting for the next full scan. After Run Scan, these become live, missing, or scan error.",
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
        .map(([tier, tierItems]) => ({
          tier,
          items: tierItems.sort(
            (a, b) =>
              (a.priority ?? 9999) - (b.priority ?? 9999) ||
              a.directoryName.localeCompare(b.directoryName)
          ),
        }));
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
            <option value="unverified">Not Scanned</option>
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
    const activeTask = state?.runtime?.activeTask || null;
    const activeProgress = activeTask?.progress || [];
    const activeTaskCanRetry = Boolean(activeTask?.canRetry);
    const needsUserTask = tasks.find((task) => task.status === "needs_user") || null;
    const nextQueuedTask = tasks.find((task) => task.status === "queued");
    const queueReady = Boolean(state?.runtime?.queueReady || (state?.stats.taskCounts.queued || 0) > 0);
    const canPrepareQueue = Boolean(state?.runtime?.canPrepareQueue && !autopilotActionLoading && !autopilotLoading);
    const canRunAutopilot = Boolean(state?.runtime?.canRun && !autopilotActionLoading && !autopilotLoading);
    const extraRunCost = state?.runtime?.extraRunCost || LISTSMARTLY_EXTRA_RUN_CREDIT_COST;
    const creditsAvailable = state?.runtime?.creditsAvailable ?? 0;
    const canRunPaidExtra = Boolean(state?.runtime?.canRunExtra && !autopilotActionLoading && !autopilotLoading);
    const nextRunAt = state?.runtime?.nextRunAt || null;
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
        .map(([tier, tierItems]) => ({
          tier,
          items: tierItems.sort(
            (a, b) =>
              a.priority - b.priority ||
              (a.directory?.name || a.title).localeCompare(b.directory?.name || b.title)
          ),
        }));
    };
    const needsEmailCode =
      needsUserTask?.result?.accountCreationBlocker === "waiting_for_email_verification" ||
      needsUserTask?.result?.stage === "waiting_for_email_verification";
    const emailSessionHeld = Boolean(needsUserTask?.result?.browserSessionHeld);
    const codeAttemptCount = needsUserTask?.result?.verificationCodeAttemptCount || 0;
    const needsUserSummary = needsEmailCode
      ? needsUserTask?.result?.verificationCodeAttempted
        ? "The directory rejected that code or kept the verification page open."
        : "The agent started the sign-up and the directory sent an email verification code."
      : needsUserTask?.result?.accountCreated
        ? "The agent started the account workflow and is paused at a real validation step."
        : "The agent is paused at a real validation step.";
    const needsPortalValidation = Boolean(
      needsUserTask?.result?.stage === "waiting_for_captcha" ||
        needsUserTask?.result?.accountCreationBlocker === "waiting_for_captcha" ||
        needsUserTask?.result?.accountCreationBlocker === "captcha_required" ||
        /captcha|bot|robot|human verification/i.test(
          `${needsUserTask?.result?.stage || ""} ${needsUserTask?.result?.accountCreationBlocker || ""} ${
            needsUserTask?.result?.statusMessage || ""
          }`
        )
    );
    const needsUserButtonLabel =
      needsUserTask?.result?.userActionInputKind === "verification_code"
        ? "Submit code to live agent"
        : needsPortalValidation
          ? "Continue agent after validation"
          : needsUserTask?.result?.userActionButtonLabel || "Continue agent";
    const needsUserDisplayTitle = needsPortalValidation
      ? `${needsUserTask?.directory?.name || needsUserTask?.title.replace(/^Verify\s+/i, "") || "Directory"} needs portal validation`
      : needsUserTask?.result?.userActionTitle || needsUserTask?.title || "Agent needs your input";
    const needsUserDisplayMessage = needsPortalValidation
      ? "The real portal is shown in the live browser above. Complete the visible validation or required field there, then continue the agent."
      : needsUserTask?.result?.userActionMessage ||
        needsUserTask?.result?.statusMessage ||
        needsUserTask?.requiredAction ||
        "Complete the required validation, then let the agent continue.";
    const supervisedTask = activeTask || needsUserTask;
    const showLiveBrowser = Boolean(supervisedTask);
    const liveBrowserIsCurrent = Boolean(showLiveBrowser && liveBrowserTaskId === supervisedTask?.id);
    const liveBrowserConnected = Boolean(liveBrowserIsCurrent && liveBrowserView?.active && liveBrowserView.image);
    const liveBrowserViewport = liveBrowserView?.viewport || { width: 1365, height: 900 };
    const liveBrowserSrc =
      liveBrowserConnected && liveBrowserView?.image
        ? `data:${liveBrowserView.contentType || "image/jpeg"};base64,${liveBrowserView.image}`
        : "";

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
            <div className="flex flex-col gap-3 rounded-md border border-border bg-background/60 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {activeTask
                    ? "Agent is working"
                    : needsUserTask
                      ? "Agent is waiting for your validation"
                      : queueReady
                        ? "Queue is ready"
                        : "No agent workflow is prepared"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The current workflow stays visible while queued directories remain grouped and collapsed.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Prepared", value: state?.stats.taskCounts.queued || 0 },
                  { label: "Working", value: state?.stats.taskCounts.in_progress || 0 },
                  { label: "Needs you", value: state?.stats.taskCounts.needs_user || 0 },
                  { label: "Done", value: state?.stats.taskCounts.completed || 0 },
                ].map((item) => (
                  <Badge key={item.label} variant="secondary" className="gap-1 px-3 py-1">
                    <span className="font-semibold text-foreground">{item.value}</span>
                    <span>{item.label}</span>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Controlled, human-safe submission flow</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The agent uses low-rate public directory web workflows and submit/claim pages. It runs one account
                    or listing workflow per day and pauses only for real validation shown by the directory, like email,
                    SMS, phone, payment, or owner approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => runAutopilotAction("prepare_queue")}
                disabled={!canPrepareQueue}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                {queueReady ? "Queue Ready" : "Prepare Agent Queue"}
              </Button>
              <Button
                variant="outline"
                onClick={() => runAutopilotAction("run_next")}
                disabled={!canRunAutopilot}
              >
                <Play className="h-4 w-4 mr-2" />
                {activeTask ? "Autopilot Running" : needsUserTask ? "Action Needed" : nextRunAt ? "Runs Daily" : "Run Autopilot"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => runAutopilotAction("run_extra")}
                disabled={!canRunPaidExtra}
              >
                <Zap className="h-4 w-4 mr-2" />
                Run Extra Now
                <span className="ml-2 text-xs opacity-80">{extraRunCost} credits</span>
              </Button>
              <div className="min-w-[220px] text-xs text-muted-foreground">
                {activeTask ? (
                  <>
                    <p>
                      Working: <span className="text-foreground font-medium">{activeTask.title}</span>
                    </p>
                    <p className="mt-1">
                      {activeTask.statusMessage || formatWorkflowMode(activeTask.stage)}
                    </p>
                  </>
                ) : needsUserTask ? (
                  <p>
                    Action needed: <span className="text-foreground font-medium">{needsUserDisplayTitle}</span>
                  </p>
                ) : nextRunAt ? (
                  <p>
                    Next daily run: <span className="text-foreground font-medium">{formatNextRun(nextRunAt)}</span>
                  </p>
                ) : nextQueuedTask ? (
                  <p>
                    Ready for: <span className="text-foreground font-medium">{nextQueuedTask.title}</span>
                  </p>
                ) : (
                  <p>{state?.runtime?.message || "No prepared workflow is waiting."}</p>
                )}
                <p className="mt-1">
                  Status auto-refreshes every {activeTask ? "5s" : "15s"}
                  {lastAutopilotRefresh ? ` - last checked ${new Date(lastAutopilotRefresh).toLocaleTimeString()}` : ""}
                </p>
                {nextRunAt && !activeTask && queueReady && !canRunPaidExtra && creditsAvailable < extraRunCost && (
                  <p className="mt-1 text-amber-400">
                    Extra run needs {extraRunCost} credits. Available: {creditsAvailable}.
                  </p>
                )}
              </div>
            </div>

            {showLiveBrowser && supervisedTask && (
              <div className="rounded-md border border-sky-500/25 bg-sky-500/[0.04] p-4">
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Monitor className="h-4 w-4 text-sky-400" />
                      <p className="text-sm font-semibold text-foreground">Live remote-control browser</p>
                      <Badge variant={liveBrowserConnected ? "secondary" : "outline"}>
                        {liveBrowserConnected ? "Connected" : liveBrowserLoading ? "Connecting" : "Waiting"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {liveBrowserConnected
                        ? `${liveBrowserView?.directoryName || supervisedTask.directory?.name || "Directory"} is open in the agent browser. Click the screen and type only when the portal asks for human input.`
                        : liveBrowserError || liveBrowserView?.reason || "The live browser appears when the agent is actively holding this workflow."}
                    </p>
                    {liveBrowserConnected && liveBrowserView?.url && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {liveBrowserView.title ? `${liveBrowserView.title} - ` : ""}
                        {liveBrowserView.url}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void fetchLiveBrowser(supervisedTask.id, false)}
                    disabled={liveBrowserLoading}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${liveBrowserLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                </div>

                {liveBrowserConnected ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-md border border-border bg-black">
                      <img
                        ref={liveBrowserRef}
                        src={liveBrowserSrc}
                        alt="Live agent browser"
                        draggable={false}
                        onPointerDown={(event) => handleLiveBrowserPointerDown(event, supervisedTask.id)}
                        onPointerMove={(event) => handleLiveBrowserPointerMove(event, supervisedTask.id)}
                        onPointerUp={(event) => finishLiveBrowserPointer(event, supervisedTask.id)}
                        onPointerCancel={(event) => finishLiveBrowserPointer(event, supervisedTask.id)}
                        className="block w-full touch-none select-none cursor-crosshair"
                        style={{ aspectRatio: `${liveBrowserViewport.width} / ${liveBrowserViewport.height}` }}
                      />
                      {liveBrowserView?.cursor && (
                        <span
                          className="pointer-events-none absolute z-10 -translate-x-1 -translate-y-1 text-sky-300 drop-shadow"
                          style={{
                            left: `${(liveBrowserView.cursor.x / liveBrowserViewport.width) * 100}%`,
                            top: `${(liveBrowserView.cursor.y / liveBrowserViewport.height) * 100}%`,
                          }}
                        >
                          <MousePointer2 className="h-5 w-5 fill-sky-300/20" />
                        </span>
                      )}
                      {liveControlLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/35">
                          <Badge variant="secondary" className="gap-2">
                            <AISpinner className="h-3.5 w-3.5 animate-spin" />
                            Sending command
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 gap-2">
                        <Input
                          value={liveControlText}
                          onChange={(event) => setLiveControlText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              typeIntoLiveBrowser(supervisedTask.id);
                            }
                          }}
                          placeholder="Type into the focused browser field"
                          aria-label="Text to type into the live browser"
                        />
                        <Button
                          type="button"
                          onClick={() => typeIntoLiveBrowser(supervisedTask.id)}
                          disabled={liveControlLoading || !liveControlText.trim()}
                        >
                          <Keyboard className="h-4 w-4 mr-2" />
                          Type
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => pressHoldLiveBrowser(supervisedTask.id)}
                          disabled={liveControlLoading}
                          title="Hold the visible Press and hold challenge button in the live browser"
                        >
                          <MousePointer2 className="h-3.5 w-3.5 mr-1.5" />
                          Hold 18s
                        </Button>
                        {["Enter", "Tab", "Backspace"].map((key) => (
                          <Button
                            key={key}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void sendLiveBrowserControl(supervisedTask.id, { action: "key", key })}
                            disabled={liveControlLoading}
                          >
                            {key}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void sendLiveBrowserControl(supervisedTask.id, { action: "scroll", deltaY: -650 })}
                          disabled={liveControlLoading}
                        >
                          Scroll up
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void sendLiveBrowserControl(supervisedTask.id, { action: "scroll", deltaY: 650 })}
                          disabled={liveControlLoading}
                        >
                          Scroll down
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void sendLiveBrowserControl(supervisedTask.id, { action: "refresh" })}
                          disabled={liveControlLoading}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Reload
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/60 p-6 text-center">
                    {liveBrowserLoading ? (
                      <AISpinner className="h-8 w-8 animate-spin text-primary" />
                    ) : (
                      <Monitor className="h-9 w-9 text-muted-foreground" />
                    )}
                    <p className="mt-3 text-sm font-medium text-foreground">
                      {liveBrowserLoading ? "Opening live browser..." : "No live browser attached yet"}
                    </p>
                    <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                      {liveBrowserError || liveBrowserView?.reason || "Start or resume the agent. When it reaches a real portal step, this panel shows the page itself."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {(activeTask || needsUserTask) && (
              <div className="rounded-md border border-border bg-background/70 p-4">
                {activeTask ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {activeTaskCanRetry ? (
                            <RefreshCw className="h-4 w-4 text-amber-400" />
                          ) : (
                            <AISpinner className="h-4 w-4 animate-spin text-primary" />
                          )}
                          {activeTaskCanRetry ? "Agent needs a retry" : "Agent is working now"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activeTaskCanRetry
                            ? activeTask.retryMessage || activeTask.statusMessage || "The agent can retry this workflow now."
                            : activeTask.statusMessage || "Checking the directory and updating this workflow."}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeTaskCanRetry && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runAutopilotAction("continue_task", { taskId: activeTask.id })}
                            disabled={autopilotActionLoading}
                          >
                            {autopilotActionLoading ? (
                              <AISpinner className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {autopilotActionLoading ? "Retrying..." : activeTask.retryLabel || "Retry agent"}
                          </Button>
                        )}
                        <Badge variant="secondary" className="w-fit">
                          {formatWorkflowMode(activeTask.stage)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(activeProgress.length > 0
                        ? activeProgress.slice(-8)
                        : [
                            {
                              stage: "running_directory_workflow",
                              label: "Agent started",
                              status: "active" as const,
                              detail: "Preparing the directory workflow.",
                            },
                          ]
                      ).map((event, index, events) => (
                        <div key={`${event.stage}-${event.at || ""}`} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className={`mt-1 h-3 w-3 rounded-full ${progressDotClass(event.status)}`} />
                            {index < events.length - 1 && <span className="mt-1 h-full min-h-8 w-px bg-border" />}
                          </div>
                          <div className="min-w-0 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-foreground">{event.label}</p>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {event.status}
                              </Badge>
                              {event.at && (
                                <span className="text-[11px] text-muted-foreground">
                                  {new Date(event.at).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {event.detail && <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{event.detail}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : needsUserTask ? (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {userActionBadgeLabel(needsUserTask.result?.accountCreationBlocker)}
                          </Badge>
                          <p className="text-sm font-semibold text-foreground">
                            {needsUserDisplayTitle}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{needsUserSummary}</p>
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                          {needsPortalValidation
                            ? needsUserDisplayMessage
                            : needsEmailCode && needsUserTask.result?.verificationCodeAttempted
                            ? `${needsUserTask.result?.userActionMessage || needsUserTask.result?.statusMessage || needsUserTask.requiredAction || "The code was not accepted by the directory."} ${
                                emailSessionHeld
                                  ? "The browser session is still open, so the next code will be submitted without reloading the verification page."
                                  : "The live browser session expired, so the agent may need to reopen the verification page."
                              }`
                            : needsUserDisplayMessage}
                        </p>
                        {needsEmailCode && codeAttemptCount > 0 && (
                          <p className="mt-2 text-[11px] text-amber-200">
                            Code attempts in this workflow: {codeAttemptCount}
                          </p>
                        )}
                      </div>
                      {(needsUserTask.result?.portalUrl || needsUserTask.payload?.directory?.submitUrl || needsUserTask.payload?.directory?.claimUrl) && (
                        <Button size="sm" variant="outline" asChild>
                          <a
                            href={
                              needsUserTask.result?.portalUrl ||
                              needsUserTask.payload?.directory?.submitUrl ||
                              needsUserTask.payload?.directory?.claimUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Open portal
                          </a>
                        </Button>
                      )}
                    </div>

                    {needsUserTask.result?.userActionInputKind === "verification_code" && (
                      <div className="flex flex-col gap-3 rounded-md border border-border bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          className="sm:max-w-xs"
                          value={verificationInputs[needsUserTask.id] || ""}
                          onChange={(e) =>
                            setVerificationInputs((prev) => ({
                              ...prev,
                              [needsUserTask.id]: e.target.value.replace(/\s+/g, ""),
                            }))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder={needsUserTask.result?.userActionInputPlaceholder || "Enter verification code"}
                          aria-label={needsUserTask.result?.userActionInputLabel || "Verification code"}
                        />
                        <Button
                          onClick={() => continueAutopilotTask(needsUserTask)}
                          disabled={
                            autopilotActionLoading ||
                            Boolean(needsUserTask.result?.userActionInputRequired && !(verificationInputs[needsUserTask.id] || "").trim())
                          }
                          className="w-full sm:w-auto"
                        >
                          {autopilotActionLoading ? (
                            <AISpinner className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          {autopilotActionLoading ? "Sending to agent..." : needsUserButtonLabel}
                        </Button>
                      </div>
                    )}

                    {needsUserTask.result?.userActionInputKind !== "verification_code" && (
                      <Button
                        onClick={() => continueAutopilotTask(needsUserTask)}
                        disabled={autopilotActionLoading}
                        className="w-full sm:w-auto"
                      >
                        {autopilotActionLoading ? (
                          <AISpinner className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        {autopilotActionLoading ? "Sending to agent..." : needsUserButtonLabel}
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
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
                                            Mode: {formatWorkflowMode(task.payload.safety.mode)}
                                          </p>
                                        )}
                                        {task.result?.progress && task.result.progress.length > 0 && (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            {task.result.progress.slice(-4).map((event) => (
                                              <span
                                                key={`${task.id}-${event.stage}-${event.at || ""}`}
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${progressStatusClass(event.status)}`}
                                              >
                                                <span className={`h-1.5 w-1.5 rounded-full ${progressDotClass(event.status)}`} />
                                                {event.label}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        {task.status === "needs_user" ? (
                                          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            Waiting in action panel
                                          </Badge>
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
