"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import {
  Download,
  RefreshCw,
  Wand2,
  Zap,
  ChevronDown,
  PenLine,
  Layers,
  Eye,
  History,
  ShoppingBag,
  Megaphone,
  Film,
  Lightbulb,
  Award,
  MessageCircle,
  Clock,
  Monitor,
  Video,
  Sparkles,
  Upload,
  FolderOpen,
  X,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { PostSharePanel } from "@/components/shared/post-share-panel";
import {
  VIDEO_CATEGORIES,
  VIDEO_DURATIONS,
  VIDEO_STYLES,
  ASPECT_RATIO_OPTIONS,
  getExtensionCount,
  type VideoCategory,
  type AspectRatio,
  type DurationOption,
} from "@/lib/constants/video-presets";

// ─── CollapsibleSection component ───

function CollapsibleSection({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  summary?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        isOpen ? "border-brand-500/20 bg-card" : "border-border bg-card/50 hover:bg-card"
      }`}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isOpen ? "bg-brand-500/10" : "bg-muted"
          }`}
        >
          <Icon
            className={`w-4 h-4 ${isOpen ? "text-brand-500" : "text-muted-foreground"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold">{title}</span>
          {!isOpen && summary && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Icon map ───

const categoryIcons: Record<string, React.ElementType> = {
  product_ad: ShoppingBag,
  promo: Megaphone,
  social_reel: Film,
  explainer: Lightbulb,
  brand_intro: Award,
  testimonial: MessageCircle,
};

// ─── Types ───

interface GeneratedVideo {
  designId: string;
  url: string;
  duration: number;
  category: string;
  style: string;
  aspectRatio: string;
  resolution: string;
  prompt: string;
}

interface GalleryVideo {
  id: string;
  prompt: string;
  category: string;
  size: string;
  style: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  metadata: string;
}

// ─── Main Page ───

export default function VideoStudioPage() {
  // View state
  const [activeView, setActiveView] = useState<"create" | "gallery">("create");

  // Form state
  const [prompt, setPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<VideoCategory>("product_ad");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("16:9");
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(VIDEO_DURATIONS[2]); // Standard 8s
  const [selectedStyle, setSelectedStyle] = useState("cinematic");
  const [selectedResolution, setSelectedResolution] = useState<"480p" | "720p">("720p");
  const [selectedVoice, setSelectedVoice] = useState<string>("nova"); // For slideshow TTS
  const [selectedVoiceGender, setSelectedVoiceGender] = useState<"male" | "female">("female");
  const [selectedVoiceAccent, setSelectedVoiceAccent] = useState<string>("american");
  const [selectedProvider, setSelectedProvider] = useState<"veo3" | "slideshow">("veo3");

  // Reference image state
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);
  const [inputsCollapsed, setInputsCollapsed] = useState(false);

  // AI ideas state
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);

  // Data state
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [recentVideos, setRecentVideos] = useState<GalleryVideo[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  const { toast } = useToast();

  // Credit cost based on provider and duration (extended = multiplied)
  const baseCost = 500;
  const extCount = selectedProvider === "veo3" ? getExtensionCount(selectedDuration.seconds) : 0;
  const creditCost =
    selectedProvider === "slideshow" ? Math.round(baseCost * 2) :
    Math.round(baseCost * (1 + extCount));

  // Auto-lock resolution to 720p for extended Veo videos
  useEffect(() => {
    if (selectedProvider === "veo3" && selectedDuration.seconds > 8) {
      setSelectedResolution("720p");
    }
  }, [selectedProvider, selectedDuration]);

  // ─── Data fetching ───

  const fetchData = useCallback(async () => {
    try {
      setIsLoadingGallery(true);
      const [studioRes, designsRes, brandRes] = await Promise.all([
        fetch("/api/ai/studio"),
        fetch("/api/designs?limit=12"),
        fetch("/api/brand"),
      ]);

      if (studioRes.ok) {
        const studioData = await studioRes.json();
        setCreditsRemaining(studioData.data?.stats?.creditsRemaining || 0);
      }

      if (designsRes.ok) {
        const designsData = await designsRes.json();
        // API returns { success, data: { designs } } — need .data wrapper
        const allDesigns = designsData.data?.designs || designsData.designs || [];
        // Filter for video designs only
        const videoCategories = ["product_ad", "promo", "social_reel", "explainer", "brand_intro", "testimonial"];
        const videos = allDesigns.filter(
          (d: GalleryVideo) => {
            // Check category match AND that it's actually a video (via metadata)
            if (!videoCategories.includes(d.category) || d.status !== "COMPLETED") return false;
            try {
              const meta = JSON.parse(d.metadata || "{}");
              return meta.type === "video";
            } catch {
              return false;
            }
          }
        );
        setRecentVideos(videos);
      }

      if (brandRes.ok) {
        const brandData = await brandRes.json();
        if (brandData.success && brandData.data?.brandKit?.logo) {
          setBrandLogo(brandData.data.brandKit.logo);
        }
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── AI idea generation handler ───

  const handleGenerateIdeas = async () => {
    if (isGeneratingIdeas) return;

    setIsGeneratingIdeas(true);
    setAiIdeas([]);

    try {
      const response = await fetch("/api/ai/video-studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          style: selectedStyle,
          provider: selectedProvider,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to generate ideas" }));
        throw new Error(err.error || "Failed to generate ideas");
      }

      const data = await response.json();
      setAiIdeas(data.ideas || []);
      if (data.creditsRemaining !== undefined) {
        setCreditsRemaining(data.creditsRemaining);
        emitCreditsUpdate(data.creditsRemaining);
      }
    } catch (error) {
      toast({
        title: "Idea generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  // ─── Reference image upload handler ───

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only PNG, JPEG, and WebP images are supported.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
      return;
    }

    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "video-reference");

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json();

      if (data.success) {
        setReferenceImageUrl(data.data.url);
        toast({ title: "Image uploaded!" });
      } else {
        throw new Error(data.error?.message || "Upload failed");
      }
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // ─── Generate handler with SSE ───

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    // Slideshow requires voiceover narration
    if (selectedProvider === "slideshow" && selectedVoice === "none") {
      toast({
        title: "Voiceover required",
        description: "Slideshow mode requires voiceover narration. Please select a voice.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("Starting video generation...");
    setInputsCollapsed(true);
    setGeneratedVideo(null);

    try {
      const response = await fetch("/api/ai/video-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          category: selectedCategory,
          aspectRatio: selectedAspectRatio,
          duration: selectedProvider === "slideshow" ? 45 : selectedDuration.seconds,
          style: selectedStyle,
          resolution: selectedResolution,
          referenceImageUrl: referenceImageUrl || null,
          brandLogo: brandLogo || null,
          voiceOver: selectedProvider === "slideshow"
            ? (selectedVoice === "none" ? false : selectedVoice)
            : false, // Veo 3 uses native voice via prompt
          voiceGender: selectedProvider === "veo3" ? selectedVoiceGender : undefined,
          voiceAccent: selectedProvider === "veo3" ? selectedVoiceAccent : undefined,
          provider: selectedProvider,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Generation failed" }));
        throw new Error(err.error || "Generation failed");
      }

      // Consume SSE stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "status") {
              setGenerationStatus(event.message);
            } else if (event.type === "media") {
              setGeneratedVideo({
                designId: event.designId,
                url: event.mediaUrl,
                duration: event.duration,
                category: selectedCategory,
                style: selectedStyle,
                aspectRatio: selectedAspectRatio,
                resolution: selectedResolution,
                prompt: prompt.trim(),
              });
              setCreditsRemaining(event.creditsRemaining ?? creditsRemaining);
              emitCreditsUpdate(event.creditsRemaining ?? creditsRemaining);
              toast({
                title: "Video generated!",
                description: `${event.duration}s video created successfully.`,
              });
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Video generation failed";
      toast({ title: "Generation Failed", description: msg, variant: "destructive" });
      setGeneratedVideo(null);
    } finally {
      setIsGenerating(false);
      setGenerationStatus("");
    }
  };

  // ─── Summaries for collapsed sections ───

  const currentCategory = VIDEO_CATEGORIES.find((c) => c.id === selectedCategory);

  const videoTypeSummary = (
    <>
      <Badge variant="secondary" className="text-xs">
        {currentCategory?.name || selectedCategory}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {selectedAspectRatio}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {selectedProvider === "slideshow" ? "45s Slideshow" : selectedDuration.label}
      </Badge>
    </>
  );

  const styleSummary = (
    <>
      <Badge variant="secondary" className="text-xs capitalize">
        {selectedStyle}
      </Badge>
      <Badge variant="outline" className="text-xs">
        {selectedResolution}
      </Badge>
      <Badge variant="outline" className="text-xs capitalize">
        {selectedProvider === "veo3"
          ? `${selectedVoiceGender} · ${selectedVoiceAccent}`
          : selectedVoice === "none" ? "No voice" : `${selectedVoice} voice`}
      </Badge>
    </>
  );

  // ─── Render ───

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            Video Studio
          </h1>
          <p className="text-muted-foreground mt-2">
            Create product ads &amp; promotional videos with AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
            <Zap className="w-4 h-4 text-brand-500" />
            <span className="text-sm font-medium">
              {creditsRemaining} credits
            </span>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={activeView === "create" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("create")}
            >
              <Wand2 className="w-4 h-4 mr-1" />
              Create
            </Button>
            <Button
              variant={activeView === "gallery" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setActiveView("gallery");
                fetchData();
              }}
            >
              <History className="w-4 h-4 mr-1" />
              Gallery
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {activeView === "create" && (
          <div className="space-y-4">
            {/* Collapsed Summary Bar */}
            {inputsCollapsed && (generatedVideo || isGenerating) && (
              <Card className="border-brand-500/20 bg-brand-500/5 rounded-2xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                        {isGenerating ? (
                          <AISpinner className="w-4 h-4 text-brand-500" />
                        ) : (
                          <Video className="w-4 h-4 text-brand-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {isGenerating ? generationStatus : prompt || "Video prompt"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {currentCategory?.name}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {selectedAspectRatio}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {selectedProvider === "slideshow" ? "45s Slideshow" : selectedDuration.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs capitalize">
                            {selectedStyle}
                          </Badge>
                          {referenceImageUrl && (
                            <Badge className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20 gap-1">
                              <ImageIcon className="w-3 h-3" />
                              Product Image
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInputsCollapsed(false)}
                      disabled={isGenerating}
                      className="shrink-0"
                    >
                      <PenLine className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                      <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input Form */}
            {!inputsCollapsed && (
              <>
                {/* Provider Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedProvider("veo3")}
                    className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      selectedProvider === "veo3"
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border bg-card/50 hover:bg-card"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selectedProvider === "veo3" ? "bg-brand-500/10" : "bg-muted"
                    }`}>
                      <Video className={`w-5 h-5 ${selectedProvider === "veo3" ? "text-brand-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Veo 3</p>
                      <p className="text-xs text-muted-foreground">Google &middot; Up to 8s &middot; Native voice &amp; audio</p>
                    </div>
                    {selectedProvider === "veo3" && (
                      <Badge className="absolute top-2 right-2 text-[10px] bg-brand-500 text-white">{baseCost}</Badge>
                    )}
                  </button>
                  <button
                    onClick={() => setSelectedProvider("slideshow")}
                    className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                      selectedProvider === "slideshow"
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-border bg-card/50 hover:bg-card"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      selectedProvider === "slideshow" ? "bg-emerald-500/10" : "bg-muted"
                    }`}>
                      <Sparkles className={`w-5 h-5 ${selectedProvider === "slideshow" ? "text-emerald-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold">Slideshow</p>
                      <p className="text-xs text-muted-foreground">AI Images &middot; Up to 45s &middot; Narrated</p>
                    </div>
                    {selectedProvider === "slideshow" && (
                      <Badge className="absolute top-2 right-2 text-[10px] bg-emerald-500 text-white">{Math.round(baseCost * 2)}</Badge>
                    )}
                  </button>
                </div>

                {/* Prompt Card */}
                <Card className="rounded-2xl border-brand-500/10 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-brand-500" />
                        <Label className="text-base font-semibold">Describe Your Video</Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AIIdeasHistory contentType="video_ideas" onSelect={(idea) => setPrompt(idea)} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateIdeas}
                          disabled={isGeneratingIdeas || isGenerating}
                          className="gap-1.5 text-xs"
                        >
                          {isGeneratingIdeas ? (
                            <AISpinner className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {isGeneratingIdeas ? "Generating..." : "AI Ideas"}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">5</Badge>
                        </Button>
                      </div>
                    </div>
                    <div className="relative">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="E.g., 20% off all burgers this weekend — show a juicy double cheeseburger with fries, happy customers at the restaurant..."
                        className={`w-full min-h-[100px] p-4 rounded-xl border bg-background text-sm resize-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all ${
                          isGeneratingIdeas ? "opacity-40 pointer-events-none" : ""
                        }`}
                        disabled={isGeneratingIdeas}
                      />
                      {isGeneratingIdeas && (
                        <div className="absolute inset-0 z-10 rounded-xl overflow-hidden">
                          <AIGenerationLoader
                            compact
                            currentStep="Generating ideas for your brand..."
                            subtitle="AI is crafting personalized suggestions"
                            className="h-full"
                          />
                        </div>
                      )}
                    </div>
                    {/* AI-generated ideas */}
                    {aiIdeas.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-brand-500" />
                          AI Suggestions for your brand
                        </p>
                        <div className="flex flex-col gap-2">
                          {aiIdeas.map((idea, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setPrompt(idea);
                                setAiIdeas([]);
                              }}
                              className="text-left text-xs p-3 rounded-xl bg-brand-500/5 border border-brand-500/10 hover:bg-brand-500/10 hover:border-brand-500/20 text-foreground transition-all"
                            >
                              {idea}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Hint to use AI Ideas */}
                    {aiIdeas.length === 0 && !prompt && (
                      <p className="text-xs text-muted-foreground">
                        Describe your ad concept, promotion, or product — or click <strong>AI Ideas</strong> above to get personalized suggestions based on your brand.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Product / Reference Image */}
                <Card className="rounded-2xl border-border bg-card/50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                      <Label className="text-base font-semibold">Product Image</Label>
                      <span className="text-xs text-muted-foreground">(optional)</span>
                    </div>

                    {referenceImageUrl ? (
                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden border bg-muted shrink-0">
                          <Image
                            src={referenceImageUrl}
                            alt="Product reference"
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground mb-2">
                            Your product image will be animated into the video.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => imageInputRef.current?.click()}
                            >
                              <Upload className="w-3.5 h-3.5 mr-1.5" />
                              Replace
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMediaLibrary(true)}
                            >
                              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                              Library
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReferenceImageUrl(null)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="w-3.5 h-3.5 mr-1.5" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div
                          className="w-full sm:w-auto flex-1 flex items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-brand-500/30 hover:bg-brand-500/5 cursor-pointer transition-all"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          {isUploadingImage ? (
                            <AISpinner className="w-5 h-5 text-brand-500" />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {isUploadingImage ? "Uploading..." : "Upload product image"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">or</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowMediaLibrary(true)}
                          className="shrink-0"
                        >
                          <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
                          From Library
                        </Button>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </CardContent>
                </Card>

                {/* Media Library Picker */}
                <MediaLibraryPicker
                  open={showMediaLibrary}
                  onClose={() => setShowMediaLibrary(false)}
                  onSelect={(url) => {
                    setReferenceImageUrl(url);
                    setShowMediaLibrary(false);
                    toast({ title: "Image selected from library" });
                  }}
                  title="Select Product Image"
                  filterTypes={["image"]}
                />

                {/* Section 1: Video Type & Format */}
                <CollapsibleSection
                  title="Video Type & Format"
                  icon={Layers}
                  summary={videoTypeSummary}
                  defaultOpen={true}
                >
                  <div className="space-y-5">
                    {/* Category */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Category</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                        {VIDEO_CATEGORIES.map((cat) => {
                          const CatIcon = categoryIcons[cat.id] || Video;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setSelectedCategory(cat.id)}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                selectedCategory === cat.id
                                  ? "border-brand-500 bg-brand-500/5"
                                  : "border-transparent bg-muted/50 hover:bg-muted"
                              }`}
                            >
                              <CatIcon
                                className={`w-4 h-4 shrink-0 ${
                                  selectedCategory === cat.id
                                    ? "text-brand-500"
                                    : "text-muted-foreground"
                                }`}
                              />
                              <span className="text-sm font-medium truncate">{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Aspect Ratio</Label>
                      <div className="flex flex-wrap gap-2">
                        {ASPECT_RATIO_OPTIONS
                          .filter((ar) => selectedProvider === "slideshow" || ar.id !== "1:1")
                          .map((ar) => (
                          <button
                            key={ar.id}
                            onClick={() => setSelectedAspectRatio(ar.id)}
                            className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
                              selectedAspectRatio === ar.id
                                ? "bg-brand-500 text-white"
                                : "bg-muted hover:bg-muted/80"
                            }`}
                          >
                            <span className="font-medium">{ar.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                      {selectedProvider === "slideshow" ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 w-fit">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">45s (fixed for slideshow)</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Base durations (single generation) */}
                          <div className="flex flex-wrap gap-2">
                            {VIDEO_DURATIONS.filter((d) => d.seconds <= 8).map((dur) => (
                              <button
                                key={dur.id}
                                onClick={() => setSelectedDuration(dur)}
                                className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
                                  selectedDuration.id === dur.id
                                    ? "bg-brand-500 text-white"
                                    : "bg-muted hover:bg-muted/80"
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span className="font-medium">{dur.label}</span>
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Extended durations (with video extension) */}
                          <div className="space-y-2">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Extended (via AI extension)</span>
                            <div className="flex flex-wrap gap-2">
                              {VIDEO_DURATIONS.filter((d) => d.seconds > 8).map((dur) => {
                                const extCount = getExtensionCount(dur.seconds);
                                const multiplier = 1 + extCount;
                                return (
                                  <button
                                    key={dur.id}
                                    onClick={() => setSelectedDuration(dur)}
                                    className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
                                      selectedDuration.id === dur.id
                                        ? "bg-brand-500 text-white"
                                        : "bg-muted hover:bg-muted/80"
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span className="font-medium">{dur.label}</span>
                                      <span className={`text-[10px] ${selectedDuration.id === dur.id ? "text-white/70" : "text-muted-foreground/60"}`}>
                                        {multiplier}x
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Info note for extended durations */}
                          {selectedDuration.seconds > 8 && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                              <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              <span>
                                Extended videos chain {getExtensionCount(selectedDuration.seconds)} AI extensions (+7s each). Resolution locked to 720p. Uses {1 + getExtensionCount(selectedDuration.seconds)}x credits.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Section 2: Style & Quality */}
                <CollapsibleSection
                  title="Style & Quality"
                  icon={Eye}
                  summary={styleSummary}
                  defaultOpen={false}
                >
                  <div className="space-y-5">
                    {/* Style */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Visual Style</Label>
                      <div className="flex flex-wrap gap-2">
                        {VIDEO_STYLES.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedStyle(s.id)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                              selectedStyle === s.id
                                ? "bg-brand-500 text-white"
                                : "bg-muted hover:bg-muted/80 text-foreground"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Resolution */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Resolution
                        {selectedProvider === "veo3" && selectedDuration.seconds > 8 && (
                          <span className="ml-1.5 text-[10px] text-amber-600 dark:text-amber-400 font-normal">(locked to 720p for extended)</span>
                        )}
                      </Label>
                      <div className="grid grid-cols-2 gap-2 max-w-xs">
                        {(["480p", "720p"] as const).map((res) => {
                          const isLocked = selectedProvider === "veo3" && selectedDuration.seconds > 8;
                          const isDisabled = isLocked && res !== "720p";
                          return (
                            <button
                              key={res}
                              onClick={() => !isDisabled && setSelectedResolution(res)}
                              disabled={isDisabled}
                              className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                                isDisabled
                                  ? "border-transparent bg-muted/30 opacity-40 cursor-not-allowed"
                                  : selectedResolution === res
                                    ? "border-brand-500 bg-brand-500/5"
                                    : "border-transparent bg-muted/50 hover:bg-muted"
                              }`}
                            >
                              <Monitor
                                className={`w-4 h-4 ${
                                  selectedResolution === res ? "text-brand-500" : "text-muted-foreground"
                                }`}
                              />
                              <span className="text-sm font-medium">{res === "720p" ? "HD 720p" : "SD 480p"}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Voice Settings */}
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">
                        {selectedProvider === "veo3" ? "Voice & Accent" : "Voiceover Narration"}
                      </Label>

                      {selectedProvider === "veo3" ? (
                        <>
                          {/* Gender */}
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "male" as const, label: "Male" },
                              { id: "female" as const, label: "Female" },
                            ].map((g) => (
                              <button
                                key={g.id}
                                onClick={() => setSelectedVoiceGender(g.id)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                  selectedVoiceGender === g.id
                                    ? "bg-brand-500 text-white"
                                    : "bg-muted hover:bg-muted/80 text-foreground"
                                }`}
                              >
                                {g.label}
                              </button>
                            ))}
                          </div>
                          {/* Accent */}
                          <Label className="text-xs font-medium text-muted-foreground mt-2 block">Accent</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "american", label: "American" },
                              { id: "british", label: "British" },
                              { id: "australian", label: "Australian" },
                              { id: "indian", label: "Indian" },
                              { id: "african_american", label: "African American" },
                              { id: "latin", label: "Latin" },
                              { id: "french", label: "French" },
                              { id: "middle_eastern", label: "Middle Eastern" },
                            ].map((a) => (
                              <button
                                key={a.id}
                                onClick={() => setSelectedVoiceAccent(a.id)}
                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                  selectedVoiceAccent === a.id
                                    ? "bg-brand-500 text-white"
                                    : "bg-muted hover:bg-muted/80 text-foreground"
                                }`}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Veo 3 generates native voice, sound effects &amp; music. Your voice and accent preference will be embedded in the video.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "nova", label: "Nova", desc: "Warm female" },
                              { id: "shimmer", label: "Shimmer", desc: "Bright female" },
                              { id: "onyx", label: "Onyx", desc: "Deep male" },
                              { id: "fable", label: "Fable", desc: "British male" },
                              { id: "alloy", label: "Alloy", desc: "Neutral" },
                              { id: "echo", label: "Echo", desc: "Narrator" },
                              { id: "none", label: "No Voice", desc: "Music only" },
                            ].map((v) => (
                              <button
                                key={v.id}
                                onClick={() => setSelectedVoice(v.id)}
                                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                                  selectedVoice === v.id
                                    ? "bg-brand-500 text-white"
                                    : "bg-muted hover:bg-muted/80 text-foreground"
                                }`}
                                title={v.desc}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            AI writes an ad script and narrates it over the video{selectedVoice !== "none" ? ` with ${selectedVoice} voice` : ""}.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Generate Button */}
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 h-12 rounded-2xl text-base font-semibold"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <AISpinner className="w-5 h-5 mr-2" />
                        {generationStatus || "Generating Video..."}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        Generate Video
                        <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0 text-xs">
                          {creditCost} credits
                        </Badge>
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {/* Generated Video Preview */}
            {generatedVideo && (
              <Card className="rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-brand-500" />
                    Generated Video
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
                      Regenerate
                    </Button>
                    <a href={generatedVideo.url} download={`video-${generatedVideo.designId}.mp4`}>
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </a>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Video player */}
                  <div className="rounded-xl overflow-hidden bg-black">
                    <video
                      src={generatedVideo.url}
                      controls
                      autoPlay
                      className="w-full max-h-[500px] object-contain"
                    />
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {VIDEO_CATEGORIES.find((c) => c.id === generatedVideo.category)?.name}
                    </Badge>
                    <Badge variant="outline">{generatedVideo.aspectRatio}</Badge>
                    <Badge variant="outline">{generatedVideo.duration}s</Badge>
                    <Badge variant="outline">{generatedVideo.resolution}</Badge>
                    <Badge variant="outline" className="capitalize">{generatedVideo.style}</Badge>
                  </div>

                  {/* Prompt display */}
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Prompt</p>
                    <p className="text-sm">{generatedVideo.prompt}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Post to Feed / Social ─── */}
            {generatedVideo && (
              <PostSharePanel
                mediaUrl={generatedVideo.url}
                mediaType="video"
                prompt={generatedVideo.prompt}
              />
            )}

            {/* Generation Progress */}
            {isGenerating && !generatedVideo && (
              <Card className="rounded-2xl border-brand-500/20">
                <CardContent className="p-6">
                  <AIGenerationLoader
                    currentStep={generationStatus || "Starting video generation..."}
                    subtitle={selectedProvider === "veo3"
                      ? "Veo 3 is creating your video with native audio — this may take 2-4 minutes"
                      : "Generating slideshow with AI images and voiceover..."}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Gallery View */}
        {activeView === "gallery" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Recent Videos</h2>
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>

            {isLoadingGallery ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-2xl" />
                ))}
              </div>
            ) : recentVideos.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Video className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first video in the Create tab
                  </p>
                  <Button onClick={() => setActiveView("create")}>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Create Video
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentVideos.map((video) => {
                  let meta: { duration?: number; resolution?: string } = {};
                  try { meta = JSON.parse(video.metadata); } catch { /* ignore */ }

                  return (
                    <Card key={video.id} className="rounded-2xl overflow-hidden group">
                      <div className="relative bg-black aspect-video">
                        {video.imageUrl ? (
                          <video
                            src={video.imageUrl}
                            className="w-full h-full object-contain"
                            preload="metadata"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {video.imageUrl && (
                            <a href={video.imageUrl} download>
                              <Button size="sm" variant="secondary">
                                <Download className="w-3.5 h-3.5 mr-1" />
                                Download
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{video.prompt}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {VIDEO_CATEGORIES.find((c) => c.id === video.category)?.name || video.category}
                          </Badge>
                          {meta.duration && (
                            <Badge variant="outline" className="text-xs">
                              {String(meta.duration)}s
                            </Badge>
                          )}
                          {meta.resolution && (
                            <Badge variant="outline" className="text-xs">
                              {String(meta.resolution)}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
