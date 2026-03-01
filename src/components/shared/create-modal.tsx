"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  Image as ImageIcon,
  Megaphone,
  FileText,
  Presentation,
  PanelTop,
  Signpost,
  User,
  Package,
  Type,
  Palette,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Zap,
  Layers,
  X,
  Film,
  Video,
  Download,
  ExternalLink,
  Play,
  Clock,
  Ratio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { MediaUploader } from "@/components/shared/media-uploader";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import {
  DESIGN_CATEGORIES,
  DESIGN_STYLES,
  getProvidersForPreset,
  type DesignCategory,
  type ImageProvider,
  type SizePreset,
} from "@/lib/constants/design-presets";
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

// ── Global Store (same pattern as credit-purchase-modal) ──────────────────

interface CreateModalState {
  open: boolean;
  defaultTab: "image" | "video";
}

const defaultState: CreateModalState = {
  open: false,
  defaultTab: "image",
};

let state: CreateModalState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openCreateModal(tab?: "image" | "video") {
  state = { open: true, defaultTab: tab || "image" };
  emit();
}

export function closeCreateModal() {
  state = { ...defaultState };
  emit();
}

// ── Shared Types ──────────────────────────────────────────────────────────

interface SocialHandles {
  instagram?: string;
  twitter?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}

interface BrandIdentity {
  id: string;
  name: string;
  logo: string | null;
  iconLogo: string | null;
  colors: Record<string, string>;
  voiceTone: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  handles: SocialHandles;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const categoryIcons: Record<string, React.ElementType> = {
  social_post: ImageIcon,
  ad: Megaphone,
  flyer: FileText,
  poster: Presentation,
  banner: PanelTop,
  signboard: Signpost,
};

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
      >
        <Icon
          className={`w-4 h-4 ${isOpen ? "text-brand-500" : "text-muted-foreground"}`}
        />
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Video Providers ───────────────────────────────────────────────────────

const VIDEO_PROVIDERS = [
  { id: "veo3", label: "Veo 3", desc: "Google AI video", icon: Film },
  { id: "slideshow", label: "Slideshow", desc: "Image-based", icon: ImageIcon },
] as const;

type VideoProvider = (typeof VIDEO_PROVIDERS)[number]["id"];

// ── Main Component ────────────────────────────────────────────────────────

export function CreateModal() {
  const { open, defaultTab } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!open) return null;

  return <CreateModalInner defaultTab={defaultTab} />;
}

function CreateModalInner({ defaultTab }: { defaultTab: "image" | "video" }) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"image" | "video">(defaultTab);

  // ── Shared state ──
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity | null>(null);

  // ── Image tab state ──
  const [imageMode, setImageMode] = useState<"layout" | "image">("image");
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DesignCategory>("social_post");
  const [selectedSize, setSelectedSize] = useState<SizePreset | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ImageProvider>("xai");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [heroType, setHeroType] = useState<"people" | "product" | "text-only">("people");
  const [textMode, setTextMode] = useState<"exact" | "creative">("creative");
  const [ctaText, setCtaText] = useState("");
  const [exactImageUrls, setExactImageUrls] = useState<string[]>([]);
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);
  const [showBrandName, setShowBrandName] = useState(false);
  const [showSocialIcons, setShowSocialIcons] = useState(false);
  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<Set<string>>(new Set());
  const [logoType, setLogoType] = useState<"auto" | "icon" | "full">("auto");
  const [logoSizePercent, setLogoSizePercent] = useState(18);
  const [includeInDesign, setIncludeInDesign] = useState({ email: false, phone: false, website: false, address: false });
  const [generateHeroImage, setGenerateHeroImage] = useState(false);
  const [generateBackground, setGenerateBackground] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedDesignId, setGeneratedDesignId] = useState<string | null>(null);
  const [layoutGenerated, setLayoutGenerated] = useState(false);

  // ── Video tab state ──
  const [videoProvider, setVideoProvider] = useState<VideoProvider>("veo3");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoCategory, setVideoCategory] = useState<VideoCategory>("product_ad");
  const [videoAspectRatio, setVideoAspectRatio] = useState<AspectRatio>("16:9");
  const [videoDuration, setVideoDuration] = useState<DurationOption>(VIDEO_DURATIONS[2]);
  const [videoStyle, setVideoStyle] = useState("cinematic");
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenStatus, setVideoGenStatus] = useState("");
  const [videoGenProgress, setVideoGenProgress] = useState<number | undefined>(undefined);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  // ── Credit costs ──
  const [designCreditCost, setDesignCreditCost] = useState(15);
  const [layoutCreditCost, setLayoutCreditCost] = useState(5);
  const [layoutImageCost, setLayoutImageCost] = useState(15);

  // Auto-select first compatible preset
  useEffect(() => {
    const cat = DESIGN_CATEGORIES.find((c) => c.id === selectedCategory);
    if (cat && cat.presets.length > 0) {
      const compatible = cat.presets.find((p) =>
        getProvidersForPreset(p.width, p.height).includes(selectedProvider)
      );
      setSelectedSize(compatible || cat.presets[0]);
    }
  }, [selectedCategory, selectedProvider]);

  // Fetch brand data + credits on mount
  useEffect(() => {
    (async () => {
      try {
        const [brandRes, costsRes, studioRes] = await Promise.all([
          fetch("/api/brand"),
          fetch("/api/credits/costs?keys=AI_VISUAL_DESIGN,AI_DESIGN_LAYOUT,AI_DESIGN_LAYOUT_IMAGE"),
          fetch("/api/ai/studio"),
        ]);
        const brandData = await brandRes.json();
        const costsData = await costsRes.json();
        const studioData = await studioRes.json();

        if (brandData.success && brandData.data?.brandKit) {
          const kit = brandData.data.brandKit;
          const parsedHandles =
            typeof kit.handles === "string"
              ? JSON.parse(kit.handles || "{}")
              : kit.handles || {};
          setBrandIdentity({
            id: kit.id,
            name: kit.name,
            logo: kit.logo || null,
            iconLogo: kit.iconLogo || null,
            colors: typeof kit.colors === "string" ? JSON.parse(kit.colors) : kit.colors,
            voiceTone: kit.voiceTone,
            email: kit.email || null,
            phone: kit.phone || null,
            website: kit.website || null,
            address: kit.address || null,
            handles: parsedHandles,
          });
          const platformsWithHandles = Object.keys(parsedHandles).filter(
            (k: string) => parsedHandles[k]
          );
          if (platformsWithHandles.length > 0)
            setSelectedSocialPlatforms(new Set(platformsWithHandles));
        }
        if (costsData.success && costsData.data?.costs?.AI_VISUAL_DESIGN)
          setDesignCreditCost(costsData.data.costs.AI_VISUAL_DESIGN);
        if (costsData.success && costsData.data?.costs?.AI_DESIGN_LAYOUT)
          setLayoutCreditCost(costsData.data.costs.AI_DESIGN_LAYOUT);
        if (costsData.success && costsData.data?.costs?.AI_DESIGN_LAYOUT_IMAGE)
          setLayoutImageCost(costsData.data.costs.AI_DESIGN_LAYOUT_IMAGE);
        if (studioData.success)
          setCreditsRemaining(studioData.data?.stats?.creditsRemaining ?? 0);
      } catch {
        /* silently */
      }
    })();
  }, []);

  // ── Image: Generate Ideas ──
  const handleGenerateIdeas = useCallback(async () => {
    if (isGeneratingIdeas) return;
    setIsGeneratingIdeas(true);
    setAiIdeas([]);
    try {
      const res = await fetch("/api/ai/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedCategory, style: selectedStyle }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (handleCreditError(err.error || {}, "AI ideas")) return;
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      setAiIdeas(data.ideas || []);
      if (data.creditsRemaining !== undefined) {
        setCreditsRemaining(data.creditsRemaining);
        emitCreditsUpdate(data.creditsRemaining);
      }
    } catch (e) {
      toast({ title: "Idea generation failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setIsGeneratingIdeas(false);
    }
  }, [isGeneratingIdeas, selectedCategory, selectedStyle, toast]);

  // ── Image: Generate Design ──
  const handleGenerateImage = useCallback(async () => {
    if (!imagePrompt.trim()) {
      toast({ title: "Please describe what you want to create", variant: "destructive" });
      return;
    }
    if (!selectedSize) {
      toast({ title: "Please select a size", variant: "destructive" });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    setGeneratedDesignId(null);
    setLayoutGenerated(false);

    try {
      const socialHandles: Record<string, string> = {};
      if (showSocialIcons && brandIdentity?.handles) {
        selectedSocialPlatforms.forEach((p) => {
          const h = brandIdentity.handles[p as keyof SocialHandles];
          if (h) socialHandles[p] = h;
        });
      }

      const contactInfo = {
        email: includeInDesign.email ? brandIdentity?.email : null,
        phone: includeInDesign.phone ? brandIdentity?.phone : null,
        website: includeInDesign.website ? brandIdentity?.website : null,
        address: includeInDesign.address ? brandIdentity?.address : null,
      };

      const brandLogo =
        logoType === "icon"
          ? brandIdentity?.iconLogo || brandIdentity?.logo
          : logoType === "full"
            ? brandIdentity?.logo || brandIdentity?.iconLogo
            : brandIdentity?.logo || brandIdentity?.iconLogo;

      if (imageMode === "layout") {
        const res = await fetch("/api/ai/design-layout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            category: selectedCategory,
            size: `${selectedSize.width}x${selectedSize.height}`,
            style: selectedStyle,
            heroType,
            textMode,
            ctaText: ctaText.trim() || null,
            brandColors: brandIdentity?.colors || null,
            brandName: showBrandName ? brandIdentity?.name : null,
            brandFonts: null,
            showBrandName,
            showSocialIcons,
            socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
            contactInfo,
            generateHeroImage,
            generateBackground,
            imageProvider: (generateHeroImage || generateBackground) ? selectedProvider : undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (handleCreditError(data.error || {}, "smart layout")) return;
          throw new Error(data.error?.message || "Layout generation failed");
        }

        if (data.data?.creditsRemaining !== undefined) {
          setCreditsRemaining(data.data.creditsRemaining);
          emitCreditsUpdate(data.data.creditsRemaining);
        }

        setLayoutGenerated(true);
        // Store layout data for "Open in Studio"
        if (data.data?.layout) {
          try {
            sessionStorage.setItem("create-modal-layout", JSON.stringify({
              layout: data.data.layout,
              size: data.data.size || `${selectedSize.width}x${selectedSize.height}`,
              brandLogoUrl: brandLogo || null,
            }));
          } catch { /* ignore */ }
        }
        toast({ title: "Smart layout generated!" });
      } else {
        const res = await fetch("/api/ai/visual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            category: selectedCategory,
            size: `${selectedSize.width}x${selectedSize.height}`,
            style: selectedStyle,
            provider: selectedProvider,
            heroType,
            textMode,
            brandColors: brandIdentity?.colors || null,
            brandLogo,
            logoSizePercent,
            brandName: showBrandName ? brandIdentity?.name : null,
            showBrandName,
            showSocialIcons,
            socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
            contactInfo,
            ctaText: ctaText.trim() || null,
            templateImageUrl: styleReferenceUrls[0] || null,
            referenceImageUrl: exactImageUrls[0] || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (handleCreditError(data.error || {}, "visual design")) return;
          throw new Error(data.error?.message || "Generation failed");
        }

        if (data.data?.creditsRemaining !== undefined) {
          setCreditsRemaining(data.data.creditsRemaining);
          emitCreditsUpdate(data.data.creditsRemaining);
        }

        if (data.data?.design?.imageUrl) {
          setGeneratedImageUrl(data.data.design.imageUrl);
          setGeneratedDesignId(data.data.design.id || null);
        }
        toast({ title: "Design generated!" });
      }
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setIsGeneratingImage(false);
    }
  }, [imagePrompt, selectedSize, imageMode, selectedCategory, selectedStyle, selectedProvider, heroType, textMode, ctaText, brandIdentity, showBrandName, showSocialIcons, selectedSocialPlatforms, includeInDesign, logoType, logoSizePercent, generateHeroImage, generateBackground, exactImageUrls, styleReferenceUrls, toast]);

  // ── Video: Generate ──
  const handleGenerateVideo = useCallback(async () => {
    if (!videoPrompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }

    setIsGeneratingVideo(true);
    setVideoGenStatus("Initializing...");
    setVideoGenProgress(undefined);
    setGeneratedVideoUrl(null);

    try {
      const res = await fetch("/api/ai/video-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: videoPrompt,
          category: videoCategory,
          aspectRatio: videoAspectRatio,
          duration: videoDuration.seconds,
          style: videoStyle,
          resolution: "720p",
          provider: videoProvider,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === "INSUFFICIENT_CREDITS" || err.error?.code === "INSUFFICIENT_CREDITS") {
          handleCreditError(err.error || err);
          return;
        }
        throw new Error(err.error?.message || err.error || "Generation failed");
      }

      // SSE streaming for progress
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let finalData: { url?: string; duration?: number } | null = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.status) setVideoGenStatus(data.status);
                  if (data.progress !== undefined) setVideoGenProgress(data.progress);
                  if (data.url) finalData = data;
                  if (data.creditsRemaining !== undefined) {
                    setCreditsRemaining(data.creditsRemaining);
                    emitCreditsUpdate(data.creditsRemaining);
                  }
                } catch { /* skip malformed lines */ }
              }
            }
          }
        }

        if (finalData?.url) {
          setGeneratedVideoUrl(finalData.url);
          toast({ title: "Video generated!" });
        }
      } else {
        const data = await res.json();
        const videoUrl = data.url || data.data?.url;
        if (videoUrl) {
          setGeneratedVideoUrl(videoUrl);
          toast({ title: "Video generated!" });
        }
        if (data.creditsRemaining !== undefined) {
          setCreditsRemaining(data.creditsRemaining);
          emitCreditsUpdate(data.creditsRemaining);
        }
      }
    } catch (err: unknown) {
      toast({ title: "Generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsGeneratingVideo(false);
      setVideoGenStatus("");
      setVideoGenProgress(undefined);
    }
  }, [videoPrompt, videoCategory, videoAspectRatio, videoDuration, videoStyle, videoProvider, toast]);

  // ── Download helpers ──
  const handleDownloadImage = useCallback(async () => {
    if (!generatedImageUrl) return;
    try {
      const proxyUrl = generatedImageUrl.startsWith("http") && typeof window !== "undefined" && !generatedImageUrl.startsWith(window.location.origin)
        ? `/api/image-proxy?url=${encodeURIComponent(generatedImageUrl)}`
        : generatedImageUrl;
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowsmartly-design-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }, [generatedImageUrl, toast]);

  const handleDownloadVideo = useCallback(async () => {
    if (!generatedVideoUrl) return;
    try {
      const res = await fetch(generatedVideoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowsmartly-video-${Date.now()}.mp4`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }, [generatedVideoUrl, toast]);

  const handleOpenInStudio = useCallback(() => {
    closeCreateModal();
    if (generatedDesignId) {
      router.push(`/studio?designId=${generatedDesignId}`);
    } else if (layoutGenerated) {
      router.push("/studio?applyLayout=session");
    } else {
      router.push("/studio");
    }
  }, [generatedDesignId, layoutGenerated, router]);

  const handleOpenInVideoEditor = useCallback(() => {
    closeCreateModal();
    if (generatedVideoUrl) {
      router.push(`/video-editor?videoUrl=${encodeURIComponent(generatedVideoUrl)}`);
    } else {
      router.push("/video-editor");
    }
  }, [generatedVideoUrl, router]);

  const handleClose = useCallback(() => {
    if (isGeneratingImage || isGeneratingVideo) return;
    closeCreateModal();
  }, [isGeneratingImage, isGeneratingVideo]);

  // Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  const isGenerating = isGeneratingImage || isGeneratingVideo;
  const currentCategory = DESIGN_CATEGORIES.find((c) => c.id === selectedCategory)!;

  const imageCreditCost = imageMode === "layout"
    ? layoutCreditCost + (generateHeroImage ? layoutImageCost : 0) + (generateBackground ? layoutImageCost : 0)
    : designCreditCost;

  const videoExtCount = videoProvider === "veo3" ? getExtensionCount(videoDuration.seconds) : 0;
  const videoCreditCost = videoProvider === "slideshow" ? 25 : Math.round(60 * (1 + videoExtCount));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-[95vw] max-w-6xl max-h-[90vh] bg-background rounded-xl shadow-2xl border flex flex-col overflow-hidden"
      >
        {/* ═══ Header ═══ */}
        <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setActiveTab("image")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "image"
                    ? "bg-background shadow-sm text-brand-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ImageIcon className="h-4 w-4" />
                Image
              </button>
              <button
                onClick={() => setActiveTab("video")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "video"
                    ? "bg-background shadow-sm text-brand-600"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Video className="h-4 w-4" />
                Video
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-default">
                    <Sparkles className="h-3 w-3 mr-1 text-violet-500" />
                    {creditsRemaining} credits
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Your remaining AI credits</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══ Body ═══ */}
        <div className="flex-1 flex min-h-0">
          {/* ─── Left: Form ─── */}
          <div className="w-[420px] shrink-0 border-r overflow-y-auto p-5 space-y-4">
            {activeTab === "image" ? (
              <>
                {/* Mode Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-muted">
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setImageMode("layout")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            imageMode === "layout"
                              ? "bg-background shadow-sm text-brand-600"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Layers className="h-3.5 w-3.5" />
                          Smart Layout
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{layoutCreditCost}+cr</Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Generates editable text, shapes & elements. Best for social media posts with custom text.</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setImageMode("image")}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                            imageMode === "image"
                              ? "bg-background shadow-sm text-brand-600"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          AI Image
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">{designCreditCost}cr</Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Generates a single flat image. Best for photorealistic or artistic designs.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-sm font-medium">Describe your design</Label>
                    <div className="flex items-center gap-1">
                      <AIIdeasHistory contentType="design_ideas" onSelect={(idea) => setImagePrompt(idea)} className="text-xs" />
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1" onClick={handleGenerateIdeas} disabled={isGeneratingIdeas}>
                        {isGeneratingIdeas ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                        Ideas
                      </Button>
                    </div>
                  </div>
                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder="e.g. A vibrant Instagram post announcing a new product launch with bold typography and colorful gradients"
                    className="w-full min-h-[100px] p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-background"
                  />
                  {aiIdeas.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {aiIdeas.map((idea, i) => (
                        <button key={i} onClick={() => { setImagePrompt(idea); setAiIdeas([]); }} className="w-full text-left p-2 text-xs rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-colors line-clamp-2">
                          {idea}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div>
                  <Label className="text-xs text-muted-foreground">Call to Action (optional)</Label>
                  <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder='e.g. "Shop Now", "Book Today"' className="h-8 text-sm mt-1" />
                </div>

                {/* Design Type & Size */}
                <CollapsibleSection title="Design Type & Size" icon={Layers} defaultOpen>
                  <div>
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {DESIGN_CATEGORIES.map((cat) => {
                        const CatIcon = categoryIcons[cat.id] || ImageIcon;
                        return (
                          <TooltipProvider key={cat.id} delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => setSelectedCategory(cat.id as DesignCategory)}
                                  className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs border transition-colors ${
                                    selectedCategory === cat.id
                                      ? "border-brand-500 bg-brand-500/10 text-brand-600"
                                      : "border-transparent hover:bg-muted"
                                  }`}
                                >
                                  <CatIcon className="h-4 w-4" />
                                  {cat.name.split(" ")[0]}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">{cat.description}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Size Preset</Label>
                    <div className="space-y-0.5 mt-1">
                      {currentCategory?.presets.map((preset) => {
                        const providers = getProvidersForPreset(preset.width, preset.height);
                        const compatible = imageMode === "layout" || providers.includes(selectedProvider);
                        return (
                          <button
                            key={preset.name}
                            onClick={() => setSelectedSize(preset)}
                            disabled={!compatible}
                            className={`w-full flex justify-between items-center px-3 py-1.5 rounded-lg text-xs transition-colors ${
                              selectedSize?.name === preset.name
                                ? "bg-brand-500/10 text-brand-600 border border-brand-500"
                                : compatible
                                  ? "hover:bg-muted border border-transparent"
                                  : "opacity-40 cursor-not-allowed border border-transparent"
                            }`}
                          >
                            <span>{preset.name}</span>
                            <span className="text-[11px] font-mono text-muted-foreground">{preset.width}x{preset.height}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Style & Appearance */}
                <CollapsibleSection title="Style & Appearance" icon={Palette}>
                  <div>
                    <Label className="text-xs text-muted-foreground">Visual Style</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {DESIGN_STYLES.map((style) => (
                        <Badge key={style.id} variant={selectedStyle === style.id ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setSelectedStyle(style.id)}>
                          {style.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Visual Focus</Label>
                    <div className="flex gap-1.5 mt-1">
                      {[
                        { id: "people" as const, icon: User, label: "People" },
                        { id: "product" as const, icon: Package, label: "Product" },
                        { id: "text-only" as const, icon: Type, label: "Text Only" },
                      ].map((h) => (
                        <button
                          key={h.id}
                          onClick={() => { setHeroType(h.id); if (h.id === "text-only") setGenerateHeroImage(false); }}
                          className={`flex-1 flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs transition-colors ${
                            heroType === h.id
                              ? "border-brand-500 bg-brand-500/10 text-brand-600"
                              : "border-border hover:border-brand-300"
                          }`}
                        >
                          <h.icon className="h-4 w-4" />
                          {h.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Text Mode</Label>
                    <div className="flex gap-1.5 mt-1">
                      <button onClick={() => setTextMode("creative")} className={`flex-1 p-2 rounded-lg border text-xs text-center transition-colors ${textMode === "creative" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-300"}`}>AI Creative</button>
                      <button onClick={() => setTextMode("exact")} className={`flex-1 p-2 rounded-lg border text-xs text-center transition-colors ${textMode === "exact" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-300"}`}>Use My Text</button>
                    </div>
                  </div>

                  {imageMode === "image" && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">Style Reference</Label>
                        <MediaUploader value={styleReferenceUrls} onChange={setStyleReferenceUrls} maxFiles={1} accept="image/*" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Exact Image</Label>
                        <MediaUploader value={exactImageUrls} onChange={setExactImageUrls} maxFiles={1} accept="image/*" />
                      </div>
                    </>
                  )}
                </CollapsibleSection>

                {/* AI Images (layout mode) */}
                {imageMode === "layout" && (
                  <CollapsibleSection title="AI Images" icon={ImageIcon}>
                    <div className="space-y-3">
                      <p className="text-[11px] text-muted-foreground">
                        Optionally generate AI images for your layout. Each image adds {layoutImageCost} credits.
                      </p>
                      <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={generateHeroImage} onChange={(e) => setGenerateHeroImage(e.target.checked)} className="accent-brand-500" disabled={heroType === "text-only"} />
                          <span className={heroType === "text-only" ? "text-muted-foreground" : ""}>Generate Hero Image</span>
                        </div>
                        {generateHeroImage && <Badge variant="secondary" className="text-[9px] px-1 py-0">+{layoutImageCost}cr</Badge>}
                      </label>
                      {heroType === "text-only" && (
                        <p className="text-[10px] text-muted-foreground -mt-2 ml-5">Change Visual Focus to People or Product to enable</p>
                      )}
                      <label className="flex items-center justify-between gap-2 text-xs cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={generateBackground} onChange={(e) => setGenerateBackground(e.target.checked)} className="accent-brand-500" />
                          <span>AI Background</span>
                        </div>
                        {generateBackground && <Badge variant="secondary" className="text-[9px] px-1 py-0">+{layoutImageCost}cr</Badge>}
                      </label>
                      {(generateHeroImage || generateBackground) && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Image Provider</Label>
                          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as ImageProvider)}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openai">OpenAI (gpt-image-1)</SelectItem>
                              <SelectItem value="xai">Grok (xAI)</SelectItem>
                              <SelectItem value="gemini">Gemini (Google)</SelectItem>
                            </SelectContent>
                          </Select>
                          {selectedProvider !== "openai" && generateHeroImage && (
                            <p className="text-[10px] text-muted-foreground mt-1">Transparent background via AI background removal</p>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}

                {/* Provider (image mode) */}
                {imageMode === "image" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">AI Provider</Label>
                    <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as ImageProvider)}>
                      <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI (gpt-image-1)</SelectItem>
                        <SelectItem value="xai">Grok (xAI)</SelectItem>
                        <SelectItem value="gemini">Gemini (Google)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Brand & Contact */}
                <CollapsibleSection title="Brand & Contact Info" icon={Building2}>
                  {brandIdentity ? (
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">Using <span className="font-medium text-foreground">{brandIdentity.name}</span></div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Logo Display</Label>
                        <div className="flex gap-1.5 mt-1">
                          {(["auto", "icon", "full"] as const).map((lt) => (
                            <button key={lt} onClick={() => setLogoType(lt)} className={`flex-1 p-2 rounded-lg border text-xs capitalize transition-colors ${logoType === lt ? "border-brand-500 bg-brand-500/10" : "border-border"}`}>
                              {lt === "auto" ? "Auto" : lt === "icon" ? "Icon Logo" : "Full Logo"}
                            </button>
                          ))}
                        </div>
                      </div>
                      {imageMode === "image" && (
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground"><span>Logo Size</span><span>{logoSizePercent}%</span></div>
                          <input type="range" min={8} max={35} value={logoSizePercent} onChange={(e) => setLogoSizePercent(parseInt(e.target.value))} className="w-full h-1.5 accent-brand-500" />
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={showBrandName} onChange={(e) => setShowBrandName(e.target.checked)} className="accent-brand-500" />
                        Show Brand Name
                      </label>
                      {Object.keys(brandIdentity.handles).some((k) => brandIdentity.handles[k as keyof SocialHandles]) && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input type="checkbox" checked={showSocialIcons} onChange={(e) => setShowSocialIcons(e.target.checked)} className="accent-brand-500" />
                          Show Social Icons
                        </label>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">Include Contact Info</Label>
                        <div className="space-y-1.5 mt-1">
                          {[
                            { key: "email" as const, icon: Mail, label: "Email", value: brandIdentity.email },
                            { key: "phone" as const, icon: Phone, label: "Phone", value: brandIdentity.phone },
                            { key: "website" as const, icon: Globe, label: "Website", value: brandIdentity.website },
                            { key: "address" as const, icon: MapPin, label: "Address", value: brandIdentity.address },
                          ].filter((c) => c.value).map((c) => (
                            <label key={c.key} className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={includeInDesign[c.key]} onChange={(e) => setIncludeInDesign((prev) => ({ ...prev, [c.key]: e.target.checked }))} className="accent-brand-500" />
                              <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Set up your brand in Settings to include logo, colors, and contact info.
                    </p>
                  )}
                </CollapsibleSection>
              </>
            ) : (
              /* ─── VIDEO TAB FORM ─── */
              <>
                {/* Provider */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Provider</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {VIDEO_PROVIDERS.map((p) => {
                      const Icon = p.icon;
                      return (
                        <TooltipProvider key={p.id} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setVideoProvider(p.id)}
                                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                                  videoProvider === p.id
                                    ? "border-brand-500 bg-brand-500/5"
                                    : "border-border hover:bg-muted/50"
                                }`}
                              >
                                <Icon className="h-4 w-4" />
                                <span className="font-medium">{p.label}</span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{p.desc}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>

                {/* Prompt */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Describe your video</Label>
                  <textarea
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    placeholder="Describe the video you want to create..."
                    className="w-full min-h-[100px] p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-background"
                  />
                </div>

                {/* Category */}
                <CollapsibleSection title="Category" icon={Film} defaultOpen>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VIDEO_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setVideoCategory(cat.id as VideoCategory)}
                        className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                          videoCategory === cat.id
                            ? "border-brand-500 bg-brand-500/5 text-brand-600"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Format */}
                <CollapsibleSection title="Format" icon={Ratio} defaultOpen>
                  <div>
                    <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {ASPECT_RATIO_OPTIONS.map((ar) => (
                        <button
                          key={ar.id}
                          onClick={() => setVideoAspectRatio(ar.id as AspectRatio)}
                          className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                            videoAspectRatio === ar.id
                              ? "border-brand-500 bg-brand-500/5 text-brand-600"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          {ar.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                      {VIDEO_DURATIONS.map((d) => (
                        <TooltipProvider key={d.seconds} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setVideoDuration(d)}
                                className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                                  videoDuration.seconds === d.seconds
                                    ? "border-brand-500 bg-brand-500/5 text-brand-600"
                                    : "border-border hover:bg-muted/50"
                                }`}
                              >
                                {d.label}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {d.seconds <= 8 ? "Base duration" : `Extends video (${getExtensionCount(d.seconds)} extension${getExtensionCount(d.seconds) > 1 ? "s" : ""})`}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Style */}
                <CollapsibleSection title="Style" icon={Palette}>
                  <div className="flex flex-wrap gap-1.5">
                    {VIDEO_STYLES.map((style) => (
                      <Badge key={style.id} variant={videoStyle === style.id ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setVideoStyle(style.id)}>
                        {style.label}
                      </Badge>
                    ))}
                  </div>
                </CollapsibleSection>
              </>
            )}
          </div>

          {/* ─── Right: Preview / Loader ─── */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/30 min-h-0">
            {activeTab === "image" ? (
              /* Image Preview Area */
              isGeneratingImage ? (
                <AIGenerationLoader
                  currentStep={imageMode === "layout" ? "Generating layout..." : "Creating your design..."}
                  subtitle={imageMode === "layout" ? "AI is building your editable layout" : "This usually takes 10-60 seconds"}
                />
              ) : generatedImageUrl ? (
                <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                  <div className="relative rounded-xl overflow-hidden shadow-lg border bg-background">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        generatedImageUrl.startsWith("http") && typeof window !== "undefined" && !generatedImageUrl.startsWith(window.location.origin)
                          ? `/api/image-proxy?url=${encodeURIComponent(generatedImageUrl)}`
                          : generatedImageUrl
                      }
                      alt="Generated design"
                      className="max-w-full max-h-[50vh] object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleDownloadImage}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleOpenInStudio}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Studio
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setGeneratedImageUrl(null); setGeneratedDesignId(null); }}>
                      Generate Another
                    </Button>
                  </div>
                </div>
              ) : layoutGenerated ? (
                <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400/20 to-green-600/20 flex items-center justify-center">
                    <Layers className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Layout generated!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your smart layout is ready. Open it in the Studio to edit, move, and customize each element individually.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="text-xs gap-1.5" onClick={handleOpenInStudio}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Studio
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setLayoutGenerated(false)}>
                      Generate Another
                    </Button>
                  </div>
                </div>
              ) : (
                <ImageEmptyState imageMode={imageMode} />
              )
            ) : (
              /* Video Preview Area */
              isGeneratingVideo ? (
                <AIGenerationLoader
                  currentStep={videoGenStatus || "Generating video..."}
                  progress={videoGenProgress}
                  subtitle="AI video generation may take 1-3 minutes"
                />
              ) : generatedVideoUrl ? (
                <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                  <div className="relative rounded-xl overflow-hidden shadow-lg border bg-black w-full aspect-video">
                    <video
                      src={generatedVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                      autoPlay
                      muted
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleDownloadVideo}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleOpenInVideoEditor}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Editor
                    </Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setGeneratedVideoUrl(null)}>
                      Generate Another
                    </Button>
                  </div>
                </div>
              ) : (
                <VideoEmptyState />
              )
            )}
          </div>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {brandIdentity && activeTab === "image" && (
              <span>Brand: <span className="font-medium text-foreground">{brandIdentity.name}</span></span>
            )}
          </div>
          <Button
            onClick={activeTab === "image" ? handleGenerateImage : handleGenerateVideo}
            disabled={isGenerating || (activeTab === "image" ? !imagePrompt.trim() : !videoPrompt.trim())}
            className="gap-2 px-6"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating
              ? "Generating..."
              : activeTab === "image"
                ? imageMode === "layout" ? "Generate Layout" : "Generate Design"
                : "Generate Video"
            }
            <Badge variant="secondary" className="text-[10px] ml-1">
              {activeTab === "image" ? imageCreditCost : videoCreditCost} credits
            </Badge>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Empty State Components ────────────────────────────────────────────────

function ImageEmptyState({ imageMode }: { imageMode: "layout" | "image" }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400/20 to-brand-600/20 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-brand-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Create an image</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {imageMode === "layout"
            ? "Describe your design and hit Generate. AI will create editable text, shapes, and elements you can open in the Studio."
            : "Describe your design, pick a style and size, then hit Generate. Your AI-created design will appear here."}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full mt-2">
        {imageMode === "layout"
          ? [
              { icon: Layers, label: "Editable elements" },
              { icon: Type, label: "Live text" },
              { icon: Zap, label: "Fast & cheap" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 border">
                <f.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{f.label}</span>
              </div>
            ))
          : [
              { icon: Layers, label: "Multi-format" },
              { icon: Palette, label: "Brand-aware" },
              { icon: Zap, label: "Instant" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 border">
                <f.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">{f.label}</span>
              </div>
            ))}
      </div>
    </div>
  );
}

function VideoEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-sm">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-400/20 to-rose-600/20 flex items-center justify-center">
        <Play className="h-8 w-8 text-rose-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Create a video</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Describe your video, pick a format and duration, then hit Generate. AI will create your video clip.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full mt-2">
        {[
          { icon: Film, label: "AI-powered" },
          { icon: Clock, label: "Up to 2 min" },
          { icon: Ratio, label: "Any format" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 border">
            <f.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{f.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
