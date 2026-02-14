"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { AITextAssistant } from "@/components/feed/ai-text-assistant";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";

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

// ─── Social Platforms Config ────────────────────────────────────────────────
const SOCIAL_PLATFORMS = [
  { id: "feed", label: "Feed", icon: Rss, enabled: true },
  { id: "instagram", label: "Instagram", icon: InstagramIcon, enabled: false },
  { id: "twitter", label: "X / Twitter", icon: XTwitterIcon, enabled: false },
  { id: "linkedin", label: "LinkedIn", icon: LinkedInIcon, enabled: false },
  { id: "facebook", label: "Facebook", icon: FacebookIcon, enabled: false },
  { id: "tiktok", label: "TikTok", icon: TikTokIcon, enabled: false },
];

const MAX_CHARS = 2000;

// ─── Status Badge Config ────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PUBLISHED: { label: "Published", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  DRAFT: { label: "Draft", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: FileEdit },
};

export default function ContentPostsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: MediaAttachment[] = Array.from(files).map((file) => ({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      type: file.type.startsWith("video") ? "video" : "image",
      preview: URL.createObjectURL(file),
    }));

    setMediaAttachments((prev) => [...prev, ...newAttachments]);

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
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
                <PenSquare className="w-6 h-6 text-white" />
              </div>
              Posts
            </h1>
            <p className="text-muted-foreground mt-2">
              Create, manage, and schedule your content
            </p>
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
                    +5 credits
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
