"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Share2, Check, LinkIcon, X, ImageIcon, Plus, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { PLATFORM_META, PLATFORM_ORDER } from "@/components/shared/social-platform-icons";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PostSharePanelProps {
  /** Single media URL (legacy — use mediaUrls for multiple) */
  mediaUrl?: string;
  /** Multiple media URLs (preferred) */
  mediaUrls?: string[];
  mediaType: "image" | "video";
  prompt: string;
}

const TONES = [
  { id: "casual", label: "Casual" },
  { id: "professional", label: "Professional" },
  { id: "humorous", label: "Humorous" },
  { id: "inspirational", label: "Inspirational" },
] as const;

const MAX_MEDIA = 10;

// ─── Component ──────────────────────────────────────────────────────────────

export function PostSharePanel({ mediaUrl, mediaUrls: initialMediaUrls, mediaType, prompt }: PostSharePanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isConnected } = useSocialPlatforms();

  // Merge legacy single URL with array prop
  const initialUrls = initialMediaUrls ?? (mediaUrl ? [mediaUrl] : []);

  // State
  const [mediaUrls, setMediaUrls] = useState<string[]>(initialUrls);
  const [caption, setCaption] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["feed"]);
  const [selectedTone, setSelectedTone] = useState("casual");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isUploadingMore, setIsUploadingMore] = useState(false);

  // Build the platform list with enabled/disabled state
  const platforms = useMemo(() => {
    return PLATFORM_ORDER
      .filter((id) => PLATFORM_META[id])
      .map((id) => ({
        id,
        ...PLATFORM_META[id],
        enabled: id === "feed" || isConnected(id),
      }));
  }, [isConnected]);

  const togglePlatform = (platformId: string) => {
    if (platformId === "feed") return; // Feed is always selected
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  // ─── Media Management ─────────────────────────────────────────────────

  const removeMedia = useCallback((url: string) => {
    setMediaUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const remaining = MAX_MEDIA - mediaUrls.length;
    if (remaining <= 0) {
      toast({ title: "Limit reached", description: `Maximum ${MAX_MEDIA} files allowed` });
      return;
    }

    const toUpload = fileArray.slice(0, remaining);
    setIsUploadingMore(true);

    const uploaded: string[] = [];
    for (const file of toUpload) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body: formData });
        const data = await res.json();
        if (data.success && data.data?.file?.url) {
          uploaded.push(data.data.file.url);
        }
      } catch {
        // skip failed uploads
      }
    }

    setIsUploadingMore(false);

    if (uploaded.length > 0) {
      setMediaUrls((prev) => [...prev, ...uploaded]);
    } else {
      toast({ title: "Upload failed", description: "Could not upload the file(s)", variant: "destructive" });
    }
  }, [mediaUrls.length, toast]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUploadFiles(e.target.files);
      e.target.value = "";
    }
  }, [handleUploadFiles]);

  // ─── AI Caption Generation ──────────────────────────────────────────────

  const handleGenerateCaption = async () => {
    if (isGeneratingCaption) return;
    setIsGeneratingCaption(true);

    try {
      // Caption API doesn't accept "feed" — filter it out, fallback to "instagram"
      const captionPlatforms = selectedPlatforms.filter((p) => p !== "feed");
      if (captionPlatforms.length === 0) captionPlatforms.push("instagram");

      const res = await fetch("/api/ai/generate/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platforms: captionPlatforms,
          mediaType,
          mediaDescription: prompt,
          tone: selectedTone,
          length: "medium",
          includeHashtags: true,
          includeEmojis: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCaption(data.data.content);
        if (data.data.creditsRemaining !== undefined) {
          emitCreditsUpdate(data.data.creditsRemaining);
        }
      } else {
        throw new Error(data.error?.message || "Failed to generate caption");
      }
    } catch (error) {
      toast({
        title: "Caption generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  // ─── Publish ────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!caption.trim() || isPublishing || mediaUrls.length === 0) return;
    setIsPublishing(true);

    try {
      const res = await fetch("/api/content/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: caption.trim(),
          mediaUrls,
          mediaType,
          platforms: selectedPlatforms,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPublishSuccess(true);
        toast({
          title: "Published successfully!",
          description: "Your post is now live.",
        });
        setTimeout(() => {
          router.push("/feed");
        }, 1500);
      } else {
        throw new Error(data.error?.message || "Failed to publish");
      }
    } catch (error) {
      toast({
        title: "Publishing failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsPublishing(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  const canAddMore = mediaUrls.length < MAX_MEDIA;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
    >
      <Card className="rounded-2xl overflow-hidden border-brand-500/20">
        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-brand-500 to-purple-500" />

        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            Share to Feed & Social
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <AnimatePresence mode="wait">
            {isPublishing ? (
              /* ── Publishing State ── */
              <motion.div
                key="publishing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AIGenerationLoader
                  compact
                  currentStep="Publishing to your platforms..."
                  subtitle="Almost there"
                />
              </motion.div>
            ) : publishSuccess ? (
              /* ── Success State ── */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <motion.div
                  className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <Check className="w-8 h-8 text-green-500" />
                </motion.div>
                <p className="text-lg font-semibold">Published!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your feed...</p>
              </motion.div>
            ) : (
              /* ── Compose State ── */
              <motion.div
                key="compose"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* 0. Media Preview + Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Media</Label>
                  <div className="flex flex-wrap gap-2">
                    {mediaUrls.map((url, idx) => (
                      <div
                        key={`${url}-${idx}`}
                        className="relative w-20 h-20 rounded-lg border overflow-hidden group bg-muted/30"
                      >
                        {mediaType === "video" ? (
                          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white/70">VIDEO</span>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Media ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          onClick={() => removeMedia(url)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {/* Add more button */}
                    {canAddMore && (
                      <label className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-brand-500/50 hover:bg-muted/50 transition-colors">
                        {isUploadingMore ? (
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[9px] text-muted-foreground mt-0.5">Add</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/webm"
                          multiple
                          className="hidden"
                          onChange={handleFileInputChange}
                          disabled={isUploadingMore}
                        />
                      </label>
                    )}
                  </div>

                  {mediaUrls.length === 0 && (
                    <p className="text-xs text-muted-foreground">No media attached. Upload at least one image or video.</p>
                  )}
                </div>

                {/* 1. Caption */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Caption</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateCaption}
                      disabled={isGeneratingCaption}
                      className="gap-1.5 text-xs"
                    >
                      {isGeneratingCaption ? (
                        <AISpinner className="w-3.5 h-3.5" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {isGeneratingCaption ? "Generating..." : "AI Generate"}
                    </Button>
                  </div>

                  {/* Tone selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Tone:</span>
                    {TONES.map((tone) => (
                      <button
                        key={tone.id}
                        onClick={() => setSelectedTone(tone.id)}
                        className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                          selectedTone === tone.id
                            ? "bg-brand-500 text-white"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        }`}
                      >
                        {tone.label}
                      </button>
                    ))}
                  </div>

                  {/* Textarea with loading overlay */}
                  <div className="relative">
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Write a caption for your post, or click AI Generate to create one automatically..."
                      rows={4}
                      maxLength={2000}
                      className={`w-full p-4 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all ${
                        isGeneratingCaption ? "opacity-40 pointer-events-none" : ""
                      }`}
                      disabled={isGeneratingCaption}
                    />
                    {isGeneratingCaption && (
                      <div className="absolute inset-0 z-10 rounded-xl overflow-hidden">
                        <AIGenerationLoader
                          compact
                          currentStep="Writing a caption for your post..."
                          subtitle="AI is crafting the perfect description"
                          className="h-full"
                        />
                      </div>
                    )}
                  </div>

                  {caption && (
                    <p className="text-xs text-muted-foreground text-right">
                      {caption.length} / 2,000
                    </p>
                  )}
                </div>

                {/* 2. Platform Selector */}
                <div className="space-y-2.5">
                  <Label className="text-sm font-semibold">Publish to</Label>
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {platforms.map((platform) => {
                        const Icon = platform.icon;
                        const isSelected = selectedPlatforms.includes(platform.id);
                        const isFeed = platform.id === "feed";
                        const isDisabled = !platform.enabled && !isFeed;

                        const button = (
                          <button
                            key={platform.id}
                            onClick={() => !isDisabled && togglePlatform(platform.id)}
                            disabled={isDisabled}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
                              isSelected
                                ? "bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400"
                                : isDisabled
                                ? "opacity-40 cursor-not-allowed border-border bg-muted/30"
                                : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                            } ${isFeed ? "cursor-default" : ""}`}
                          >
                            <Icon className="w-4 h-4" />
                            <span className="text-xs font-medium">{platform.label}</span>
                            {isSelected && (
                              <Check className="w-3 h-3 text-brand-500" />
                            )}
                            {isDisabled && (
                              <LinkIcon className="w-3 h-3" />
                            )}
                          </button>
                        );

                        if (isDisabled) {
                          return (
                            <Tooltip key={platform.id}>
                              <TooltipTrigger asChild>{button}</TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Connect {platform.label} in Settings</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return button;
                      })}
                    </div>
                  </TooltipProvider>

                  {selectedPlatforms.length > 1 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5">
                        {selectedPlatforms.length}
                      </Badge>
                      platforms selected
                    </p>
                  )}
                </div>

                {/* 3. Publish Button */}
                <Button
                  onClick={handlePublish}
                  disabled={!caption.trim() || mediaUrls.length === 0}
                  className="w-full bg-gradient-to-r from-brand-500 to-purple-600 hover:from-brand-600 hover:to-purple-700 h-12 rounded-2xl text-base font-semibold shadow-lg shadow-brand-500/20"
                  size="lg"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Publish Now
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
