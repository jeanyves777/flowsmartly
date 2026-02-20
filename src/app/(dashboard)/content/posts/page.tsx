"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Image as ImageIcon,
  FolderOpen,
  X,
  Loader2,
  Send,
  CalendarDays,
  FileEdit,
  PenSquare,
  Save,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useCreditCosts } from "@/hooks/use-credit-costs";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
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

const MAX_CHARS = 2000;

export default function ContentPostsPage() {
  const { toast } = useToast();
  const { costs } = useCreditCosts("AI_POST");
  const { isConnected } = useSocialPlatforms();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build dynamic platform list from DB connections
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
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishAction, setPublishAction] = useState<"publish" | "draft" | "schedule" | null>(null);
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

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
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      if (removed?.file) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  };

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
    if (!caption.trim() && mediaAttachments.length === 0) {
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
        const messages = {
          publish: { title: "Post published!", description: "Your post is now live." },
          draft: { title: "Draft saved", description: "Your post has been saved as a draft." },
          schedule: { title: "Post scheduled", description: `Scheduled for ${scheduleDate} at ${scheduleTime}.` },
        };
        toast(messages[action]);

        // Reset composer
        setCaption("");
        setMediaAttachments([]);
        setShowSchedulePicker(false);
        setScheduleDate("");
        setScheduleTime("");
      } else {
        throw new Error(data.error || "Failed to save post");
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

  const hasContent = caption.trim().length > 0 || mediaAttachments.length > 0;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* ─── PAGE HEADER ──────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center">
              <PenSquare className="w-4 h-4 text-white" />
            </div>
            Create Post
          </h1>
        </div>

        {/* ─── POST COMPOSER ────────────────────────────────────────── */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            {/* AI Idea + History above textarea */}
            <div className="flex items-center justify-between">
              <Label className="font-semibold">What&apos;s on your mind?</Label>
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
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
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

            {/* Action Bar: Upload + Library */}
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

            {/* Publish to Platforms */}
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
                        <TooltipContent>Connect {platform.label} in Settings</TooltipContent>
                      </Tooltip>
                    );
                  }

                  return (
                    <Tooltip key={platform.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (platform.id === "feed") return;
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
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="w-4 h-4 mr-1.5" />
                )}
                Publish Now
              </Button>

              <Button
                variant="outline"
                onClick={() => handleSubmit("draft")}
                disabled={isPublishing || !hasContent}
                className="flex-1 sm:flex-none h-10"
              >
                {isPublishing && publishAction === "draft" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
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
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Clock className="w-4 h-4 mr-1.5" />
                )}
                Schedule
              </Button>
            </div>
          </CardContent>
        </Card>

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
