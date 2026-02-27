"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { MediaUploader } from "@/components/shared/media-uploader";
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
import { useCanvasStore } from "./hooks/use-canvas-store";
import { addImageToCanvas } from "./utils/canvas-helpers";
import { motion, AnimatePresence } from "framer-motion";

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

function BrandedLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Logo with pulse animation */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
          <img
            src="/logo.png"
            alt="FlowSmartly"
            className="w-12 h-12 object-contain"
          />
        </div>
      </div>

      {/* Animated text */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-foreground">
          Creating your design
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          AI is generating your custom design. This usually takes 10-30 seconds.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-brand-500"
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface AiGeneratorModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiGeneratorModal({ open, onClose }: AiGeneratorModalProps) {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);

  // Generation state
  const [prompt, setPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<DesignCategory>("social_post");
  const [selectedSize, setSelectedSize] = useState<SizePreset | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<ImageProvider>("xai");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [heroType, setHeroType] = useState<"people" | "product" | "text-only">(
    "people"
  );
  const [textMode, setTextMode] = useState<"exact" | "creative">("creative");
  const [ctaText, setCtaText] = useState("");
  const [exactImageUrls, setExactImageUrls] = useState<string[]>([]);
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);

  // Brand
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity | null>(
    null
  );
  const [showBrandName, setShowBrandName] = useState(false);
  const [showSocialIcons, setShowSocialIcons] = useState(false);
  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<
    Set<string>
  >(new Set());
  const [logoType, setLogoType] = useState<"auto" | "icon" | "full">("auto");
  const [logoSizePercent, setLogoSizePercent] = useState(18);
  const [includeInDesign, setIncludeInDesign] = useState({
    email: false,
    phone: false,
    website: false,
    address: false,
  });

  // AI ideas
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [designCreditCost, setDesignCreditCost] = useState(15);

  // Result
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(
    null
  );

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

  // Fetch brand data on open
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [brandRes, studioRes, costsRes] = await Promise.all([
          fetch("/api/brand"),
          fetch("/api/ai/studio"),
          fetch("/api/credits/costs?keys=AI_VISUAL_DESIGN"),
        ]);
        const brandData = await brandRes.json();
        const studioData = await studioRes.json();
        const costsData = await costsRes.json();

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
            colors:
              typeof kit.colors === "string"
                ? JSON.parse(kit.colors)
                : kit.colors,
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
        if (studioData.success)
          setCreditsRemaining(studioData.data.stats?.creditsRemaining ?? 0);
        if (costsData.success && costsData.data?.costs?.AI_VISUAL_DESIGN)
          setDesignCreditCost(costsData.data.costs.AI_VISUAL_DESIGN);
      } catch {
        /* silently */
      }
    })();
  }, [open]);

  // Generate Ideas
  const handleGenerateIdeas = async () => {
    if (isGeneratingIdeas) return;
    setIsGeneratingIdeas(true);
    setAiIdeas([]);
    try {
      const res = await fetch("/api/ai/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          style: selectedStyle,
        }),
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
      toast({
        title: "Idea generation failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingIdeas(false);
    }
  };

  // Generate Design
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Please describe what you want to create",
        variant: "destructive",
      });
      return;
    }
    if (!selectedSize) {
      toast({ title: "Please select a size", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);
    try {
      const socialHandles: Record<string, string> = {};
      if (showSocialIcons && brandIdentity?.handles) {
        selectedSocialPlatforms.forEach((p) => {
          const h = brandIdentity.handles[p as keyof SocialHandles];
          if (h) socialHandles[p] = h;
        });
      }

      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          category: selectedCategory,
          size: `${selectedSize.width}x${selectedSize.height}`,
          style: selectedStyle,
          provider: selectedProvider,
          heroType,
          textMode,
          brandColors: brandIdentity?.colors || null,
          brandLogo:
            logoType === "icon"
              ? brandIdentity?.iconLogo || brandIdentity?.logo
              : logoType === "full"
                ? brandIdentity?.logo || brandIdentity?.iconLogo
                : brandIdentity?.logo || brandIdentity?.iconLogo,
          logoSizePercent,
          brandName: showBrandName ? brandIdentity?.name : null,
          showBrandName,
          showSocialIcons,
          socialHandles:
            Object.keys(socialHandles).length > 0 ? socialHandles : null,
          contactInfo: {
            email: includeInDesign.email ? brandIdentity?.email : null,
            phone: includeInDesign.phone ? brandIdentity?.phone : null,
            website: includeInDesign.website ? brandIdentity?.website : null,
            address: includeInDesign.address ? brandIdentity?.address : null,
          },
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

      // Add generated image to canvas
      if (data.data?.design?.imageUrl && canvas) {
        const [w, h] = (data.data.design.size || "").split("x").map(Number);
        if (w && h && (w !== canvasWidth || h !== canvasHeight)) {
          setCanvasDimensions(w, h);
        }
        setGeneratedImageUrl(data.data.design.imageUrl);
        const fabric = await import("fabric");
        try {
          await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
          toast({ title: "Design generated and added to canvas!" });
        } catch {
          toast({
            title: "Design generated but failed to load on canvas",
            description:
              "The image was saved. Try adding it from your uploads.",
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "Design generated!" });
      }
    } catch (e) {
      toast({
        title: "Generation failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentCategory = DESIGN_CATEGORIES.find(
    (c) => c.id === selectedCategory
  )!;

  const handleClose = useCallback(() => {
    if (isGenerating) return; // Don't close while generating
    onClose();
  }, [isGenerating, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-[95vw] max-w-5xl max-h-[90vh] bg-background rounded-xl shadow-2xl border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">AI Design Generator</h2>
              <p className="text-xs text-muted-foreground">
                Create professional designs with AI
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              {creditsRemaining} credits
            </Badge>
            <button
              onClick={handleClose}
              disabled={isGenerating}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Form */}
          <div className="w-[420px] shrink-0 border-r overflow-y-auto p-5 space-y-4">
            {/* Prompt input + Ideas */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm font-medium">
                  Describe your design
                </Label>
                <div className="flex items-center gap-1">
                  <AIIdeasHistory
                    contentType="DESIGN_IDEAS"
                    onSelect={(idea) => setPrompt(idea)}
                    className="text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-xs gap-1"
                    onClick={handleGenerateIdeas}
                    disabled={isGeneratingIdeas}
                  >
                    {isGeneratingIdeas ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                    Ideas
                  </Button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. A vibrant Instagram post announcing a new product launch with bold typography and colorful gradients"
                className="w-full min-h-[100px] p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 bg-background"
              />
              {/* Ideas suggestions */}
              {aiIdeas.length > 0 && (
                <div className="mt-2 space-y-1">
                  {aiIdeas.map((idea, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPrompt(idea);
                        setAiIdeas([]);
                      }}
                      className="w-full text-left p-2 text-xs rounded-lg border hover:border-brand-500 hover:bg-brand-500/5 transition-colors line-clamp-2"
                    >
                      {idea}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Design Type & Size */}
            <CollapsibleSection
              title="Design Type & Size"
              icon={Layers}
              defaultOpen
            >
              {/* Category */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Category
                </Label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {DESIGN_CATEGORIES.map((cat) => {
                    const CatIcon = categoryIcons[cat.id] || ImageIcon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() =>
                          setSelectedCategory(cat.id as DesignCategory)
                        }
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs border transition-colors ${
                          selectedCategory === cat.id
                            ? "border-brand-500 bg-brand-500/10 text-brand-600"
                            : "border-transparent hover:bg-muted"
                        }`}
                      >
                        <CatIcon className="h-4 w-4" />
                        {cat.name.split(" ")[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size Preset */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Size Preset
                </Label>
                <div className="space-y-0.5 mt-1">
                  {currentCategory?.presets.map((preset) => {
                    const providers = getProvidersForPreset(
                      preset.width,
                      preset.height
                    );
                    const compatible = providers.includes(selectedProvider);
                    return (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setSelectedSize(preset);
                          setCanvasDimensions(preset.width, preset.height);
                        }}
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
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {preset.width}x{preset.height}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CollapsibleSection>

            {/* Style & Appearance */}
            <CollapsibleSection title="Style & Appearance" icon={Palette}>
              {/* Visual Style */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Visual Style
                </Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DESIGN_STYLES.map((style) => (
                    <Badge
                      key={style.id}
                      variant={
                        selectedStyle === style.id ? "default" : "outline"
                      }
                      className="cursor-pointer text-xs"
                      onClick={() => setSelectedStyle(style.id)}
                    >
                      {style.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Visual Focus */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Visual Focus
                </Label>
                <div className="flex gap-1.5 mt-1">
                  {[
                    {
                      id: "people" as const,
                      icon: User,
                      label: "People",
                    },
                    {
                      id: "product" as const,
                      icon: Package,
                      label: "Product",
                    },
                    {
                      id: "text-only" as const,
                      icon: Type,
                      label: "Text Only",
                    },
                  ].map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setHeroType(h.id)}
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

              {/* Text Mode */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Text Mode
                </Label>
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={() => setTextMode("creative")}
                    className={`flex-1 p-2 rounded-lg border text-xs text-center transition-colors ${
                      textMode === "creative"
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:border-brand-300"
                    }`}
                  >
                    AI Creative
                  </button>
                  <button
                    onClick={() => setTextMode("exact")}
                    className={`flex-1 p-2 rounded-lg border text-xs text-center transition-colors ${
                      textMode === "exact"
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:border-brand-300"
                    }`}
                  >
                    Use My Text
                  </button>
                </div>
              </div>

              {/* CTA */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Call to Action (optional)
                </Label>
                <Input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder='e.g. "Shop Now", "Book Today"'
                  className="h-8 text-sm mt-1"
                />
              </div>

              {/* Style Reference */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Style Reference
                </Label>
                <MediaUploader
                  value={styleReferenceUrls}
                  onChange={setStyleReferenceUrls}
                  maxFiles={1}
                  accept="image/*"
                />
              </div>

              {/* Exact Image */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Exact Image
                </Label>
                <MediaUploader
                  value={exactImageUrls}
                  onChange={setExactImageUrls}
                  maxFiles={1}
                  accept="image/*"
                />
              </div>
            </CollapsibleSection>

            {/* Provider */}
            <div>
              <Label className="text-xs text-muted-foreground">
                AI Provider
              </Label>
              <Select
                value={selectedProvider}
                onValueChange={(v) =>
                  setSelectedProvider(v as ImageProvider)
                }
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">
                    OpenAI (gpt-image-1)
                  </SelectItem>
                  <SelectItem value="xai">Grok (xAI)</SelectItem>
                  <SelectItem value="gemini">Gemini (Google)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Brand & Contact */}
            <CollapsibleSection title="Brand & Contact Info" icon={Building2}>
              {brandIdentity ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Using{" "}
                    <span className="font-medium text-foreground">
                      {brandIdentity.name}
                    </span>
                  </div>

                  {/* Logo */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Logo Display
                    </Label>
                    <div className="flex gap-1.5 mt-1">
                      {(["auto", "icon", "full"] as const).map((lt) => (
                        <button
                          key={lt}
                          onClick={() => setLogoType(lt)}
                          className={`flex-1 p-2 rounded-lg border text-xs capitalize transition-colors ${
                            logoType === lt
                              ? "border-brand-500 bg-brand-500/10"
                              : "border-border"
                          }`}
                        >
                          {lt === "auto"
                            ? "Auto"
                            : lt === "icon"
                              ? "Icon Logo"
                              : "Full Logo"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logo Size */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Logo Size</span>
                      <span>{logoSizePercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={35}
                      value={logoSizePercent}
                      onChange={(e) =>
                        setLogoSizePercent(parseInt(e.target.value))
                      }
                      className="w-full h-1.5 accent-brand-500"
                    />
                  </div>

                  {/* Brand Name */}
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBrandName}
                      onChange={(e) => setShowBrandName(e.target.checked)}
                      className="accent-brand-500"
                    />
                    Show Brand Name
                  </label>

                  {/* Social Icons */}
                  {Object.keys(brandIdentity.handles).some(
                    (k) =>
                      brandIdentity.handles[k as keyof SocialHandles]
                  ) && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showSocialIcons}
                        onChange={(e) =>
                          setShowSocialIcons(e.target.checked)
                        }
                        className="accent-brand-500"
                      />
                      Show Social Icons
                    </label>
                  )}

                  {/* Contact */}
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Include Contact Info
                    </Label>
                    <div className="space-y-1.5 mt-1">
                      {[
                        {
                          key: "email" as const,
                          icon: Mail,
                          label: "Email",
                          value: brandIdentity.email,
                        },
                        {
                          key: "phone" as const,
                          icon: Phone,
                          label: "Phone",
                          value: brandIdentity.phone,
                        },
                        {
                          key: "website" as const,
                          icon: Globe,
                          label: "Website",
                          value: brandIdentity.website,
                        },
                        {
                          key: "address" as const,
                          icon: MapPin,
                          label: "Address",
                          value: brandIdentity.address,
                        },
                      ]
                        .filter((c) => c.value)
                        .map((c) => (
                          <label
                            key={c.key}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={includeInDesign[c.key]}
                              onChange={(e) =>
                                setIncludeInDesign((prev) => ({
                                  ...prev,
                                  [c.key]: e.target.checked,
                                }))
                              }
                              className="accent-brand-500"
                            />
                            <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {c.label}
                          </label>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Set up your brand in Settings to include logo, colors, and
                  contact info.
                </p>
              )}
            </CollapsibleSection>
          </div>

          {/* Right: Preview / Loader */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/30 min-h-0">
            {isGenerating ? (
              <BrandedLoader />
            ) : generatedImageUrl ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                <div className="relative rounded-xl overflow-hidden shadow-lg border bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      generatedImageUrl.startsWith("http") &&
                      typeof window !== "undefined" &&
                      !generatedImageUrl.startsWith(window.location.origin)
                        ? `/api/image-proxy?url=${encodeURIComponent(generatedImageUrl)}`
                        : generatedImageUrl
                    }
                    alt="Generated design"
                    className="max-w-full max-h-[50vh] object-contain"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-300"
                  >
                    Added to canvas
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setGeneratedImageUrl(null);
                    }}
                  >
                    Generate Another
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={handleClose}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400/20 to-brand-600/20 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-brand-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    Ready to create
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Describe your design, pick a style and size, then hit
                    Generate. Your AI-created design will appear here and be
                    added to the canvas.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3 w-full mt-2">
                  {[
                    { icon: Layers, label: "Multi-format" },
                    { icon: Palette, label: "Brand-aware" },
                    { icon: Zap, label: "Instant" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 border"
                    >
                      <f.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Generate button */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground">
            {brandIdentity && (
              <span>
                Brand:{" "}
                <span className="font-medium text-foreground">
                  {brandIdentity.name}
                </span>
              </span>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="gap-2 px-6"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : "Generate Design"}
            <Badge variant="secondary" className="text-[10px] ml-1">
              {designCreditCost} credits
            </Badge>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
