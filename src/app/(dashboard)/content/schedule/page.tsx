"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Rss,
  Loader2,
  FileEdit,
  CheckCircle2,
  Eye,
  Trash2,
  X,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
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
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover";
import { useToast } from "@/hooks/use-toast";

// ─── Social Platform SVG Icons ──────────────────────────────────────────────
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function XTwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

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

// ─── Platform helpers ───────────────────────────────────────────────────────
const PLATFORM_MAP: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  feed: { label: "Feed", icon: ({ className }) => <Rss className={className} /> },
  instagram: { label: "Instagram", icon: InstagramIcon },
  twitter: { label: "X / Twitter", icon: XTwitterIcon },
  linkedin: { label: "LinkedIn", icon: LinkedInIcon },
  facebook: { label: "Facebook", icon: FacebookIcon },
  tiktok: { label: "TikTok", icon: TikTokIcon },
};

export default function ContentSchedulePage() {
  const { toast } = useToast();

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

  // ── Click Handlers ────────────────────────────────────────────────────
  const handleEmptyDayClick = () => {
    toast({
      title: "Create a scheduled post",
      description: "Navigate to the Posts tab to create a scheduled post for this date.",
    });
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
  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "h:mm a");
  };

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + "..." : text;

  const getPlatformIcons = (platforms: string[]) =>
    platforms.map((p) => {
      const entry = PLATFORM_MAP[p];
      if (!entry) return null;
      const Icon = entry.icon;
      return <Icon key={p} className="w-3 h-3" />;
    });

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* ─── HEADER ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              Schedule
            </h1>
            <p className="text-muted-foreground mt-2">
              View and manage your upcoming scheduled posts
            </p>
          </div>
        </div>

        {/* ─── CALENDAR CARD ────────────────────────────────────────── */}
        <div>
          <Card className="border-border/60 shadow-sm overflow-hidden">
            {/* Month Navigation Bar */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="text-lg font-semibold text-foreground min-w-[180px] text-center">
                    {format(currentMonth, "MMMM yyyy")}
                  </h2>
                  <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Today
                </Button>
              </div>
            </CardHeader>

            <CardContent className="px-2 pb-4 sm:px-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading calendar...</p>
                  </div>
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
                  <div className="grid grid-cols-7 border-t border-l border-border/50">
                    {calendarDays.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd");
                      const dayPosts = postsByDate[dateKey] || [];
                      const inCurrentMonth = isSameMonth(day, currentMonth);
                      const today = isToday(day);

                      return (
                        <div
                          key={dateKey}
                          className={`relative min-h-[90px] sm:min-h-[110px] border-r border-b border-border/50 p-1 sm:p-1.5 transition-colors ${
                            !inCurrentMonth
                              ? "bg-muted/20"
                              : today
                                ? "bg-brand-500/5"
                                : "hover:bg-muted/10"
                          }`}
                          onClick={() => {
                            if (dayPosts.length === 0) handleEmptyDayClick();
                          }}
                        >
                          {/* Day Number */}
                          <div className="flex items-center justify-between mb-0.5">
                            <span
                              className={`text-xs sm:text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                                today
                                  ? "bg-brand-500 text-white ring-2 ring-brand-500/30"
                                  : inCurrentMonth
                                    ? "text-foreground"
                                    : "text-muted-foreground/50"
                              }`}
                            >
                              {format(day, "d")}
                            </span>
                            {dayPosts.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{dayPosts.length - 3}
                              </span>
                            )}
                          </div>

                          {/* Post Indicators */}
                          <div className="space-y-0.5">
                            {dayPosts.slice(0, 3).map((post) => {
                              const config = statusConfig[post.status] || statusConfig.draft;

                              return (
                                <Popover key={post.id}>
                                  <PopoverTrigger asChild>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className={`w-full text-left rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-tight truncate transition-colors cursor-pointer ${config.bgColor} ${config.textColor} hover:brightness-95`}
                                    >
                                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.dotColor} mr-1 align-middle`} />
                                      <span className="hidden sm:inline">
                                        {truncate(post.caption || "No caption", 20)}
                                      </span>
                                      <span className="sm:hidden">
                                        {formatTime(post.scheduledAt || post.createdAt)}
                                      </span>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="z-50 w-72 rounded-lg border bg-popover p-0 shadow-lg"
                                    side="right"
                                    sideOffset={8}
                                    align="start"
                                  >
                                    <div className="p-3 space-y-2.5">
                                      {/* Thumbnail */}
                                      {post.mediaUrls && post.mediaUrls.length > 0 && (
                                        <div className="w-full h-28 rounded-md overflow-hidden bg-muted">
                                          <img
                                            src={post.mediaThumbnails?.[0] || post.mediaUrls[0]}
                                            alt=""
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}

                                      {/* Caption preview */}
                                      <p className="text-sm text-foreground leading-relaxed">
                                        {truncate(post.caption || "No caption", 100)}
                                      </p>

                                      {/* Time + Status */}
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                          <Clock className="w-3 h-3" />
                                          {formatTime(post.scheduledAt || post.createdAt)}
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] px-1.5 py-0 ${config.bgColor} ${config.textColor} border-transparent`}
                                        >
                                          {config.label}
                                        </Badge>
                                      </div>

                                      {/* Platform icons */}
                                      {post.platforms && post.platforms.length > 0 && (
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                          {getPlatformIcons(post.platforms)}
                                        </div>
                                      )}

                                      {/* Quick action */}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePostClick(post);
                                        }}
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View full details
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 flex-wrap">
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
        </div>

        {/* ─── UPCOMING POSTS SUMMARY ───────────────────────────────── */}
        <div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                Upcoming This Month
                {posts.filter((p) => p.status === "scheduled").length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {posts.filter((p) => p.status === "scheduled").length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {posts.filter((p) => p.status === "scheduled").length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <CalendarDays className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">No upcoming posts</h3>
                  <p className="text-sm text-muted-foreground">
                    Schedule your content from the Posts tab to see it here.
                  </p>
                </div>
              ) : (
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
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/20 transition-all cursor-pointer group"
                        onClick={() => handlePostClick(post)}
                      >
                        {/* Thumbnail or Placeholder */}
                        {post.mediaUrls && post.mediaUrls.length > 0 ? (
                          <div className="w-12 h-12 rounded-md overflow-hidden border border-border/50 shrink-0 bg-muted">
                            <img
                              src={post.mediaThumbnails?.[0] || post.mediaUrls[0]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-md border border-border/50 shrink-0 bg-muted/30 flex items-center justify-center">
                            <FileEdit className="w-4 h-4 text-muted-foreground/50" />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {truncate(post.caption || "No caption", 80)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-transparent"
                            >
                              <Clock className="w-2.5 h-2.5 mr-0.5" />
                              {format(new Date(post.scheduledAt), "MMM d, h:mm a")}
                            </Badge>
                            <div className="flex items-center gap-1 text-muted-foreground/70">
                              {getPlatformIcons(post.platforms || [])}
                            </div>
                          </div>
                        </div>

                        {/* Hover Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors">
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                        </div>
                      </motion.div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                {/* Media */}
                {selectedPost.mediaUrls && selectedPost.mediaUrls.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedPost.mediaUrls.map((url, i) => (
                      <div
                        key={i}
                        className="w-32 h-32 rounded-lg overflow-hidden border border-border shrink-0"
                      >
                        <img
                          src={selectedPost.mediaThumbnails?.[i] || url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Caption */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Caption</Label>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedPost.caption || "No caption"}
                  </p>
                </div>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Platforms</Label>
                    <div className="flex items-center gap-1.5 mt-1 text-foreground">
                      {getPlatformIcons(selectedPost.platforms || [])}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {selectedPost.status === "scheduled" ? "Scheduled for" : "Published"}
                    </Label>
                    <p className="text-foreground mt-1">
                      {format(
                        new Date(selectedPost.scheduledAt || selectedPost.publishedAt || selectedPost.createdAt),
                        "MMM d, yyyy 'at' h:mm a"
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
                      <div key={stat.label} className="text-center p-2 rounded-lg bg-muted/30">
                        <p className="text-lg font-semibold text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeletePost(selectedPost.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
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
