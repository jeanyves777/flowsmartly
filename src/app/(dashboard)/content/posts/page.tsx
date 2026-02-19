"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Image as ImageIcon,
  FolderOpen,
  X,
  Loader2,
  Clock,
  Send,
  Rss,
  CalendarDays,
  FileEdit,
  CheckCircle2,
  MoreHorizontal,
  Eye,
  Trash2,
  ChevronDown,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/use-credit-costs";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { AITextAssistant } from "@/components/feed/ai-text-assistant";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { FileDropZone } from "@/components/shared/file-drop-zone";
import { PLATFORM_META } from "@/components/shared/social-platform-icons";

// ─── Types ──────────────────────────────────────────────────────────────────
interface MediaAttachment {
  id: string;
  file?: File;
  url: string;
  name: string;
  type: string;
  preview: string;
}

interface Post {
  id: string;
  caption: string;
  mediaUrls: string[];
  mediaThumbnails: string[];
  status: "published" | "scheduled" | "draft";
  platforms: string[];
  scheduledAt: string | null;
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

const MAX_CHARS = 2000;

// ─── Status Badge Config ────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PUBLISHED: { label: "Published", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  DRAFT: { label: "Draft", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: FileEdit },
};

export default function ContentPostsPage() {
  const { toast } = useToast();
  const { costs } = useCreditCosts("AI_POST");
  const { isConnected } = useSocialPlatforms();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build dynamic platform list: "feed" always enabled, socials enabled if connected in DB
  const SOCIAL_PLATFORMS = useMemo(() => {
    const platformOrder = ["feed", "instagram", "twitter", "linkedin", "facebook", "tiktok"];
    return platformOrder
      .filter((id) => PLATFORM_META[id])
      .map((id) => ({
        id,
        label: PLATFORM_META[id].label,
        icon: PLATFORM_META[id].icon,
        enabled: id === "feed" || isConnected(id),
      }));
  }, [isConnected]);

  // ── Composer State ──────────────────────────────────────────────────────
  const [caption, setCaption] = useState("");
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["feed"]);
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);

  // ── Posts List State ────────────────────────────────────────────────────
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalPosts, setTotalPosts] = useState(0);

  // ── Detail Dialog ─────────────────────────────────────────────────────
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);

  // ── Fetch Posts ───────────────────────────────────────────────────────
  const fetchPosts = useCallback(async (pageNum: number, status?: string, append = false) => {
    try {
      setIsLoadingPosts(true);
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "10",
      });
      if (status && status !== "all") {
        params.set("status", status);
      }

      const res = await fetch(`/api/content/posts?${params}`);
      const data = await res.json();

      if (data.success) {
        const fetched = data.data?.posts || [];
        if (append) {
          setPosts((prev) => [...prev, ...fetched]);
        } else {
          setPosts(fetched);
        }
        setHasMore(data.data?.pagination?.hasMore || false);
        setTotalPosts(data.data?.pagination?.total || 0);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPosts(false);
    }
  }, [toast]);

  useEffect(() => {
    setPage(1);
    fetchPosts(1, activeTab);
  }, [activeTab, fetchPosts]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, activeTab, true);
  };

  // ── Media Upload (Direct File Input) ──────────────────────────────────
  const uploadPostFile = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const attachment: MediaAttachment = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      url: objectUrl,
      name: file.name,
      type: file.type.startsWith("video") ? "video" : "image",
      preview: objectUrl,
    };
    setMediaAttachments((prev) => [...prev, attachment]);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(uploadPostFile);

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleMediaLibrarySelect = (url: string) => {
    const attachment: MediaAttachment = {
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url,
      name: url.split("/").pop() || "media",
      type: url.match(/\.(mp4|mov|webm|avi)$/i) ? "video" : "image",
      preview: url,
    };
    setMediaAttachments((prev) => [...prev, attachment]);
    setShowMediaLibrary(false);
  };

  const removeAttachment = (id: string) => {
    setMediaAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.file) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  // ── AI Insert ─────────────────────────────────────────────────────────
  const handleAIInsert = (content: string) => {
    setCaption((prev) => {
      const joined = prev ? prev + "\n\n" + content : content;
      return joined.slice(0, MAX_CHARS);
    });
    setAiUsed(true);
    setShowAIAssistant(false);
  };

  // ── Publish / Schedule ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!caption.trim() && mediaAttachments.length === 0) {
      toast({
        title: "Nothing to post",
        description: "Add some text or media before publishing.",
        variant: "destructive",
      });
      return;
    }

    if (isScheduleMode && (!scheduleDate || !scheduleTime)) {
      toast({
        title: "Schedule required",
        description: "Please set both a date and time for your scheduled post.",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);

    try {
      // Upload local files first
      const uploadedUrls: string[] = [];
      for (const attachment of mediaAttachments) {
        if (attachment.file) {
          const formData = new FormData();
          formData.append("file", attachment.file);
          const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.data?.url) {
            uploadedUrls.push(uploadData.data.url);
          }
        } else {
          uploadedUrls.push(attachment.url);
        }
      }

      const payload: Record<string, unknown> = {
        caption: caption.trim(),
        mediaUrls: uploadedUrls,
        platforms: selectedPlatforms,
        aiGenerated: aiUsed,
      };

      if (isScheduleMode) {
        payload.scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        payload.status = "scheduled";
      } else {
        payload.status = "published";
      }

      const res = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: isScheduleMode ? "Post scheduled" : "Post published",
          description: isScheduleMode
            ? `Your post has been scheduled for ${scheduleDate} at ${scheduleTime}.`
            : "Your post is now live!",
        });

        // Reset composer
        setCaption("");
        setMediaAttachments([]);
        setIsScheduleMode(false);
        setScheduleDate("");
        setScheduleTime("");
        setShowAIAssistant(false);
        setAiUsed(false);

        // Refresh posts list
        setPage(1);
        fetchPosts(1, activeTab);
      } else {
        throw new Error(data.error || "Failed to publish post");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Delete Post ───────────────────────────────────────────────────────
  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/content/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setTotalPosts((prev) => prev - 1);
        setShowPostDetail(false);
        toast({ title: "Post deleted", description: "The post has been removed." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete post.", variant: "destructive" });
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const truncate = (text: string, maxLen: number) =>
    text.length > maxLen ? text.slice(0, maxLen) + "..." : text;

  const getPlatformIcon = (platformId: string) => {
    const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
    if (!platform) return null;
    const Icon = platform.icon;
    return <Icon className="w-3.5 h-3.5" />;
  };

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* ─── PAGE HEADER ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
                <PenSquare className="w-4 h-4 text-white" />
              </div>
              Posts
            </h1>
          </div>
        </div>

        {/* ─── POST COMPOSER ────────────────────────────────────────── */}
        <div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center">
                  <FileEdit className="w-4 h-4 text-brand-500" />
                </div>
                Create Post
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Textarea */}
              <div className="relative">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                  placeholder="What's on your mind?"
                  className="w-full min-h-[120px] resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                />
                <span className="absolute bottom-3 right-3 text-xs text-muted-foreground select-none">
                  {caption.length}/{MAX_CHARS}
                </span>
              </div>

              {/* AI Assistant Panel */}
              <AnimatePresence>
                {showAIAssistant && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-1">
                      <AITextAssistant
                        onInsert={handleAIInsert}
                        onClose={() => setShowAIAssistant(false)}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Bar */}
              <FileDropZone
                onFileDrop={uploadPostFile}
                accept="image/*,video/*"
                disabled={isPublishing}
                dragLabel="Drop image or video here"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showAIAssistant ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowAIAssistant(!showAIAssistant)}
                        className={showAIAssistant ? "bg-brand-500 hover:bg-brand-600 text-white" : ""}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span className="hidden sm:inline">AI Write</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate content with AI</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Upload</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Upload image or video</TooltipContent>
                  </Tooltip>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowMediaLibrary(true)}
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span className="hidden sm:inline">Library</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Pick from media library</TooltipContent>
                  </Tooltip>
                </div>
              </FileDropZone>

              {/* Media Previews */}
              <AnimatePresence>
                {mediaAttachments.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex gap-2 flex-wrap">
                      {mediaAttachments.map((attachment) => (
                        <motion.div
                          key={attachment.id}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group"
                        >
                          {attachment.type === "video" ? (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          ) : (
                            <img
                              src={attachment.preview}
                              alt={attachment.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <button
                            onClick={() => removeAttachment(attachment.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Social Platform Row */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium">Publish to</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const Icon = platform.icon;
                    const isActive = selectedPlatforms.includes(platform.id);

                    if (!platform.enabled) {
                      return (
                        <Tooltip key={platform.id}>
                          <TooltipTrigger asChild>
                            <button
                              disabled
                              className="w-10 h-10 rounded-lg border border-border flex items-center justify-center opacity-50 cursor-not-allowed bg-muted/30"
                            >
                              <Icon className="w-5 h-5 text-muted-foreground" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Coming soon &mdash; under approval</TooltipContent>
                        </Tooltip>
                      );
                    }

                    return (
                      <Tooltip key={platform.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              if (platform.id === "feed") return; // Always active
                              setSelectedPlatforms((prev) =>
                                prev.includes(platform.id)
                                  ? prev.filter((p) => p !== platform.id)
                                  : [...prev, platform.id]
                              );
                            }}
                            className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                              isActive
                                ? "border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/20 text-brand-500"
                                : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{platform.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Schedule Toggle */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={isScheduleMode}
                    onCheckedChange={setIsScheduleMode}
                    id="schedule-toggle"
                  />
                  <Label htmlFor="schedule-toggle" className="text-sm cursor-pointer flex items-center gap-2">
                    {isScheduleMode ? (
                      <>
                        <CalendarDays className="w-4 h-4 text-blue-500" />
                        Schedule for later
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-green-500" />
                        Post now
                      </>
                    )}
                  </Label>
                </div>

                <AnimatePresence>
                  {isScheduleMode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-3 flex-wrap">
                        <div className="space-y-1.5">
                          <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">Date</Label>
                          <Input
                            id="schedule-date"
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                            className="w-44"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="schedule-time" className="text-xs text-muted-foreground">Time</Label>
                          <Input
                            id="schedule-time"
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-36"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Publish Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handlePublish}
                  disabled={isPublishing || (!caption.trim() && mediaAttachments.length === 0)}
                  className="flex-1 bg-brand-500 hover:bg-brand-600 text-white h-11"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isScheduleMode ? "Scheduling..." : "Publishing..."}
                    </>
                  ) : (
                    <>
                      {isScheduleMode ? (
                        <>
                          <CalendarDays className="w-4 h-4" />
                          Schedule Post
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Publish
                        </>
                      )}
                    </>
                  )}
                </Button>
                {aiUsed && (
                  <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20 shrink-0">
                    <Sparkles className="w-3 h-3 mr-1" />
                    +{costs.AI_POST ?? 5} credits
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── MY POSTS ─────────────────────────────────────────────── */}
        <div>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Rss className="w-4 h-4 text-purple-500" />
                  </div>
                  My Posts
                  {totalPosts > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {totalPosts}
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="published">Published</TabsTrigger>
                  <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  {isLoadingPosts ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 animate-pulse">
                          <div className="w-16 h-16 rounded-md bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                            <div className="h-3 bg-muted rounded w-1/4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : posts.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                        <FileEdit className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium text-foreground mb-1">No posts yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Create your first post above!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {posts.map((post) => {
                        const config = statusConfig[post.status] || statusConfig.DRAFT;
                        const StatusIcon = config.icon;
                        return (
                          <motion.div
                            key={post.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-3 p-3 rounded-lg border border-border/50 hover:border-border hover:bg-muted/20 transition-all cursor-pointer group"
                            onClick={() => {
                              setSelectedPost(post);
                              setShowPostDetail(true);
                            }}
                          >
                            {/* Thumbnail */}
                            {post.mediaUrls && post.mediaUrls.length > 0 ? (
                              <div className="w-16 h-16 rounded-md overflow-hidden border border-border/50 shrink-0 bg-muted">
                                <img
                                  src={post.mediaThumbnails?.[0] || post.mediaUrls[0]}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-md border border-border/50 shrink-0 bg-muted/30 flex items-center justify-center">
                                <FileEdit className="w-5 h-5 text-muted-foreground/50" />
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
                                {truncate(post.caption || "No caption", 150)}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${config.color}`}
                                >
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {config.label}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(post.scheduledAt || post.publishedAt || post.createdAt)}
                                </span>
                                {/* Platform icons */}
                                <div className="flex items-center gap-1 ml-auto">
                                  {post.platforms?.map((p) => (
                                    <span key={p} className="text-muted-foreground/70">
                                      {getPlatformIcon(p)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Quick actions on hover */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPost(post);
                                      setShowPostDetail(true);
                                    }}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors"
                                  >
                                    <Eye className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>View details</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePost(post.id);
                                    }}
                                    className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>Delete post</TooltipContent>
                              </Tooltip>
                            </div>
                          </motion.div>
                        );
                      })}

                      {/* Load More */}
                      {hasMore && (
                        <div className="pt-3 flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadMore}
                            disabled={isLoadingPosts}
                          >
                            {isLoadingPosts ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <ChevronDown className="w-4 h-4 mr-2" />
                            )}
                            Load more
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
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
                    className={statusConfig[selectedPost.status]?.color}
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
                    <div className="flex items-center gap-1.5 mt-1">
                      {selectedPost.platforms?.map((p) => (
                        <span key={p} className="text-foreground">
                          {getPlatformIcon(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {selectedPost.status === "scheduled" ? "Scheduled for" : "Created"}
                    </Label>
                    <p className="text-foreground mt-1">
                      {formatDate(
                        selectedPost.scheduledAt || selectedPost.publishedAt || selectedPost.createdAt
                      )}
                    </p>
                  </div>
                </div>

                {/* Engagement (published posts) */}
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

                {/* AI badge */}
                {selectedPost.aiGenerated && (
                  <Badge className="bg-brand-500/10 text-brand-500 border-brand-500/20">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI-generated content
                  </Badge>
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

        {/* ─── MEDIA LIBRARY PICKER ─────────────────────────────────── */}
        <MediaLibraryPicker
          open={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onSelect={handleMediaLibrarySelect}
          title="Select Media for Post"
          filterTypes={["image", "video"]}
        />
      </motion.div>
    </TooltipProvider>
  );
}
