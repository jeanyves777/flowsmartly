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
  Search,
  Send,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  itemType?: "post" | "strategy";
  caption: string;
  title?: string;
  description?: string | null;
  mediaUrls: string[];
  mediaThumbnails: string[];
  status: "published" | "scheduled" | "draft" | "todo" | "in_progress" | "done";
  platforms: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  aiGenerated: boolean;
  strategyName?: string;
  strategyId?: string;
  priority?: string;
  category?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
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
  todo: { label: "To do", dotColor: "bg-amber-500", bgColor: "bg-amber-500/15", textColor: "text-amber-700 dark:text-amber-300", icon: FileEdit },
  in_progress: { label: "In progress", dotColor: "bg-violet-500", bgColor: "bg-violet-500/15", textColor: "text-violet-700 dark:text-violet-300", icon: FileEdit },
  done: { label: "Done", dotColor: "bg-emerald-500", bgColor: "bg-emerald-500/15", textColor: "text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ContentSchedulePage() {
  const { toast } = useToast();
  const router = useRouter();

  // ── Calendar State ────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

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

  const platformOptions = useMemo(() => {
    const platformIds = Array.from(
      new Set(posts.filter((post) => post.itemType !== "strategy").flatMap((post) => post.platforms || []))
    );
    return platformIds
      .map((id) => ({ id, label: PLATFORM_META[id]?.label || id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return posts.filter((post) => {
      const searchableText = [
        post.caption,
        post.title,
        post.description,
        post.strategyName,
        post.category,
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !query || searchableText.includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "posts" && post.itemType !== "strategy") ||
        (statusFilter === "strategy" && post.itemType === "strategy") ||
        post.status === statusFilter;
      const matchesPlatform =
        platformFilter === "all" ||
        (post.itemType === "strategy" && platformFilter === "strategy") ||
        (post.platforms || []).includes(platformFilter);
      return matchesSearch && matchesStatus && matchesPlatform;
    });
  }, [platformFilter, posts, searchQuery, statusFilter]);

  // Group posts by date string for efficient lookup
  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const post of filteredPosts) {
      const itemDate = post.scheduledAt || post.dueDate || post.startDate || post.publishedAt || post.createdAt;
      const dateKey = format(new Date(itemDate), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    }
    return map;
  }, [filteredPosts]);

  // ── Fetch Schedule ────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthStr = format(currentMonth, "yyyy-MM");
      const res = await fetch(`/api/content/schedule?month=${monthStr}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.data?.items || data.data?.posts || []);
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

  const getCalendarItemStyle = (item: ScheduledPost) => {
    if (item.itemType === "strategy") {
      const priority = item.priority?.toUpperCase();
      if (priority === "HIGH") {
        return "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-200";
      }
      if (priority === "LOW") {
        return "border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200";
      }
      return "border-amber-500/35 bg-amber-500/20 text-amber-800 dark:text-amber-200";
    }
    const config = statusConfig[item.status] || statusConfig.draft;
    return `${config.bgColor} ${config.textColor}`;
  };

  const getCalendarItemDate = (item: ScheduledPost) =>
    item.scheduledAt || item.dueDate || item.startDate || item.publishedAt || item.createdAt;

  // Stats
  const scheduledCount = filteredPosts.filter((p) => p.itemType !== "strategy").length;
  const strategyCount = filteredPosts.filter((p) => p.itemType === "strategy").length;
  const activeDaysCount = Object.keys(postsByDate).length;
  const scheduleStats = [
    { label: "Posts", value: scheduledCount.toString(), icon: Clock, tone: "text-blue-600" },
    { label: "Strategy notes", value: strategyCount.toString(), icon: FileEdit, tone: "text-amber-600" },
    { label: "Active days", value: activeDaysCount.toString(), icon: CalendarDays, tone: "text-brand-500" },
  ];

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* ─── HEADER ───────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm font-semibold">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                Calendar
              </span>
              {scheduleStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <span key={stat.label} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
                    <Icon className={`h-4 w-4 ${stat.tone}`} />
                    <strong className="text-foreground">{stat.value}</strong>
                    {stat.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── CALENDAR CARD ────────────────────────────────────────── */}
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
            <div className="grid gap-2 border-t pt-3 md:grid-cols-[minmax(0,1fr)_160px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search posts or strategy notes"
                  className="h-9 pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="posts">Scheduled posts</SelectItem>
                  <SelectItem value="strategy">Strategy notes</SelectItem>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {platformOptions.map((platform) => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                        className={`relative min-h-[110px] border-r border-b border-border/40 p-1.5 transition-colors group sm:min-h-[140px] lg:min-h-[155px] ${
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
                          {dayPosts.slice(0, 3).map((post) => {
                            const config = statusConfig[post.status] || statusConfig.draft;
                            const firstPlatform = (post.platforms || []).find((platform) => PLATFORM_META[platform]);
                            const PlatformIcon = firstPlatform ? PLATFORM_META[firstPlatform].icon : FileEdit;
                            return (
                              <button
                                key={post.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePostClick(post);
                                }}
                                className={`flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[10px] leading-tight transition-all cursor-pointer sm:text-[11px] ${getCalendarItemStyle(post)} hover:ring-1 hover:ring-current/20`}
                              >
                                {post.itemType === "strategy" ? (
                                  <FileEdit className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <PlatformIcon className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                  {post.itemType === "strategy"
                                    ? truncate(post.title || post.caption || "Strategy note", 22)
                                    : truncate(post.caption || "No caption", 22)}
                                </span>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotColor}`} />
                              </button>
                            );
                          })}
                        </div>

                        {/* Empty day + icon on hover (future days only) */}
                        {isEmpty && inCurrentMonth && !pastDay && (
                          <div className="absolute inset-x-2 bottom-2 top-9 flex items-center justify-center rounded-xl border border-dashed border-border/60 opacity-60 transition-opacity pointer-events-none group-hover:opacity-100">
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center">
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

        <Dialog open={showPostDetail} onOpenChange={setShowPostDetail}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedPost?.itemType === "strategy" ? "Strategy note" : "Post details"}
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
                  <Label className="text-xs text-muted-foreground font-medium">
                    {selectedPost.itemType === "strategy" ? "Planned work" : "Caption"}
                  </Label>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <p className="text-sm font-semibold text-foreground whitespace-pre-wrap leading-relaxed">
                      {selectedPost.title || selectedPost.caption || "No caption"}
                    </p>
                    {selectedPost.description && (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {selectedPost.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Meta info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      {selectedPost.itemType === "strategy" ? "Strategy" : "Platforms"}
                    </Label>
                    <div className="flex items-center gap-2 mt-1.5 text-foreground">
                      {selectedPost.itemType === "strategy" ? (
                        <span className="text-xs text-muted-foreground">
                          {selectedPost.strategyName || selectedPost.category || "Strategy"}
                        </span>
                      ) : (
                        <>
                          {getPlatformIcons(selectedPost.platforms || [])}
                          {selectedPost.platforms?.map((p) => (
                            <span key={p} className="text-xs text-muted-foreground">{PLATFORM_META[p]?.label}</span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3">
                    <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      {selectedPost.itemType === "strategy"
                        ? "Due date"
                        : selectedPost.status === "scheduled"
                          ? "Scheduled for"
                          : "Date"}
                    </Label>
                    <p className="text-sm text-foreground mt-1.5 font-medium">
                      {format(
                        new Date(getCalendarItemDate(selectedPost)),
                        "MMM d, yyyy"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(
                        new Date(getCalendarItemDate(selectedPost)),
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
                  {selectedPost.itemType !== "strategy" && selectedPost.status === "scheduled" && (
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
                  {selectedPost.itemType !== "strategy" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePost(selectedPost.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </TooltipProvider>
  );
}
