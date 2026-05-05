"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Send,
  CalendarDays,
  PenSquare,
  Save,
  Clock,
  X,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Image as ImageIcon,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { PLATFORM_META, PLATFORM_ORDER, PLATFORM_REQUIREMENTS } from "@/components/shared/social-platform-icons";

// ── Types ───────────────────────────────────────────────────────────────────
interface PlatformPublishResult {
  success: boolean;
  postId?: string;
  error?: string;
}

const MAX_CHARS = 2000;

export default function ContentPostsPage() {
  const { toast } = useToast();
  const { isConnected } = useSocialPlatforms();
  const searchParams = useSearchParams();

  // Build dynamic platform list from DB connections
  const SOCIAL_PLATFORMS = useMemo(() => {
    return PLATFORM_ORDER
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
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["feed"]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishAction, setPublishAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showAIPilotModal, setShowAIPilotModal] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  // ── Publish Results Modal State ───────────────────────────────────────
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [publishResults, setPublishResults] = useState<Record<string, PlatformPublishResult>>({});
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [retryingPlatforms, setRetryingPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const dateFromCalendar = searchParams.get("scheduleDate");
    if (dateFromCalendar) {
      setScheduleDate(dateFromCalendar);
      setShowSchedulePicker(true);
    }
  }, [searchParams]);

  // ── Content Type Detection & Platform Compatibility ─────────────────────
  const VIDEO_EXTS = [".mp4", ".webm", ".mov", ".avi"];
  const isVideoUrl = (url: string) => VIDEO_EXTS.some((ext) => url.toLowerCase().includes(ext));

  const contentState = useMemo(() => {
    const hasText = caption.trim().length > 0;
    const hasImage = mediaUrls.some((url) => !isVideoUrl(url));
    const hasVideo = mediaUrls.some((url) => isVideoUrl(url));
    const hasMedia = mediaUrls.length > 0;
    return { hasText, hasImage, hasVideo, hasMedia };
  }, [caption, mediaUrls]);

  const getIncompatibleReason = useCallback(
    (platformId: string): string | null => {
      const reqs = PLATFORM_REQUIREMENTS[platformId];
      if (!reqs) return null;
      // If no content yet, allow pre-selection
      if (!contentState.hasText && !contentState.hasMedia) return null;

      const hasOnlyText = contentState.hasText && !contentState.hasMedia;
      const hasOnlyImages = contentState.hasImage && !contentState.hasVideo;
      const hasOnlyVideo = contentState.hasVideo && !contentState.hasImage;

      // Text-only post
      if (hasOnlyText && !reqs.text) {
        if (!reqs.image && reqs.video) return "Requires video";
        if (reqs.image) return "Requires an image";
        return "Requires media";
      }
      // Image-only post
      if (hasOnlyImages && !reqs.image) {
        if (reqs.video) return "Requires video";
        return "Doesn't support images";
      }
      // Video-only post
      if (hasOnlyVideo && !reqs.video) {
        return "Doesn't support video";
      }
      // Mixed image+video: check if platform supports at least one
      if (contentState.hasImage && contentState.hasVideo) {
        if (!reqs.image && !reqs.video) return "Requires different media";
      }
      return null;
    },
    [contentState]
  );

  // Auto-deselect platforms that become incompatible when content changes
  useEffect(() => {
    if (!contentState.hasText && !contentState.hasMedia) return; // no content yet, skip
    setSelectedPlatforms((prev) =>
      prev.filter((id) => id === "feed" || !getIncompatibleReason(id))
    );
  }, [contentState, getIncompatibleReason]);

  // ── AI Idea Generation ──────────────────────────────────────────────────
  const handleGenerateIdea = async () => {
    try {
      setIsGeneratingIdea(true);
      const res = await fetch("/api/content/posts/generate-idea", { method: "POST" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed to generate idea");
      setCaption(data.data.idea);
      toast({ title: "Post idea generated!" });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to generate idea",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  // ── Publish / Schedule / Draft ────────────────────────────────────────
  const handleSubmit = async (action: "publish" | "draft" | "schedule") => {
    if (!caption.trim() && mediaUrls.length === 0) {
      toast({
        title: "Nothing to post",
        description: "Add some text or media before posting.",
        variant: "destructive",
      });
      return;
    }

    if (action === "schedule" && (!scheduleDate || !scheduleTime)) {
      toast({
        title: "Schedule required",
        description: "Please set both a date and time.",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);
    setPublishAction(action);

    try {
      const payload: Record<string, unknown> = {
        caption: caption.trim(),
        mediaUrls,
        platforms: selectedPlatforms,
        aiGenerated: false,
      };

      if (action === "schedule") {
        payload.scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        payload.status = "scheduled";
      } else if (action === "draft") {
        payload.status = "draft";
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
        const postId = data.data?.post?.id;
        setLastPostId(postId || null);

        // Reset composer
        setCaption("");
        setMediaUrls([]);
        setShowSchedulePicker(false);
        setScheduleDate("");
        setScheduleTime("");

        // Show results modal if external platforms were selected
        const externalPlatforms = selectedPlatforms.filter((p) => p !== "feed");
        if (action === "publish" && externalPlatforms.length > 0 && data.data?.publishResults) {
          // Add feed as success (always works since it's internal DB)
          const allResults: Record<string, PlatformPublishResult> = {
            feed: { success: true },
            ...data.data.publishResults,
          };
          setPublishResults(allResults);
          setShowResultsModal(true);
        } else {
          const messages = {
            publish: { title: "Post published!", description: "Your post is now live." },
            draft: { title: "Draft saved", description: "Your post has been saved as a draft." },
            schedule: { title: "Post scheduled", description: `Scheduled for ${scheduleDate} at ${scheduleTime}.` },
          };
          toast(messages[action]);
        }
      } else {
        throw new Error(data.error?.message || data.error || "Failed to save post");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
      setPublishAction(null);
    }
  };

  // ── Retry Failed Platforms ────────────────────────────────────────────
  const handleRetryFailed = async () => {
    if (!lastPostId) return;

    const failedPlatforms = Object.entries(publishResults)
      .filter(([, r]) => !r.success)
      .map(([p]) => p);

    if (failedPlatforms.length === 0) return;

    setRetryingPlatforms(failedPlatforms);

    try {
      const res = await fetch(`/api/content/posts/${lastPostId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: failedPlatforms }),
      });

      const data = await res.json();

      if (data.success && data.data?.publishResults) {
        setPublishResults((prev) => ({ ...prev, ...data.data.publishResults }));
      } else {
        toast({
          title: "Retry failed",
          description: data.error?.message || "Could not retry publishing",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Retry failed", description: "Network error", variant: "destructive" });
    } finally {
      setRetryingPlatforms([]);
    }
  };

  const hasContent = caption.trim().length > 0 || mediaUrls.length > 0;
  const selectedExternalCount = selectedPlatforms.filter((platform) => platform !== "feed").length;
  const captionPreview = caption.trim() || "Preview updates while you type.";
  const selectablePlatforms = SOCIAL_PLATFORMS.filter(
    (platform) => platform.enabled && !getIncompatibleReason(platform.id)
  );
  const filteredPlatforms = SOCIAL_PLATFORMS.filter((platform) =>
    platform.label.toLowerCase().includes(channelSearch.trim().toLowerCase())
  );
  const selectAllPlatforms = () => {
    setSelectedPlatforms(selectablePlatforms.map((platform) => platform.id));
  };
  const clearExternalPlatforms = () => {
    setSelectedPlatforms(["feed"]);
  };
  const readinessItems = [
    {
      label: "Message",
      ready: caption.trim().length > 0,
      detail: caption.trim().length > 0 ? `${caption.length} characters` : "Add caption copy",
    },
    {
      label: "Media",
      ready: mediaUrls.length > 0,
      detail: mediaUrls.length > 0 ? `${mediaUrls.length} asset${mediaUrls.length === 1 ? "" : "s"}` : "Optional",
    },
    {
      label: "Channels",
      ready: selectedPlatforms.length > 0,
      detail: `${selectedPlatforms.length} selected`,
    },
    {
      label: "Timing",
      ready: !showSchedulePicker || (!!scheduleDate && !!scheduleTime),
      detail: showSchedulePicker && scheduleDate && scheduleTime ? `${scheduleDate} at ${scheduleTime}` : "Publish now or schedule",
    },
  ];
  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* ─── PAGE HEADER ──────────────────────────────────────────── */}
        <div className="rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm font-semibold">
                <PenSquare className="h-4 w-4 text-brand-500" />
                Create Post
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSubmit("draft")}
                disabled={isPublishing || !hasContent}
                className="h-9 text-muted-foreground"
              >
                <Save className="mr-2 h-4 w-4" />
                Save draft
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreviewModal(true)}
                className="h-9"
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIPilotModal(true)}
                className="h-9"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Pilot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReadinessModal(true)}
                className="h-9"
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                Readiness
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSchedulePicker((value) => !value)}
                disabled={isPublishing}
                className="h-9"
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {showSchedulePicker ? "Hide schedule" : "Schedule options"}
              </Button>
            </div>
          </div>
        </div>

        {/* ─── POST COMPOSER ────────────────────────────────────────── */}
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="border-border/60 shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold">Accounts</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedPlatforms.length} selected
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={channelSearch}
                  onChange={(event) => setChannelSearch(event.target.value)}
                  placeholder="Search channels"
                  className="h-9 pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 flex-1" onClick={selectAllPlatforms}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 flex-1" onClick={clearExternalPlatforms}>
                  Clear
                </Button>
              </div>
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredPlatforms.map((platform) => {
                  const Icon = platform.icon;
                  const isActive = selectedPlatforms.includes(platform.id);
                  const incompatibleReason = getIncompatibleReason(platform.id);
                  const isDisabled = !platform.enabled || !!incompatibleReason;

                  return (
                    <Tooltip key={platform.id}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            if (platform.id === "feed") return;
                            setSelectedPlatforms((prev) =>
                              prev.includes(platform.id)
                                ? prev.filter((p) => p !== platform.id)
                                : [...prev, platform.id]
                            );
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                            isDisabled
                              ? "cursor-not-allowed bg-muted/30 opacity-50"
                              : isActive
                                ? "border-brand-500 bg-brand-500/10 text-brand-500"
                                : "hover:border-muted-foreground/40 hover:bg-muted/30"
                          }`}
                        >
                          <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                            isActive ? "border-brand-500 bg-brand-500 text-white" : "bg-background"
                          }`}>
                            {isActive && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </span>
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{platform.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {platform.id === "feed"
                                ? "Internal feed"
                                : incompatibleReason || (platform.enabled ? "Ready" : "Connect in settings")}
                            </span>
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {incompatibleReason
                          ? `${platform.label}: ${incompatibleReason}`
                          : platform.enabled
                            ? platform.label
                            : `Connect ${platform.label} in Settings`}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        <Card className="border-border/60 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <Label className="font-semibold">Media</Label>
              <MediaUploader
                value={mediaUrls}
                onChange={setMediaUrls}
                multiple
                maxFiles={50}
                accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                maxSize={100 * 1024 * 1024}
                filterTypes={["image", "video"]}
                uploadEndpoint="/api/media"
                disabled={isPublishing}
                variant="small"
                placeholder="Add media"
                libraryTitle="Select Media for Post"
              />
            </div>

            {/* AI Idea + History above textarea */}
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Caption</Label>
              <div className="flex items-center gap-1">
                <AIIdeasHistory
                  contentType="post_ideas"
                  mode="single"
                  onSelect={(idea) => setCaption(idea)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-500/10"
                  onClick={handleGenerateIdea}
                  disabled={isGeneratingIdea}
                >
                  {isGeneratingIdea ? (
                    <AISpinner className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  AI Idea
                </Button>
              </div>
            </div>

            {/* AI Generation Loader */}
            <AnimatePresence>
              {isGeneratingIdea && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-4">
                    <AIGenerationLoader
                      compact
                      currentStep="Generating post idea..."
                      subtitle="Using your brand identity"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Write your post content here..."
                className="w-full min-h-[140px] resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              />
              <span className="absolute bottom-3 right-3 text-xs text-muted-foreground select-none">
                {caption.length}/{MAX_CHARS}
              </span>
            </div>

            {/* Schedule Date/Time Picker (shown when Schedule is clicked) */}
            <AnimatePresence>
              {showSchedulePicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <CalendarDays className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="flex gap-3 flex-wrap flex-1">
                      <div className="space-y-1">
                        <Label htmlFor="schedule-date" className="text-xs text-muted-foreground">Date</Label>
                        <Input
                          id="schedule-date"
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-44 h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="schedule-time" className="text-xs text-muted-foreground">Time</Label>
                        <Input
                          id="schedule-time"
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-36 h-9"
                        />
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        setShowSchedulePicker(false);
                        setScheduleDate("");
                        setScheduleTime("");
                      }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons: Publish Now | Save as Draft | Schedule */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Button
                onClick={() => handleSubmit("publish")}
                disabled={isPublishing || !hasContent}
                className="flex-1 sm:flex-none bg-brand-500 hover:bg-brand-600 text-white h-10"
              >
                {isPublishing && publishAction === "publish" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                {isPublishing && publishAction === "publish"
                  ? `Publishing to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? "s" : ""}...`
                  : "Publish Now"}
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={isPublishing || !hasContent}
                className="flex-1 sm:flex-none h-10"
              >
                {isPublishing && publishAction === "draft" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="w-4 h-4 mr-1.5" />
                )}
                Save as Draft
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (showSchedulePicker && scheduleDate && scheduleTime) {
                    handleSubmit("schedule");
                  } else {
                    setShowSchedulePicker(true);
                  }
                }}
                disabled={isPublishing || !hasContent}
                className={`flex-1 sm:flex-none h-10 ${showSchedulePicker ? "border-blue-500/40 text-blue-600 hover:bg-blue-500/10" : ""}`}
              >
                {isPublishing && publishAction === "schedule" ? (
                  <AISpinner className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Clock className="w-4 h-4 mr-1.5" />
                )}
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

        </div>

        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-brand-500" />
                Post preview
              </DialogTitle>
              <DialogDescription>
                Check how the draft reads before you publish or schedule it.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                  F
                </div>
                <div>
                  <p className="text-sm font-semibold">FlowSmartly</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedExternalCount > 0 ? `${selectedExternalCount} external channel${selectedExternalCount === 1 ? "" : "s"}` : "Internal feed"}
                  </p>
                </div>
              </div>
              <p className="mt-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                {captionPreview}
              </p>
              {mediaUrls.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {mediaUrls.slice(0, 4).map((url, index) => (
                    <div key={`${url}-${index}`} className="aspect-square overflow-hidden rounded-xl border bg-muted">
                      {isVideoUrl(url) ? (
                        <div className="flex h-full items-center justify-center bg-foreground/10">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showAIPilotModal} onOpenChange={setShowAIPilotModal}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Pilot
              </DialogTitle>
              <DialogDescription>
                Generate or refine the caption without crowding the composer.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CHARS))}
                placeholder="Share your idea, audience, and goal..."
                className="min-h-[140px] w-full resize-y rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateIdea}
                  disabled={isGeneratingIdea}
                >
                  {isGeneratingIdea ? (
                    <AISpinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate
                </Button>
                <AIIdeasHistory
                  contentType="post_ideas"
                  mode="single"
                  onSelect={(idea) => setCaption(idea)}
                />
              </div>
              {isGeneratingIdea && (
                <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-4">
                  <AIGenerationLoader
                    compact
                    currentStep="Generating post idea..."
                    subtitle="Using your brand identity"
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showReadinessModal} onOpenChange={setShowReadinessModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Post readiness
              </DialogTitle>
              <DialogDescription>
                Quick publishing checks for message, media, channel, and timing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  {item.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* ─── PUBLISHING OVERLAY ───────────────────────────────────── */}
        <AnimatePresence>
          {isPublishing && publishAction === "publish" && selectedPlatforms.filter((p) => p !== "feed").length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="border-brand-500/30 bg-brand-500/5">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <AISpinner className="w-5 h-5 animate-spin text-brand-500" />
                    <span className="text-sm font-medium">Publishing to your platforms...</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlatforms.map((platformId) => {
                      const meta = PLATFORM_META[platformId];
                      if (!meta) return null;
                      const Icon = meta.icon;
                      return (
                        <div
                          key={platformId}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background border text-xs font-medium"
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {meta.label}
                          <AISpinner className="w-3 h-3 animate-spin text-muted-foreground ml-0.5" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── PUBLISH RESULTS MODAL ──────────────────────────────────── */}
        <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {Object.values(publishResults).every((r) => r.success) ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : Object.values(publishResults).some((r) => r.success) ? (
                  <RefreshCw className="w-5 h-5 text-yellow-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                Publish Results
              </DialogTitle>
              <DialogDescription>
                {(() => {
                  const total = Object.keys(publishResults).length;
                  const succeeded = Object.values(publishResults).filter((r) => r.success).length;
                  const failed = total - succeeded;
                  if (failed === 0) return "Successfully published to all platforms!";
                  if (succeeded === 0) return "Publishing failed on all platforms.";
                  return `Published to ${succeeded} of ${total} platforms. ${failed} failed.`;
                })()}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 mt-2">
              {Object.entries(publishResults).map(([platformId, result]) => {
                const meta = PLATFORM_META[platformId];
                if (!meta) return null;
                const Icon = meta.icon;
                const isRetrying = retryingPlatforms.includes(platformId);

                return (
                  <div
                    key={platformId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success
                        ? "border-green-500/20 bg-green-500/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${result.success ? "text-green-600" : "text-red-500"}`} />
                      <span className="text-sm font-medium">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRetrying ? (
                        <AISpinner className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : result.success ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-red-500 max-w-[180px] truncate">
                            {result.error || "Failed"}
                          </span>
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Retry failed + Close buttons */}
            <div className="flex items-center gap-2 mt-4">
              {Object.values(publishResults).some((r) => !r.success) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                  onClick={handleRetryFailed}
                  disabled={retryingPlatforms.length > 0}
                >
                  {retryingPlatforms.length > 0 ? (
                    <AISpinner className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Retry Failed
                </Button>
              )}
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => setShowResultsModal(false)}
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </motion.div>
    </TooltipProvider>
  );
}
