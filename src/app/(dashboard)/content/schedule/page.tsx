"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileEdit,
  CheckCircle2,
  Trash2,
  Plus,
  Image as ImageIcon,
  Play,
  Send,
  ListChecks,
  Target,
  Zap,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  isPast,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";

// ─── Types ──────────────────────────────────────────────────────────────────
interface ScheduledPost {
  id: string;
  caption: string;
  mediaUrls: string[];
  mediaThumbnails: string[];
  status: "published" | "scheduled" | "draft";
  platforms: string[];
  scheduledAt: string;
  publishedAt: string | null;
  createdAt: string;
  aiGenerated: boolean;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

// ─── Status Config ──────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string; icon: React.ElementType }> = {
  published: { label: "Published", dotColor: "bg-green-500", bgColor: "bg-green-500/10", textColor: "text-green-600", icon: CheckCircle2 },
  scheduled: { label: "Scheduled", dotColor: "bg-blue-500", bgColor: "bg-blue-500/10", textColor: "text-blue-600", icon: Clock },
  draft: { label: "Draft", dotColor: "bg-gray-400", bgColor: "bg-gray-500/10", textColor: "text-gray-500", icon: FileEdit },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ContentSchedulePage() {
  const { toast } = useToast();
  const router = useRouter();

  // ── Calendar State ────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Detail Dialog ─────────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);

  // ── Calendar Grid Computation ─────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Group posts by date string for efficient lookup
  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const post of posts) {
      const dateKey = post.scheduledAt
        ? format(new Date(post.scheduledAt), "yyyy-MM-dd")
        : post.publishedAt
          ? format(new Date(post.publishedAt), "yyyy-MM-dd")
          : format(new Date(post.createdAt), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    }
    return map;
  }, [posts]);

  // ── Fetch Schedule ────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthStr = format(currentMonth, "yyyy-MM");
      const res = await fetch(`/api/content/schedule?month=${monthStr}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.data?.posts || []);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load scheduled content.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // ── Navigation ────────────────────────────────────────────────────────
  const goToPrevMonth = () => setCurrentMonth((prev) => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth((prev) => addMonths(prev, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // ── Click on empty day → go to post creation ──────────────────────────
  const handleEmptyDayClick = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    router.push(`/content/posts?scheduleDate=${dateStr}`);
  };

  const handlePostClick = (post: ScheduledPost) => {
    setSelectedPost(post);
    setShowPostDetail(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/content/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setShowPostDetail(false);
        toast({ title: "Post deleted", description: "The post has been removed from the calendar." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const formatTime = (dateStr: string) => format(new Date(dateStr), "h:mm a");

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + "..." : text;

  const getPlatformIcons = (platforms: string[]) =>
    platforms.map((p) => {
      const entry = PLATFORM_META[p];
      if (!entry) return null;
      const Icon = entry.icon;
      return (
        <Tooltip key={p}>
          <TooltipTrigger asChild>
            <span className="inline-flex"><Icon className="w-3.5 h-3.5" /></span>
          </TooltipTrigger>
          <TooltipContent>{entry.label}</TooltipContent>
        </Tooltip>
      );
    });

  const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url);

  // Stats
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const activeDaysCount = Object.keys(postsByDate).length;
  const nextScheduledPost = posts
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  const scheduleStats = [
    { label: "Scheduled", value: scheduledCount.toString(), icon: Clock, tone: "text-blue-600" },
    { label: "Published", value: publishedCount.toString(), icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "Drafts", value: draftCount.toString(), icon: FileEdit, tone: "text-muted-foreground" },
    { label: "Active days", value: activeDaysCount.toString(), icon: CalendarDays, tone: "text-brand-500" },
  ];

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* ─── HEADER ───────────────────────────────────────────────── */}
        <section className="overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,hsl(var(--background))_0%,hsl(var(--muted))_62%,rgba(59,130,246,0.12)_100%)]">
          <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:p-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                <CalendarDays className="h-3.5 w-3.5 text-blue-500" />
                Publishing calendar
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Plan the month, spot gaps, and keep every channel moving.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review scheduled posts by day, jump into empty future slots, and keep your next publishing move visible.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => router.push("/content/posts")}>
                  <Plus className="h-4 w-4" />
                  Create post
                </Button>
                <Button variant="outline" onClick={goToToday}>
                  Today
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scheduleStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl border bg-background/85 p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <Icon className={`h-4 w-4 ${stat.tone}`} />
                      <span className="text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {stat.label}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-bold">{stat.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── CALENDAR CARD ────────────────────────────────────────── */}
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-w-0 border-border/60 shadow-sm">
          {/* Month Navigation Bar */}
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
                <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="min-w-0 flex-1 text-center text-lg font-semibold text-foreground sm:min-w-[180px]">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Button variant="outline" size="sm" onClick={goToToday} className="flex-1 sm:flex-none">
                  Today
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-brand-500 text-white hover:bg-brand-600 sm:flex-none"
                  onClick={() => router.push("/content/posts")}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  New Post
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-2 pb-4 sm:px-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <AIGenerationLoader
                  compact
                  currentStep="Loading calendar..."
                  subtitle="Fetching your scheduled content"
                />
              </div>
            ) : (
              <>
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 border-t border-l border-border/40 rounded-lg overflow-hidden">
                  {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayPosts = postsByDate[dateKey] || [];
                    const inCurrentMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);
                    const pastDay = isPast(day) && !today;
                    const isEmpty = dayPosts.length === 0;

                    return (
                      <div
                        key={dateKey}
                        className={`relative min-h-[90px] sm:min-h-[110px] border-r border-b border-border/40 p-1 sm:p-1.5 transition-colors group ${
                          !inCurrentMonth
                            ? "bg-muted/20"
                            : today
                              ? "bg-blue-500/5"
                              : isEmpty && !pastDay
                                ? "hover:bg-brand-500/5 cursor-pointer"
                                : "hover:bg-muted/10"
                        }`}
                        onClick={() => {
                          if (isEmpty && inCurrentMonth && !pastDay) {
                            handleEmptyDayClick(day);
                          }
                        }}
                      >
                        {/* Day Number */}
                        <div className="flex items-center justify-between mb-0.5">
                          <span
                            className={`text-xs sm:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                              today
                                ? "bg-blue-500 text-white"
                                : inCurrentMonth
                                  ? "text-foreground"
                                  : "text-muted-foreground/40"
                            }`}
                          >
                            {format(day, "d")}
                          </span>
                          {dayPosts.length > 2 && (
                            <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 rounded">
                              +{dayPosts.length - 2}
                            </span>
                          )}
                        </div>

                        {/* Post Indicators */}
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, 2).map((post) => {
                            const config = statusConfig[post.status] || statusConfig.draft;
                            return (
                              <button
                                key={post.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePostClick(post);
                                }}
                                className={`w-full text-left rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight truncate transition-all cursor-pointer ${config.bgColor} ${config.textColor} hover:ring-1 hover:ring-current/20`}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dotColor} mr-0.5 align-middle`} />
                                <span className="hidden sm:inline">
                                  {truncate(post.caption || "No caption", 18)}
                                </span>
                                <span className="sm:hidden">
                                  {formatTime(post.scheduledAt || post.createdAt)}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Empty day + icon on hover (future days only) */}
                        {isEmpty && inCurrentMonth && !pastDay && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="w-7 h-7 rounded-full bg-brand-500/10 flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5 text-brand-500" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/40 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">Legend:</span>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

          <aside className="space-y-4">
            <div className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next scheduled</p>
                  <h2 className="mt-1 text-lg font-semibold">Queue focus</h2>
                </div>
                <ListChecks className="h-5 w-5 text-blue-500" />
              </div>
              {nextScheduledPost ? (
                <button
                  className="mt-4 w-full rounded-2xl border bg-muted/20 p-4 text-left transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                  onClick={() => handlePostClick(nextScheduledPost)}
                >
                  <p className="text-xs font-semibold text-blue-600">
                    {format(new Date(nextScheduledPost.scheduledAt), "EEE, MMM d 'at' h:mm a")}
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6">
                    {truncate(nextScheduledPost.caption || "No caption", 110)}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-muted-foreground">
                    {getPlatformIcons(nextScheduledPost.platforms || [])}
                  </div>
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
                  No scheduled posts in this month yet. Pick an open day on the calendar to create one.
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">Schedule playbook</h2>
                <Target className="h-4 w-4 text-brand-500" />
              </div>
              <div className="space-y-3">
                {[
                  { label: "Best posting windows", value: "9 AM, 12 PM, 5 PM" },
                  { label: "Recommended cadence", value: "3-5 posts per week" },
                  { label: "Current coverage", value: `${activeDaysCount} active day${activeDaysCount === 1 ? "" : "s"}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-[linear-gradient(135deg,rgba(14,165,233,0.12),rgba(16,185,129,0.10))] p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background">
                  <Zap className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-semibold">Fast scheduling</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Click any empty future day to open the post composer with that date already selected.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* ─── UPCOMING POSTS ─────────────────────────────────────── */}
        {scheduledCount > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                Upcoming
                <Badge variant="secondary" className="ml-1 text-xs">
                  {scheduledCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {posts
                  .filter((p) => p.status === "scheduled")
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .slice(0, 5)
                  .map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all cursor-pointer"
                      onClick={() => handlePostClick(post)}
                    >
                      {/* Thumbnail */}
                      {post.mediaUrls && post.mediaUrls.length > 0 ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border/50 shrink-0 bg-muted relative">
                          <img
                            src={post.mediaThumbnails?.[0] || post.mediaUrls[0]}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {isVideoUrl(post.mediaUrls[0]) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="w-4 h-4 text-white fill-white" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg border border-border/50 shrink-0 bg-muted/30 flex items-center justify-center">
                          <FileEdit className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {truncate(post.caption || "No caption", 80)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-blue-600 font-medium">
                            {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                          </span>
                          <div className="flex items-center gap-1 text-muted-foreground/70">
                            {getPlatformIcons(post.platforms || [])}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── POST DETAIL DIALOG ───────────────────────────────────── */}
        <Dialog open={showPostDetail} onOpenChange={setShowPostDetail}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Post Details
                {selectedPost && (
                  <Badge
                    variant="outline"
                    className={`${statusConfig[selectedPost.status]?.bgColor} ${statusConfig[selectedPost.status]?.textColor} border-transparent`}
                  >
                    {statusConfig[selectedPost.status]?.label}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedPost && (
              <div className="space-y-4">
                {/* Media gallery */}
                {selectedPost.mediaUrls && selectedPost.mediaUrls.filter(Boolean).length > 0 && (
                  <div className={`${selectedPost.mediaUrls.length === 1 ? "" : "flex gap-2 overflow-x-auto pb-2"}`}>
                    {selectedPost.mediaUrls.filter(Boolean).map((url, i) => (
                      <div
                        key={i}
                        className={`rounded-xl overflow-hidden border border-border bg-muted shrink-0 ${
                          selectedPost.mediaUrls.length === 1
                            ? "w-full aspect-video"
                            : "w-40 h-40"
                        }`}
                      >
                        {isVideoUrl(url) ? (
                          <video
                            src={url}
                            controls
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to thumbnail
                              const thumb = selectedPost.mediaThumbnails?.[i];
                              if (thumb) (e.target as HTMLImageElement).src = thumb;
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Caption</Label>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {selectedPost.caption || "No caption"}
                    </p>
                  </div>
                </div>

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Platforms</Label>
                    <div className="flex items-center gap-2 mt-1.5 text-foreground">
                      {getPlatformIcons(selectedPost.platforms || [])}
                      {selectedPost.platforms?.map((p) => (
                        <span key={p} className="text-xs text-muted-foreground">{PLATFORM_META[p]?.label}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      {selectedPost.status === "scheduled" ? "Scheduled for" : "Date"}
                    </Label>
                    <p className="text-sm text-foreground mt-1.5 font-medium">
                      {format(
                        new Date(selectedPost.scheduledAt || selectedPost.publishedAt || selectedPost.createdAt),
                        "MMM d, yyyy"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(
                        new Date(selectedPost.scheduledAt || selectedPost.publishedAt || selectedPost.createdAt),
                        "h:mm a"
                      )}
                    </p>
                  </div>
                </div>

                {/* Engagement for published posts */}
                {selectedPost.status === "published" && selectedPost.engagement && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Views", value: selectedPost.engagement.views },
                      { label: "Likes", value: selectedPost.engagement.likes },
                      { label: "Comments", value: selectedPost.engagement.comments },
                      { label: "Shares", value: selectedPost.engagement.shares },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <p className="text-lg font-bold text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Media count indicator */}
                {selectedPost.mediaUrls && selectedPost.mediaUrls.filter(Boolean).length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageIcon className="w-3.5 h-3.5" />
                    {selectedPost.mediaUrls.filter(Boolean).length} media attachment{selectedPost.mediaUrls.filter(Boolean).length !== 1 ? "s" : ""}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  {selectedPost.status === "scheduled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => {
                        setShowPostDetail(false);
                        // Could implement publish-now in the future
                        toast({ title: "Publishing will be available soon" });
                      }}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Publish Now
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePost(selectedPost.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  );
}
