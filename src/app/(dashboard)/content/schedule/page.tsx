"use client";

import { useState, useEffect, useCallback, useMemo, type DragEvent, type MouseEvent } from "react";
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
  Loader2,
  Sparkles,
  StickyNote,
  X,
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
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday,
  isPast,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingPanel } from "@/components/ui/floating-panel";
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
  mediaType?: string | null;
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
type CalendarView = "month" | "week" | "day";

const VIEW_LABELS: Array<{ id: CalendarView; label: string }> = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

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
  const [calendarView, setCalendarView] = useState<CalendarView>("month");
  const [showUpcomingPanel, setShowUpcomingPanel] = useState(false);

  // ── Floating panels ───────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [noteDate, setNoteDate] = useState("");
  const [noteEndDate, setNoteEndDate] = useState("");
  const [noteTime, setNoteTime] = useState("09:00");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [notePriority, setNotePriority] = useState("MEDIUM");
  const [noteCategory, setNoteCategory] = useState("Calendar note");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draggingItem, setDraggingItem] = useState<ScheduledPost | null>(null);
  const [resizingNote, setResizingNote] = useState<ScheduledPost | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ item: ScheduledPost; x: number; y: number } | null>(null);

  // ── Calendar Grid Computation ─────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const visibleDays = useMemo(() => {
    if (calendarView === "week") {
      return eachDayOfInterval({
        start: startOfWeek(currentMonth, { weekStartsOn: 0 }),
        end: endOfWeek(currentMonth, { weekStartsOn: 0 }),
      });
    }
    if (calendarView === "day") {
      return [currentMonth];
    }
    return calendarDays;
  }, [calendarDays, calendarView, currentMonth]);

  const visibleRange = useMemo(() => {
    const firstDay = visibleDays[0] || currentMonth;
    const lastDay = visibleDays[visibleDays.length - 1] || currentMonth;
    return { start: startOfDay(firstDay), end: startOfDay(lastDay) };
  }, [currentMonth, visibleDays]);

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

  const getValidDate = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getItemStartDate = (item: ScheduledPost) =>
    getValidDate(item.itemType === "strategy" ? item.startDate || item.dueDate || item.scheduledAt : item.scheduledAt) ||
    getValidDate(item.publishedAt) ||
    getValidDate(item.createdAt) ||
    new Date();

  const getItemEndDate = (item: ScheduledPost) =>
    getValidDate(item.itemType === "strategy" ? item.dueDate || item.startDate || item.scheduledAt : item.scheduledAt) ||
    getItemStartDate(item);

  // Group posts by date string for efficient lookup
  const postsByDate = useMemo(() => {
    const map: Record<string, ScheduledPost[]> = {};
    for (const post of filteredPosts) {
      const start = startOfDay(getItemStartDate(post));
      const end = startOfDay(getItemEndDate(post));
      const spanStart = end < start ? end : start;
      const spanEnd = end < start ? start : end;
      const activeDays = post.itemType === "strategy"
        ? eachDayOfInterval({ start: spanStart, end: spanEnd })
        : [spanStart];

      for (const activeDay of activeDays) {
        const dateKey = format(activeDay, "yyyy-MM-dd");
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(post);
      }
    }
    return map;
  }, [filteredPosts]);

  // ── Fetch Schedule ────────────────────────────────────────────────────
  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      const monthStr = format(currentMonth, "yyyy-MM");
      const start = format(visibleRange.start, "yyyy-MM-dd");
      const end = format(visibleRange.end, "yyyy-MM-dd");
      const res = await fetch(`/api/content/schedule?month=${monthStr}&start=${start}&end=${end}`);
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
  }, [currentMonth, toast, visibleRange.end, visibleRange.start]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // ── Navigation ────────────────────────────────────────────────────────
  const goToPrevMonth = () =>
    setCurrentMonth((prev) =>
      calendarView === "month" ? subMonths(prev, 1) : calendarView === "week" ? subWeeks(prev, 1) : subDays(prev, 1)
    );
  const goToNextMonth = () =>
    setCurrentMonth((prev) =>
      calendarView === "month" ? addMonths(prev, 1) : calendarView === "week" ? addWeeks(prev, 1) : addDays(prev, 1)
    );
  const goToToday = () => setCurrentMonth(new Date());

  const calendarTitle =
    calendarView === "day"
      ? format(currentMonth, "EEEE, MMM d")
      : calendarView === "week"
        ? `${format(visibleRange.start, "MMM d")} - ${format(visibleRange.end, "MMM d, yyyy")}`
        : format(currentMonth, "MMMM yyyy");

  const noteTemplates = useMemo(
    () => [
      {
        title: "Campaign kickoff",
        description: "Define the offer, audience, creative angle, channels, and approval owner before posts are drafted.",
        category: "Campaign planning",
        priority: "HIGH",
      },
      {
        title: "Content prompt",
        description: "Write the main message, proof points, CTA, and platform-specific post angles for the team.",
        category: "Content prompt",
        priority: "MEDIUM",
      },
      {
        title: "Review health check",
        description: "Check Google, Yelp, and local listings. Reply to pending reviews and flag anything that needs owner approval.",
        category: "Local listings",
        priority: "MEDIUM",
      },
    ],
    []
  );

  const openNotePanel = (day: Date = new Date()) => {
    setEditingNoteId(null);
    setNoteDate(format(day, "yyyy-MM-dd"));
    setNoteEndDate(format(day, "yyyy-MM-dd"));
    setNoteTime("09:00");
    setNoteTitle("");
    setNoteDescription("");
    setNotePriority("MEDIUM");
    setNoteCategory("Calendar note");
    setShowNotePanel(true);
  };

  const openEditNotePanel = (note: ScheduledPost) => {
    const itemStart = getItemStartDate(note);
    const itemEnd = getItemEndDate(note);
    setEditingNoteId(note.id);
    setNoteDate(format(itemStart, "yyyy-MM-dd"));
    setNoteEndDate(format(itemEnd, "yyyy-MM-dd"));
    setNoteTime(format(itemStart, "HH:mm"));
    setNoteTitle(note.title || note.caption || "");
    setNoteDescription(note.description || "");
    setNotePriority(note.priority || "MEDIUM");
    setNoteCategory(note.category || "Calendar note");
    setSelectedPost(note);
    setShowPostDetail(false);
    setShowNotePanel(true);
  };

  const applyNoteTemplate = (template: typeof noteTemplates[number]) => {
    setNoteTitle(template.title);
    setNoteDescription(template.description);
    setNoteCategory(template.category);
    setNotePriority(template.priority);
  };

  const handleSaveNote = async () => {
    if (!noteDate || !noteTitle.trim()) {
      toast({
        title: "Note needs a title",
        description: "Add the strategy prompt or task name before saving.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSavingNote(true);
      const startDate = new Date(`${noteDate}T${noteTime || "09:00"}`);
      const dueDate = new Date(`${noteEndDate || noteDate}T${noteTime || "09:00"}`);
      if (dueDate < startDate) {
        toast({
          title: "End date is before start",
          description: "Choose an end date on or after the note start date.",
          variant: "destructive",
        });
        return;
      }
      const res = await fetch(editingNoteId ? `/api/content/schedule/notes/${editingNoteId}` : "/api/content/schedule/notes", {
        method: editingNoteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle.trim(),
          description: noteDescription.trim(),
          startDate: startDate.toISOString(),
          dueDate: dueDate.toISOString(),
          priority: notePriority,
          category: noteCategory.trim() || "Calendar note",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to save note");
      }

      setShowNotePanel(false);
      setEditingNoteId(null);
      await fetchSchedule();
      toast({
        title: editingNoteId ? "Note updated" : "Note added",
        description: editingNoteId ? "The calendar note was updated." : "The strategy note is now on your calendar.",
      });
    } catch (error) {
      toast({
        title: "Could not save note",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  // ── Click on empty day -> create a calendar note ──────────────────────
  const handleEmptyDayClick = (day: Date) => {
    openNotePanel(day);
  };

  const handlePostClick = (post: ScheduledPost) => {
    if (post.itemType === "strategy") {
      openEditNotePanel(post);
      return;
    }
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

  const buildMovedDate = (item: ScheduledPost, day: Date) => {
    const existing = new Date(getCalendarItemDate(item));
    const moved = new Date(day);
    moved.setHours(
      Number.isNaN(existing.getTime()) ? 9 : existing.getHours(),
      Number.isNaN(existing.getTime()) ? 0 : existing.getMinutes(),
      0,
      0
    );
    return moved;
  };

  const moveCalendarItem = async (item: ScheduledPost, day: Date) => {
    const movedDate = buildMovedDate(item, day);
    const originalStart = getItemStartDate(item);
    const originalEnd = getItemEndDate(item);
    const noteSpanDays = item.itemType === "strategy"
      ? Math.max(0, differenceInCalendarDays(startOfDay(originalEnd), startOfDay(originalStart)))
      : 0;
    const movedEndDate = item.itemType === "strategy" ? addDays(movedDate, noteSpanDays) : movedDate;

    if (item.itemType !== "strategy" && movedDate <= new Date()) {
      toast({
        title: "Choose a future time",
        description: "Scheduled posts can only be moved to a future date and time.",
        variant: "destructive",
      });
      return;
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === item.id
          ? {
              ...post,
              scheduledAt: item.itemType === "strategy" ? movedEndDate.toISOString() : movedDate.toISOString(),
              dueDate: item.itemType === "strategy" ? movedEndDate.toISOString() : post.dueDate,
              startDate: item.itemType === "strategy" ? movedDate.toISOString() : post.startDate,
            }
          : post
      )
    );

    const res = await fetch(item.itemType === "strategy" ? `/api/content/schedule/notes/${item.id}` : "/api/content/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        item.itemType === "strategy"
          ? { dueDate: movedEndDate.toISOString(), startDate: movedDate.toISOString() }
          : { postId: item.id, scheduledAt: movedDate.toISOString() }
      ),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      await fetchSchedule();
      throw new Error(data.error?.message || "Could not move calendar item");
    }

    toast({
      title: item.itemType === "strategy" ? "Note moved" : "Post rescheduled",
      description: `${format(movedDate, "MMM d")} at ${format(movedDate, "h:mm a")}`,
    });
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, item: ScheduledPost) => {
    event.stopPropagation();
    setDraggingItem(item);
    setResizingNote(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  };

  const handleResizeStart = (event: DragEvent<HTMLSpanElement>, item: ScheduledPost) => {
    event.stopPropagation();
    setDraggingItem(null);
    setResizingNote(item);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `resize:${item.id}`);
  };

  const resizeNoteToDay = async (item: ScheduledPost, day: Date) => {
    if (item.itemType !== "strategy") return;

    const start = getItemStartDate(item);
    const resizedEnd = buildMovedDate(item, day);
    if (startOfDay(resizedEnd) < startOfDay(start)) {
      toast({
        title: "Cannot shorten before start",
        description: "Drag the edge to a day on or after the note starts.",
        variant: "destructive",
      });
      return;
    }

    setPosts((prev) =>
      prev.map((post) =>
        post.id === item.id
          ? {
              ...post,
              scheduledAt: resizedEnd.toISOString(),
              startDate: start.toISOString(),
              dueDate: resizedEnd.toISOString(),
            }
          : post
      )
    );

    const res = await fetch(`/api/content/schedule/notes/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: start.toISOString(),
        dueDate: resizedEnd.toISOString(),
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      await fetchSchedule();
      throw new Error(data.error?.message || "Could not resize note");
    }

    toast({
      title: "Note extended",
      description: `${format(start, "MMM d")} to ${format(resizedEnd, "MMM d")}`,
    });
  };

  const handleDropOnDay = async (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = event.dataTransfer.getData("text/plain");
    const isResize = itemId.startsWith("resize:");
    const resolvedId = isResize ? itemId.replace("resize:", "") : itemId;
    const item = (isResize ? resizingNote : draggingItem) || posts.find((post) => post.id === resolvedId);
    if (!item) return;

    try {
      if (isResize || resizingNote) {
        await resizeNoteToDay(item, day);
      } else {
        await moveCalendarItem(item, day);
      }
    } catch (error) {
      toast({
        title: "Move failed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setDraggingItem(null);
      setResizingNote(null);
      setHoveredItem(null);
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

  const getPlatformStack = (platforms: string[] = []) =>
    platforms
      .filter((platform) => platform !== "strategy" && PLATFORM_META[platform])
      .slice(0, 4)
      .map((platform) => {
        const Icon = PLATFORM_META[platform].icon;
        return (
          <span
            key={platform}
            className="-ml-1 first:ml-0 inline-flex h-4 w-4 items-center justify-center rounded-full border bg-background text-foreground shadow-sm"
            title={PLATFORM_META[platform].label}
          >
            <Icon className="h-2.5 w-2.5" />
          </span>
        );
      });

  const handlePreviewHover = (event: MouseEvent<HTMLButtonElement>, item: ScheduledPost) => {
    setHoveredItem({ item, x: event.clientX, y: event.clientY });
  };

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

  const getCalendarItemDate = (item: ScheduledPost) => getItemStartDate(item).toISOString();

  const getCalendarItemDateLabel = (item: ScheduledPost) => {
    const start = getItemStartDate(item);
    const end = getItemEndDate(item);
    if (item.itemType === "strategy" && differenceInCalendarDays(startOfDay(end), startOfDay(start)) > 0) {
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    }
    return format(start, "MMM d, yyyy h:mm a");
  };

  // Stats
  const scheduledCount = filteredPosts.filter((p) => p.itemType !== "strategy").length;
  const strategyCount = filteredPosts.filter((p) => p.itemType === "strategy").length;
  const activeDaysCount = Object.keys(postsByDate).length;
  const upcomingItems = useMemo(() => {
    const today = startOfDay(new Date());
    return filteredPosts
      .filter((item) => startOfDay(getItemEndDate(item)) >= today)
      .sort((a, b) => getItemStartDate(a).getTime() - getItemStartDate(b).getTime())
      .slice(0, 12);
  }, [filteredPosts]);
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
        <div className={`grid gap-4 ${showUpcomingPanel ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <Card className="min-w-0 border-border/60 shadow-sm">
          {/* Month Navigation Bar */}
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
                <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="min-w-0 flex-1 text-center text-lg font-semibold text-foreground sm:min-w-[180px]">
                  {calendarTitle}
                </h2>
                <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                <Button variant="outline" size="sm" onClick={goToToday} className="flex-1 sm:flex-none">
                  Today
                </Button>
                <div className="inline-flex h-9 rounded-lg border bg-muted/30 p-1">
                  {VIEW_LABELS.map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => setCalendarView(view.id)}
                      className={`rounded-md px-3 text-xs font-semibold transition ${
                        calendarView === view.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant={showUpcomingPanel ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setShowUpcomingPanel((open) => !open);
                    if (!selectedPost && upcomingItems[0]) setSelectedPost(upcomingItems[0]);
                  }}
                  className={showUpcomingPanel ? "flex-1 bg-brand-500 text-white hover:bg-brand-600 sm:flex-none" : "flex-1 sm:flex-none"}
                >
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  Upcoming
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => openNotePanel(new Date())}
                >
                  <StickyNote className="w-3.5 h-3.5 mr-1" />
                  New note
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
                <div className={`${calendarView === "day" ? "grid grid-cols-1" : "grid grid-cols-7"} mb-1`}>
                  {(calendarView === "day" ? [format(currentMonth, "EEEE")] : WEEKDAYS).map((day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className={`${calendarView === "day" ? "grid-cols-1" : "grid-cols-7"} grid border-t border-l border-border/40 rounded-lg overflow-hidden`}>
                  {visibleDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayPosts = postsByDate[dateKey] || [];
                    const inCurrentMonth = calendarView === "month" ? isSameMonth(day, currentMonth) : true;
                    const today = isToday(day);
                    const pastDay = isPast(day) && !today;
                    const isEmpty = dayPosts.length === 0;
                    const maxVisibleItems = calendarView === "month" ? 3 : calendarView === "week" ? 8 : 18;

                    return (
                      <div
                        key={dateKey}
                        className={`relative border-r border-b border-border/40 p-1.5 transition-colors group ${
                          calendarView === "day"
                            ? "min-h-[520px]"
                            : calendarView === "week"
                              ? "min-h-[420px]"
                              : "min-h-[110px] sm:min-h-[140px] lg:min-h-[155px]"
                        } ${
                          !inCurrentMonth
                            ? "bg-muted/20"
                            : today
                              ? "bg-blue-500/5"
                              : isEmpty && !pastDay
                                ? "hover:bg-brand-500/5 cursor-pointer"
                                : "hover:bg-muted/10"
                        } ${(draggingItem || resizingNote) && inCurrentMonth ? "outline outline-1 outline-brand-500/20 outline-offset-[-3px]" : ""}`}
                        onDragOver={(event) => {
                          if ((!draggingItem && !resizingNote) || !inCurrentMonth) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          if (inCurrentMonth) void handleDropOnDay(event, day);
                        }}
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
                          {dayPosts.length > maxVisibleItems && (
                            <span className="text-[9px] text-muted-foreground bg-muted/50 px-1 rounded">
                              +{dayPosts.length - maxVisibleItems}
                            </span>
                          )}
                        </div>

                        {/* Post Indicators */}
                        <div className="space-y-0.5">
                          {dayPosts.slice(0, maxVisibleItems).map((post) => {
                            const config = statusConfig[post.status] || statusConfig.draft;
                            const firstPlatform = (post.platforms || []).find((platform) => PLATFORM_META[platform]);
                            const PlatformIcon = firstPlatform ? PLATFORM_META[firstPlatform].icon : FileEdit;
                            const spanDays = post.itemType === "strategy"
                              ? Math.max(0, differenceInCalendarDays(startOfDay(getItemEndDate(post)), startOfDay(getItemStartDate(post))))
                              : 0;
                            return (
                              <button
                                key={post.id}
                                draggable
                                onDragStart={(event) => handleDragStart(event, post)}
                                onDragEnd={() => {
                                  setDraggingItem(null);
                                  setResizingNote(null);
                                  setHoveredItem(null);
                                }}
                                onMouseEnter={(event) => handlePreviewHover(event, post)}
                                onMouseMove={(event) => handlePreviewHover(event, post)}
                                onMouseLeave={() => setHoveredItem(null)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePostClick(post);
                                }}
                                className={`flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[10px] leading-tight transition-all cursor-grab active:cursor-grabbing sm:text-[11px] ${getCalendarItemStyle(post)} hover:ring-1 hover:ring-current/20`}
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
                                {post.itemType !== "strategy" && (
                                  <span className="hidden shrink-0 items-center sm:inline-flex">
                                    {getPlatformStack(post.platforms || [])}
                                  </span>
                                )}
                                {post.itemType === "strategy" && spanDays > 0 && (
                                  <span className="hidden rounded-full bg-background/60 px-1 text-[9px] font-bold sm:inline">
                                    {spanDays + 1}d
                                  </span>
                                )}
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotColor}`} />
                                {post.itemType === "strategy" && (
                                  <span
                                    draggable
                                    onDragStart={(event) => handleResizeStart(event, post)}
                                    onClick={(event) => event.stopPropagation()}
                                    className="-mr-1 ml-0.5 h-5 w-2 shrink-0 cursor-ew-resize rounded-full bg-current/25 transition hover:bg-current/45"
                                    title="Drag to extend note"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Empty day + icon on hover (future days only) */}
                        {isEmpty && inCurrentMonth && !pastDay && (
                          <div className="absolute inset-x-2 bottom-2 top-9 flex items-center justify-center rounded-xl border border-dashed border-border/60 opacity-60 transition-opacity pointer-events-none group-hover:opacity-100">
                            <div className="flex h-8 items-center gap-1.5 rounded-full bg-brand-500/10 px-2 text-brand-500">
                              <Plus className="w-3.5 h-3.5 text-brand-500" />
                              <span className="hidden text-[10px] font-semibold sm:inline">Note</span>
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

        <AnimatePresence>
          {showUpcomingPanel && (
            <motion.aside
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              className="min-w-0 rounded-xl border bg-background p-3 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">Upcoming</p>
                  <p className="text-xs text-muted-foreground">{upcomingItems.length} planned item{upcomingItems.length === 1 ? "" : "s"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowUpcomingPanel(false)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {upcomingItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    No upcoming posts or notes in this range.
                  </div>
                ) : (
                  upcomingItems.map((item) => {
                    const itemActive = selectedPost?.id === item.id;
                    const firstPlatform = (item.platforms || []).find((platform) => PLATFORM_META[platform]);
                    const PlatformIcon = firstPlatform ? PLATFORM_META[firstPlatform].icon : StickyNote;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSelectedPost(item);
                          setShowPostDetail(false);
                        }}
                        className={`w-full rounded-xl border p-3 text-left transition hover:border-brand-500/40 hover:bg-brand-500/5 ${
                          itemActive ? "border-brand-500/50 bg-brand-500/10" : "bg-background"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                              <PlatformIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                {item.itemType === "strategy" ? item.title || "Strategy note" : item.caption || "Scheduled post"}
                              </span>
                              <span className="block text-xs text-muted-foreground">{getCalendarItemDateLabel(item)}</span>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center">{getPlatformStack(item.platforms || [])}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {item.description || item.caption || item.title || "No content yet"}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedPost && (
                <div className="mt-3 rounded-xl border bg-muted/20 p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {selectedPost.itemType === "strategy" ? selectedPost.title || "Strategy note" : "Scheduled post"}
                      </p>
                      <p className="text-xs text-muted-foreground">{getCalendarItemDateLabel(selectedPost)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedPost(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <p className="max-h-36 overflow-auto whitespace-pre-wrap text-sm leading-5">
                    {selectedPost.description || selectedPost.caption || selectedPost.title || "No content yet"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {selectedPost.itemType === "strategy" ? (
                      <>
                        <Badge variant="outline">{selectedPost.priority || "MEDIUM"}</Badge>
                        <span>{selectedPost.category || "Calendar note"}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center">{getPlatformStack(selectedPost.platforms || [])}</span>
                        <span>{selectedPost.platforms?.length || 0} channel{selectedPost.platforms?.length === 1 ? "" : "s"}</span>
                      </>
                    )}
                  </div>

                  {selectedPost.itemType !== "strategy" && selectedPost.mediaUrls?.filter(Boolean).length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-xl border bg-background">
                      {isVideoUrl(selectedPost.mediaUrls[0]) ? (
                        <video src={selectedPost.mediaUrls[0]} controls preload="metadata" className="h-40 w-full object-cover" />
                      ) : (
                        <img src={selectedPost.mediaUrls[0]} alt="" className="h-40 w-full object-cover" />
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex gap-2 border-t pt-3">
                    {selectedPost.itemType === "strategy" ? (
                      <Button size="sm" className="flex-1 bg-brand-500 text-white hover:bg-brand-600" onClick={() => openEditNotePanel(selectedPost)}>
                        <FileEdit className="mr-1 h-3.5 w-3.5" />
                        Edit note
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowPostDetail(true)}>
                        <CalendarDays className="mr-1 h-3.5 w-3.5" />
                        Details
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
        </div>

        {hoveredItem && (
          <div
            className="pointer-events-none fixed z-[70] w-[320px] rounded-2xl border bg-background/96 p-3 text-foreground shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/96"
            style={{
              left: Math.max(
                8,
                Math.min(
                  hoveredItem.x + 16,
                  typeof window === "undefined" ? hoveredItem.x + 16 : window.innerWidth - 340
                )
              ),
              top: Math.max(
                8,
                Math.min(
                  hoveredItem.y + 16,
                  typeof window === "undefined" ? hoveredItem.y + 16 : window.innerHeight - 260
                )
              ),
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                  {hoveredItem.item.itemType === "strategy" ? (
                    <StickyNote className="h-4 w-4" />
                  ) : (
                    <CalendarDays className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {hoveredItem.item.itemType === "strategy" ? hoveredItem.item.title || "Strategy note" : "Scheduled post"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getCalendarItemDateLabel(hoveredItem.item)}
                  </p>
                </div>
              </div>
              <span className="flex shrink-0 items-center">{getPlatformStack(hoveredItem.item.platforms || [])}</span>
            </div>
            <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-5">
              {hoveredItem.item.description || hoveredItem.item.caption || hoveredItem.item.title || "No content yet"}
            </p>
            {hoveredItem.item.itemType === "strategy" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                  {hoveredItem.item.priority || "MEDIUM"}
                </span>
                <span className="truncate">{hoveredItem.item.category || "Calendar note"}</span>
              </div>
            )}
            {hoveredItem.item.itemType !== "strategy" && hoveredItem.item.mediaUrls?.filter(Boolean).length > 0 && (
              <div className="mt-3 overflow-hidden rounded-xl border bg-muted">
                {isVideoUrl(hoveredItem.item.mediaUrls[0]) ? (
                  <video src={hoveredItem.item.mediaUrls[0]} muted playsInline preload="metadata" className="h-28 w-full object-cover" />
                ) : (
                  <img src={hoveredItem.item.mediaUrls[0]} alt="" className="h-28 w-full object-cover" />
                )}
              </div>
            )}
            <p className="mt-2 text-[11px] font-medium text-muted-foreground">Drag to move. Click notes to edit.</p>
          </div>
        )}

        <FloatingPanel
          open={showPostDetail}
          onOpenChange={setShowPostDetail}
          title={selectedPost?.itemType === "strategy" ? "Strategy note" : "Post details"}
          description={selectedPost ? getCalendarItemDateLabel(selectedPost) : undefined}
          icon={selectedPost?.itemType === "strategy" ? <StickyNote className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          defaultSize={{ width: 520, height: 640 }}
          defaultPosition={{ y: 104 }}
        >
            <div className="mb-4 flex items-center gap-2">
                {selectedPost && (
                  <Badge
                    variant="outline"
                    className={`${statusConfig[selectedPost.status]?.bgColor} ${statusConfig[selectedPost.status]?.textColor} border-transparent`}
                  >
                    {statusConfig[selectedPost.status]?.label}
                  </Badge>
                )}
            </div>
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
        </FloatingPanel>

        <FloatingPanel
          open={showNotePanel}
          onOpenChange={(open) => {
            setShowNotePanel(open);
            if (!open) setEditingNoteId(null);
          }}
          title={editingNoteId ? "Edit note" : "Calendar note"}
          description={noteDate ? `${noteDate}${noteEndDate && noteEndDate !== noteDate ? ` to ${noteEndDate}` : ""} ${noteTime || ""}` : "Add strategy work to the calendar."}
          icon={<StickyNote className="h-4 w-4" />}
          defaultSize={{ width: 500, height: 610 }}
          defaultPosition={{ y: 136 }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-500/10 via-background to-amber-500/10 p-3 dark:from-cyan-400/10 dark:to-amber-400/10">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-brand-500" />
                AI prompt starters
              </div>
              <div className="grid gap-2">
                {noteTemplates.map((template) => (
                  <button
                    key={template.title}
                    type="button"
                    onClick={() => applyNoteTemplate(template)}
                    className="rounded-xl border bg-background/80 px-3 py-2 text-left transition hover:border-brand-500/40 hover:bg-brand-500/5 dark:bg-neutral-950/70"
                  >
                    <span className="block text-sm font-semibold text-foreground">{template.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="note-date">Start</Label>
                <Input
                  id="note-date"
                  type="date"
                  value={noteDate}
                  onChange={(event) => {
                    setNoteDate(event.target.value);
                    if (!noteEndDate || noteEndDate < event.target.value) setNoteEndDate(event.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-end-date">End</Label>
                <Input
                  id="note-end-date"
                  type="date"
                  value={noteEndDate}
                  min={noteDate}
                  onChange={(event) => setNoteEndDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-time">Time</Label>
                <Input
                  id="note-time"
                  type="time"
                  value={noteTime}
                  onChange={(event) => setNoteTime(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-title">Note</Label>
              <Input
                id="note-title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                placeholder="Campaign idea, prompt, task, or reminder"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-description">Prompt for the team</Label>
              <Textarea
                id="note-description"
                value={noteDescription}
                onChange={(event) => setNoteDescription(event.target.value)}
                placeholder="Map the idea, approvals, creative direction, and execution notes."
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={notePriority} onValueChange={setNotePriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[220]">
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-category">Category</Label>
                <Input
                  id="note-category"
                  value={noteCategory}
                  onChange={(event) => setNoteCategory(event.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNotePanel(false)}
                disabled={isSavingNote}
              >
                Close
              </Button>
              <Button
                className="flex-1 bg-brand-500 text-white hover:bg-brand-600"
                onClick={handleSaveNote}
                disabled={isSavingNote}
              >
                {isSavingNote ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <StickyNote className="mr-2 h-4 w-4" />
                )}
                {editingNoteId ? "Update note" : "Save note"}
              </Button>
            </div>
          </div>
        </FloatingPanel>
      </motion.div>
    </TooltipProvider>
  );
}
