"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import {
  Sparkles,
  Image,
  Megaphone,
  FileText,
  Presentation,
  PanelTop,
  Signpost,
  Loader2,
  Download,
  RefreshCw,
  Wand2,
  Zap,
  Palette,
  History,
  FileImage,
  Maximize2,
  User,
  Package,
  Type,
  ChevronDown,
  PenLine,
  Mail,
  Phone,
  Globe,
  MapPin,
  Layers,
  Eye,
  Building2,
  LayoutTemplate,
  ImageIcon,
  X,
  Scissors,
} from "lucide-react";
import { TemplateBrowser, type DesignTemplate } from "@/components/studio/template-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AIGenerationLoader, AISpinner } from "@/components/shared/ai-generation-loader";
import { AIIdeasHistory } from "@/components/shared/ai-ideas-history";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { PostSharePanel } from "@/components/shared/post-share-panel";
import { MediaUploader } from "@/components/shared/media-uploader";
import { BackgroundRemover } from "@/components/shared/background-remover";
import {
  DESIGN_CATEGORIES,
  DESIGN_STYLES,
  getProvidersForPreset,
  type DesignCategory,
  type ImageProvider,
  type SizePreset,
} from "@/lib/constants/design-presets";

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
  social_post: Image,
  ad: Megaphone,
  flyer: FileText,
  poster: Presentation,
  banner: PanelTop,
  signboard: Signpost,
};

// ─── Types ───

interface Design {
  id: string;
  prompt: string;
  category: string;
  size: string;
  style: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
}

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

// ─── Main Page ───

export default function VisualDesignStudioPage() {
  const { toast } = useToast();

  // Generation state
  const [selectedCategory, setSelectedCategory] = useState<DesignCategory>("social_post");
  const [selectedSize, setSelectedSize] = useState<SizePreset | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ImageProvider>("xai");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [heroType, setHeroType] = useState<"people" | "product" | "text-only">("people");
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDesign, setGeneratedDesign] = useState<Design | null>(null);
  const [inputsCollapsed, setInputsCollapsed] = useState(false);
  const [textMode, setTextMode] = useState<"exact" | "creative">("creative");
  const [includeInDesign, setIncludeInDesign] = useState<{
    email: boolean;
    phone: boolean;
    website: boolean;
    address: boolean;
  }>({ email: false, phone: false, website: false, address: false });

  const [showBrandName, setShowBrandName] = useState(false);
  const [showSocialIcons, setShowSocialIcons] = useState(false);
  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<Set<string>>(new Set());

  // Logo compositing controls
  const [logoType, setLogoType] = useState<"auto" | "icon" | "full">("auto");
  const [logoSizePercent, setLogoSizePercent] = useState(18);

  // Call to action text
  const [ctaText, setCtaText] = useState("");
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([]);

  // Edit design
  const [editInstruction, setEditInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingCta, setIsGeneratingCta] = useState(false);

  // Reference images (exact images to include in design)
  const [exactImageUrls, setExactImageUrls] = useState<string[]>([]);

  // Style reference images (design inspiration)
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);

  // Background remover state
  const [bgRemoverOpen, setBgRemoverOpen] = useState(false);
  const [bgRemoverImageUrl, setBgRemoverImageUrl] = useState("");

  // AI ideas state
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);

  // Data state
  const [recentDesigns, setRecentDesigns] = useState<Design[]>([]);
  const [isLoadingDesigns, setIsLoadingDesigns] = useState(true);
  const [creditsRemaining, setCreditsRemaining] = useState<number>(0);
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity | null>(null);
  const [designCreditCost, setDesignCreditCost] = useState<number>(15);

  // Active view
  const [activeView, setActiveView] = useState<"create" | "templates" | "gallery">("create");
  const [previewDesign, setPreviewDesign] = useState<Design | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DesignTemplate | null>(null);

  const currentCategory = DESIGN_CATEGORIES.find((c) => c.id === selectedCategory)!;

  // Auto-select first compatible preset when category or provider changes
  useEffect(() => {
    const cat = DESIGN_CATEGORIES.find((c) => c.id === selectedCategory);
    if (cat && cat.presets.length > 0) {
      const compatiblePreset = cat.presets.find((p) =>
        getProvidersForPreset(p.width, p.height).includes(selectedProvider)
      );
      setSelectedSize(compatiblePreset || cat.presets[0]);
    }
  }, [selectedCategory, selectedProvider]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoadingDesigns(true);
      const [designsRes, brandRes, studioRes, costsRes] = await Promise.all([
        fetch("/api/designs?limit=10"),
        fetch("/api/brand"),
        fetch("/api/ai/studio"),
        fetch("/api/credits/costs?keys=AI_VISUAL_DESIGN"),
      ]);

      const designsData = await designsRes.json();
      const brandData = await brandRes.json();
      const studioData = await studioRes.json();
      const costsData = await costsRes.json();

      if (designsData.success) {
        setRecentDesigns(designsData.data.designs);
      }

      if (brandData.success && brandData.data?.brandKit) {
        const kit = brandData.data.brandKit;
        const parsedHandles = typeof kit.handles === "string" ? JSON.parse(kit.handles || "{}") : (kit.handles || {});
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
        const platformsWithHandles = Object.keys(parsedHandles).filter((k: string) => parsedHandles[k]);
        if (platformsWithHandles.length > 0) {
          setSelectedSocialPlatforms(new Set(platformsWithHandles));
        }
      }

      if (studioData.success) {
        setCreditsRemaining(studioData.data.stats?.creditsRemaining ?? 0);
      }

      if (costsData.success && costsData.data?.costs?.AI_VISUAL_DESIGN) {
        setDesignCreditCost(costsData.data.costs.AI_VISUAL_DESIGN);
      }
    } catch (error) {
      console.error("Failed to fetch studio data:", error);
    } finally {
      setIsLoadingDesigns(false);
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
      const response = await fetch("/api/ai/studio/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          style: selectedStyle,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to generate ideas" }));
        if (handleCreditError(err.error || {}, "AI ideas")) return;
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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Please describe what you want to create", variant: "destructive" });
      return;
    }

    if (!selectedSize) {
      toast({ title: "Please select a size", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setInputsCollapsed(true);

    try {
      const socialHandles: Record<string, string> = {};
      if (showSocialIcons && brandIdentity?.handles) {
        selectedSocialPlatforms.forEach((platform) => {
          const handle = brandIdentity.handles[platform as keyof SocialHandles];
          if (handle) {
            socialHandles[platform] = handle;
          }
        });
      }

      const response = await fetch("/api/ai/visual", {
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
          brandLogo: logoType === "icon" ? (brandIdentity?.iconLogo || brandIdentity?.logo || null)
            : logoType === "full" ? (brandIdentity?.logo || brandIdentity?.iconLogo || null)
            : (brandIdentity?.logo || brandIdentity?.iconLogo || null),
          logoSizePercent,
          brandName: showBrandName ? (brandIdentity?.name || null) : null,
          showBrandName,
          showSocialIcons,
          socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
          contactInfo: {
            email: includeInDesign.email ? brandIdentity?.email : null,
            phone: includeInDesign.phone ? brandIdentity?.phone : null,
            website: includeInDesign.website ? brandIdentity?.website : null,
            address: includeInDesign.address ? brandIdentity?.address : null,
          },
          ctaText: ctaText.trim() || null,
          templateImageUrl: styleReferenceUrls[0] || selectedTemplate?.image || null,
          referenceImageUrl: exactImageUrls[0] || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (handleCreditError(data.error || {}, "visual design")) {
          setInputsCollapsed(false);
          setIsGenerating(false);
          return;
        }
        throw new Error(data.error?.message || "Generation failed");
      }

      setGeneratedDesign(data.data.design);
      setCreditsRemaining(data.data.creditsRemaining);
      emitCreditsUpdate(data.data.creditsRemaining);
      setRecentDesigns((prev) => [data.data.design, ...prev.slice(0, 9)]);
      setInputsCollapsed(true);

      toast({ title: "Design generated successfully!" });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setInputsCollapsed(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditDesign = async () => {
    if (!editInstruction.trim() || !generatedDesign?.imageUrl) return;

    setIsEditing(true);

    try {
      const response = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: editInstruction.trim(),
          category: generatedDesign.category || selectedCategory,
          size: generatedDesign.size || `${selectedSize?.width || 1080}x${selectedSize?.height || 1080}`,
          style: generatedDesign.style || selectedStyle,
          provider: selectedProvider,
          heroType,
          textMode: "exact",
          editImageUrl: generatedDesign.imageUrl,
          brandLogo: logoType === "icon" ? (brandIdentity?.iconLogo || brandIdentity?.logo || null)
            : logoType === "full" ? (brandIdentity?.logo || brandIdentity?.iconLogo || null)
            : (brandIdentity?.logo || brandIdentity?.iconLogo || null),
          logoSizePercent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (handleCreditError(data.error || {}, "visual design")) {
          setIsEditing(false);
          return;
        }
        throw new Error(data.error?.message || "Edit failed");
      }

      setGeneratedDesign(data.data.design);
      setCreditsRemaining(data.data.creditsRemaining);
      emitCreditsUpdate(data.data.creditsRemaining);
      setRecentDesigns((prev) => [data.data.design, ...prev.slice(0, 9)]);
      setEditInstruction("");

      toast({ title: "Design updated successfully!" });
    } catch (error) {
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDownloadPng = (design: Design) => {
    if (!design.imageUrl) {
      toast({ title: "No image available", variant: "destructive" });
      return;
    }
    const link = document.createElement("a");
    link.href = design.imageUrl;
    link.download = `design-${design.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "PNG downloaded!" });
  };

  const getPromptSuggestions = () => {
    const brandName = brandIdentity?.name || "your brand";
    switch (selectedCategory) {
      case "social_post":
        return [
          `A vibrant Instagram post for ${brandName} announcing a new product launch`,
          `An engaging social media graphic with modern typography and bold colors`,
          `A motivational quote post with abstract gradient background`,
        ];
      case "ad":
        return [
          `A professional Facebook ad for ${brandName} with compelling visuals`,
          `An eye-catching digital advertisement with product showcase`,
          `A retargeting ad with clear call-to-action and brand colors`,
        ];
      case "flyer":
        return [
          `A promotional flyer for a weekend sale event`,
          `An elegant event invitation flyer with modern design`,
          `A business services flyer with professional layout`,
        ];
      case "poster":
        return [
          `A concert event poster with dynamic typography and bold imagery`,
          `A minimalist movie poster with dramatic lighting`,
          `An awareness campaign poster with impactful visuals`,
        ];
      case "banner":
        return [
          `A professional LinkedIn cover banner for ${brandName}`,
          `A YouTube channel banner with modern branding elements`,
          `A website hero banner with abstract gradient design`,
        ];
      case "signboard":
        return [
          `A storefront signboard for ${brandName} with clean typography`,
          `A directional signboard with clear icons and text`,
          `A promotional display sign with bold branding`,
        ];
    }
  };

  // ─── Summary badges for collapsed sections ───

  const CategoryIcon = categoryIcons[selectedCategory] || Image;

  const designTypeSummary = (
    <>
      <Badge className="text-[10px] bg-brand-500/10 text-brand-500 border-brand-500/20 gap-1">
        <CategoryIcon className="w-3 h-3" />
        {currentCategory.name}
      </Badge>
      {selectedSize && (
        <Badge className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20">
          {selectedSize.name}
          <span className="opacity-60 ml-1">{selectedSize.width}x{selectedSize.height}</span>
        </Badge>
      )}
    </>
  );

  const styleSummary = (
    <>
      <Badge className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 capitalize">
        {DESIGN_STYLES.find(s => s.id === selectedStyle)?.label || selectedStyle}
      </Badge>
      <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 capitalize gap-1">
        {heroType === "people" && <User className="w-3 h-3" />}
        {heroType === "product" && <Package className="w-3 h-3" />}
        {heroType === "text-only" && <Type className="w-3 h-3" />}
        {heroType === "text-only" ? "Text Only" : heroType}
      </Badge>
      <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
        {textMode === "creative" ? "AI Creative" : "Exact Text"}
      </Badge>
      {exactImageUrls.length > 0 && (
        <Badge className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20 gap-1">
          <ImageIcon className="w-3 h-3" />
          {exactImageUrls.length === 1 ? "Exact Image" : `${exactImageUrls.length} Exact Images`}
        </Badge>
      )}
    </>
  );

  const brandSummary = (() => {
    const items: React.ReactNode[] = [];
    if (showBrandName) {
      items.push(
        <Badge key="brand" className="text-[10px] bg-brand-500/10 text-brand-500 border-brand-500/20 gap-1">
          <Building2 className="w-3 h-3" />
          Brand name
        </Badge>
      );
    }
    if (showSocialIcons && selectedSocialPlatforms.size > 0) {
      items.push(
        <Badge key="social" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1">
          <Globe className="w-3 h-3" />
          {selectedSocialPlatforms.size} social
        </Badge>
      );
    }
    const contactActive = Object.entries(includeInDesign).filter(([, v]) => v).map(([k]) => k);
    if (contactActive.length > 0) {
      items.push(
        <Badge key="contact" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
          <Mail className="w-3 h-3" />
          {contactActive.join(", ")}
        </Badge>
      );
    }
    if (items.length === 0) {
      return <Badge className="text-[10px] bg-muted text-muted-foreground border-border">Default settings</Badge>;
    }
    return items;
  })();

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
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
              <Palette className="w-4 h-4 text-white" />
            </div>
            Visual Design Studio
          </h1>
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
              variant={activeView === "templates" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("templates")}
            >
              <LayoutTemplate className="w-4 h-4 mr-1" />
              Templates
            </Button>
            <Button
              variant={activeView === "gallery" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveView("gallery")}
            >
              <History className="w-4 h-4 mr-1" />
              Gallery
            </Button>
          </div>
        </div>
      </div>

      {activeView === "templates" ? (
        /* ═══ Templates View ═══ */
        <TemplateBrowser
          onSelectTemplate={(template) => {
            setSelectedTemplate(template);
            // Auto-fill category and size from the template
            const cat = DESIGN_CATEGORIES.find((c) => c.id === template.category);
            if (cat) {
              setSelectedCategory(template.category as DesignCategory);
              const matchingPreset = cat.presets.find((p) => p.name === template.preset);
              if (matchingPreset) {
                setSelectedSize(matchingPreset);
              }
            }
            setActiveView("create");
          }}
        />
      ) : activeView === "create" ? (
        <div className="space-y-4">
          {/* ─── Collapsed Summary Bar (shown after generation) ─── */}
          {inputsCollapsed && (generatedDesign || isGenerating || isEditing) && (
            <Card className="border-brand-500/20 bg-brand-500/5 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                      {(isGenerating || isEditing) ? (
                        <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-brand-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{prompt || "Design prompt"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="secondary" className="text-[10px]">{selectedCategory.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="text-[10px]">{selectedSize?.width}x{selectedSize?.height}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{selectedProvider === "xai" ? "xAI" : selectedProvider === "openai" ? "OpenAI" : "Gemini"}</Badge>
                        <Badge variant="outline" className="text-[10px]">{selectedStyle}</Badge>
                        <Badge variant="outline" className="text-[10px]">{heroType}</Badge>
                        {selectedTemplate && (
                          <Badge className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20 gap-1">
                            <ImageIcon className="w-3 h-3" />
                            Template
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInputsCollapsed(false)}
                    className="shrink-0"
                    disabled={isGenerating}
                  >
                    <PenLine className="w-3.5 h-3.5 mr-1.5" />
                    Edit & Regenerate
                    <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Loading State ─── */}
          {(isGenerating || isEditing) && !generatedDesign && (
            <Card className="border-brand-500/20 rounded-2xl">
              <CardContent className="p-6">
                <AIGenerationLoader
                  currentStep={isEditing ? "Editing your design..." : "Creating your design..."}
                  subtitle={isEditing ? "AI is applying your changes" : "AI is generating your custom visual"}
                />
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <Badge variant="secondary">{selectedCategory.replace("_", " ")}</Badge>
                  <Badge variant="outline">{selectedSize?.width}x{selectedSize?.height}</Badge>
                  <Badge variant="outline">{selectedStyle}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─── Input Controls ─── */}
          {!inputsCollapsed && (
            <div className="space-y-4">
              {/* ═══ Template Reference Card (shown when a template is selected) ═══ */}
              {selectedTemplate && (
                <div className="flex items-center gap-4 p-4 rounded-2xl border border-brand-500/20 bg-brand-500/5">
                  <div className="w-16 h-20 rounded-xl overflow-hidden border bg-muted/30 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedTemplate.thumbnail}
                      alt={selectedTemplate.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-brand-500 shrink-0" />
                      <span className="text-sm font-semibold">Using template</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                      {selectedTemplate.name}
                    </p>
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {selectedTemplate.preset}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setActiveView("templates")}
                    >
                      Change
                    </Button>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
                      title="Remove template"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ═══ TOP: Prompt ═══ */}
              <Card className="rounded-2xl border-brand-500/10 shadow-sm">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-brand-500" />
                      <Label className="text-base font-semibold">Describe Your Design</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <AIIdeasHistory contentType="design_ideas" onSelect={(idea) => setPrompt(idea)} />
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
                      placeholder="E.g., A vibrant Instagram post announcing our summer sale with bold typography, tropical colors, and a 50% off badge..."
                      className={`w-full min-h-[100px] p-4 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/50 transition-all ${
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
                      Describe your design concept — or click <strong>AI Ideas</strong> above to get personalized suggestions based on your brand.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* ═══ Section 1: Design Type (open by default) ═══ */}
              <CollapsibleSection
                title="Design Type & Size"
                icon={Layers}
                summary={designTypeSummary}
                defaultOpen={true}
              >
                <div className="space-y-5">
                  {/* Category */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium text-muted-foreground">Category</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {DESIGN_CATEGORIES.map((cat) => {
                        const Icon = categoryIcons[cat.id] || Image;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                              selectedCategory === cat.id
                                ? "border-brand-500 bg-brand-500/5"
                                : "border-transparent bg-muted/50 hover:bg-muted"
                            }`}
                          >
                            <Icon
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

                  {/* Size */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium text-muted-foreground">Size Preset</Label>
                    <div className="flex flex-wrap gap-2">
                      {currentCategory.presets.map((preset) => {
                        const providers = getProvidersForPreset(preset.width, preset.height);
                        const compatible = providers.includes(selectedProvider);
                        return (
                          <button
                            key={preset.name}
                            onClick={() => compatible && setSelectedSize(preset)}
                            className={`px-3 py-2 rounded-xl text-sm transition-all ${
                              selectedSize?.name === preset.name
                                ? "bg-brand-500 text-white"
                                : compatible
                                  ? "bg-muted hover:bg-muted/80"
                                  : "bg-muted/30 opacity-40 cursor-not-allowed line-through"
                            }`}
                            disabled={!compatible}
                          >
                            <span className="font-medium">{preset.name}</span>
                            <span className="block text-xs opacity-70">
                              {preset.width} x {preset.height}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* ═══ Section 2: Style & Appearance (collapsed by default) ═══ */}
              <CollapsibleSection
                title="Style & Appearance"
                icon={Eye}
                summary={styleSummary}
                defaultOpen={false}
              >
                <div className="space-y-5">
                  {/* Visual Style */}
                  <div className="space-y-2.5">
                    <Label className="text-sm font-medium text-muted-foreground">Visual Style</Label>
                    <div className="flex flex-wrap gap-2">
                      {DESIGN_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            selectedStyle === style.id
                              ? "bg-brand-500 text-white"
                              : "bg-muted hover:bg-muted/80"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hero Type & Text Mode */}
                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Visual Focus</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: "people" as const, label: "People", icon: User },
                          { id: "product" as const, label: "Product", icon: Package },
                          { id: "text-only" as const, label: "Text Only", icon: Type },
                        ]).map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setHeroType(option.id)}
                            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                              heroType === option.id
                                ? "border-brand-500 bg-brand-500/5"
                                : "border-transparent bg-muted/50 hover:bg-muted"
                            }`}
                          >
                            <option.icon className={`w-5 h-5 ${heroType === option.id ? "text-brand-500" : "text-muted-foreground"}`} />
                            <span className="text-xs font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-sm font-medium text-muted-foreground">Text Mode</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { id: "creative" as const, label: "AI Creative" },
                          { id: "exact" as const, label: "Use My Text" },
                        ]).map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setTextMode(option.id)}
                            className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                              textMode === option.id
                                ? "border-brand-500 bg-brand-500/5"
                                : "border-transparent bg-muted/50 hover:bg-muted"
                            }`}
                          >
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Call to Action Text */}
                  <div className="space-y-2.5 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-muted-foreground">
                        Call to Action <span className="text-xs font-normal">(optional)</span>
                      </Label>
                      <button
                        onClick={async () => {
                          if (!prompt.trim() || isGeneratingCta) return;
                          setIsGeneratingCta(true);
                          try {
                            const res = await fetch("/api/ai/generate/cta", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ description: prompt.trim(), category: selectedCategory }),
                            });
                            const data = await res.json();
                            if (data.success && data.data?.suggestions?.length) {
                              setCtaSuggestions(data.data.suggestions);
                            }
                          } catch {
                            toast({ title: "Failed to generate suggestions", variant: "destructive" });
                          } finally {
                            setIsGeneratingCta(false);
                          }
                        }}
                        disabled={!prompt.trim() || isGeneratingCta}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-brand-600 hover:bg-brand-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isGeneratingCta ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        Suggest
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder='e.g. "Shop Now", "Book Today", "Get 50% Off"'
                        maxLength={60}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {ctaSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ctaSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => {
                              setCtaText(suggestion);
                              setCtaSuggestions([]);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              ctaText === suggestion
                                ? "border-brand-500 bg-brand-500/10 text-brand-600"
                                : "border-border bg-muted/50 hover:bg-muted hover:border-brand-300 text-foreground"
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Style Reference + Exact Image — side by side */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                    {/* Design Style Reference */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Style Reference</Label>
                      <p className="text-[10px] text-muted-foreground">AI recreates this style with your content</p>
                      <MediaUploader
                        value={styleReferenceUrls}
                        onChange={setStyleReferenceUrls}
                        multiple
                        maxFiles={5}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        maxSize={10 * 1024 * 1024}
                        filterTypes={["image"]}
                        variant="small"
                        placeholder="Upload"
                        libraryTitle="Select Style Reference"
                      />
                    </div>

                    {/* Exact Image */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Exact Image</Label>
                      <p className="text-[10px] text-muted-foreground">AI uses your exact image in the design</p>
                      <MediaUploader
                        value={exactImageUrls}
                        onChange={setExactImageUrls}
                        multiple
                        maxFiles={5}
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        maxSize={10 * 1024 * 1024}
                        filterTypes={["image"]}
                        variant="small"
                        placeholder="Upload"
                        libraryTitle="Select Exact Image"
                      />
                      {exactImageUrls.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => {
                            setBgRemoverImageUrl(exactImageUrls[0]);
                            setBgRemoverOpen(true);
                          }}
                        >
                          <Scissors className="w-3 h-3" />
                          Remove Background
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* ═══ Section 3: Brand & Contact (collapsed by default) ═══ */}
              {brandIdentity && (
                <CollapsibleSection
                  title="Brand & Contact Info"
                  icon={Building2}
                  summary={brandSummary}
                  defaultOpen={false}
                >
                  <div className="space-y-5">
                    {/* Brand Name & Social */}
                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Brand Name Toggle */}
                      <div className="space-y-2.5">
                        <Label className="text-sm font-medium text-muted-foreground">Logo Display</Label>
                        <p className="text-xs text-muted-foreground">Toggle off if your logo already contains the brand name</p>
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${showBrandName ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                          <input
                            type="checkbox"
                            checked={showBrandName}
                            onChange={(e) => setShowBrandName(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                          <div>
                            <span className="text-sm font-medium">Show Brand Name</span>
                            <span className="block text-xs text-muted-foreground">Display &quot;{brandIdentity.name}&quot; alongside logo</span>
                          </div>
                        </label>
                      </div>

                      {/* Logo Type & Size */}
                      <div className="space-y-2.5">
                        <Label className="text-sm font-medium text-muted-foreground">Logo Settings</Label>
                        {/* Logo Type Selector */}
                        {brandIdentity.logo && brandIdentity.iconLogo ? (
                          <div className="flex gap-2">
                            {(["auto", "icon", "full"] as const).map((type) => (
                              <button
                                key={type}
                                onClick={() => setLogoType(type)}
                                className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                                  logoType === type ? "border-brand-500 bg-brand-500/5 text-brand-600" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                                }`}
                              >
                                {type === "auto" ? "Auto" : type === "icon" ? "Icon Logo" : "Full Logo"}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Using {brandIdentity.iconLogo ? "icon" : "full"} logo (only one available)
                          </p>
                        )}
                        {/* Logo Size Slider */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Logo Size</span>
                            <span className="text-xs font-medium text-brand-600">{logoSizePercent}%</span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={35}
                            step={1}
                            value={logoSizePercent}
                            onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand-500 bg-muted"
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Small</span>
                            <span>Large</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Social Icons & Brand Name Row */}
                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Social Icons */}
                      <div className="space-y-2.5">
                        <Label className="text-sm font-medium text-muted-foreground">Social Media</Label>
                        <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${showSocialIcons ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                          <input
                            type="checkbox"
                            checked={showSocialIcons}
                            onChange={(e) => setShowSocialIcons(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                          />
                          <div>
                            <span className="text-sm font-medium">Show Social Icons</span>
                            <span className="block text-xs text-muted-foreground">Include social media handles in design</span>
                          </div>
                        </label>

                        {showSocialIcons && Object.keys(brandIdentity.handles || {}).filter(k => brandIdentity.handles[k as keyof SocialHandles]).length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(["instagram", "twitter", "facebook", "linkedin", "tiktok", "youtube"] as const).map((platform) => {
                              const handle = brandIdentity.handles[platform];
                              if (!handle) return null;
                              const isSelected = selectedSocialPlatforms.has(platform);
                              return (
                                <label
                                  key={platform}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                    isSelected ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedSocialPlatforms);
                                      if (e.target.checked) {
                                        newSet.add(platform);
                                      } else {
                                        newSet.delete(platform);
                                      }
                                      setSelectedSocialPlatforms(newSet);
                                    }}
                                    className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                                  />
                                  <span className="text-xs font-medium capitalize">{platform === "twitter" ? "X" : platform}</span>
                                  <span className="text-[10px] text-muted-foreground">@{handle}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        {showSocialIcons && Object.keys(brandIdentity.handles || {}).filter(k => brandIdentity.handles[k as keyof SocialHandles]).length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No social handles configured in your brand kit</p>
                        )}
                      </div>
                    </div>

                    {/* Contact Info */}
                    {(brandIdentity.email || brandIdentity.phone || brandIdentity.website || brandIdentity.address) && (
                      <div className="space-y-2.5">
                        <Label className="text-sm font-medium text-muted-foreground">Include Contact Info</Label>
                        <div className="flex flex-wrap gap-2">
                          {brandIdentity.email && (
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${includeInDesign.email ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                              <input
                                type="checkbox"
                                checked={includeInDesign.email}
                                onChange={(e) => setIncludeInDesign((prev) => ({ ...prev, email: e.target.checked }))}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs">Email</span>
                            </label>
                          )}
                          {brandIdentity.phone && (
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${includeInDesign.phone ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                              <input
                                type="checkbox"
                                checked={includeInDesign.phone}
                                onChange={(e) => setIncludeInDesign((prev) => ({ ...prev, phone: e.target.checked }))}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs">Phone</span>
                            </label>
                          )}
                          {brandIdentity.website && (
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${includeInDesign.website ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                              <input
                                type="checkbox"
                                checked={includeInDesign.website}
                                onChange={(e) => setIncludeInDesign((prev) => ({ ...prev, website: e.target.checked }))}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs">Website</span>
                            </label>
                          )}
                          {brandIdentity.address && (
                            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${includeInDesign.address ? "border-brand-500 bg-brand-500/5" : "bg-muted/50 hover:bg-muted"}`}>
                              <input
                                type="checkbox"
                                checked={includeInDesign.address}
                                onChange={(e) => setIncludeInDesign((prev) => ({ ...prev, address: e.target.checked }))}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="text-xs">Address</span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* ═══ Generate Button + Provider ═══ */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as ImageProvider)}>
                    <SelectTrigger className="w-[140px] h-12 rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {([
                        { id: "xai" as ImageProvider, label: "Grok (xAI)" },
                        { id: "openai" as ImageProvider, label: "OpenAI (GPT)" },
                        { id: "gemini" as ImageProvider, label: "Gemini (Google)" },
                      ]).map((prov) => {
                        const compatible = selectedSize
                          ? getProvidersForPreset(selectedSize.width, selectedSize.height).includes(prov.id)
                          : true;
                        return (
                          <SelectItem key={prov.id} value={prov.id} disabled={!compatible}>
                            {prov.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="flex-1 bg-brand-500 hover:bg-brand-600 h-12 rounded-2xl text-base font-semibold"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        Generate Design
                        <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0 text-xs">
                          {designCreditCost} credits
                        </Badge>
                      </>
                    )}
                  </Button>
                </div>
                {brandIdentity && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Palette className="w-4 h-4 text-brand-500" />
                    <span>
                      Using <strong>{brandIdentity.name}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Generated Design Preview ─── */}
          {generatedDesign && (
            <Card className="rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generated Design</CardTitle>
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
                  {generatedDesign.imageUrl && (
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPng(generatedDesign)}
                      title="Download as PNG (image)"
                    >
                      <FileImage className="w-4 h-4 mr-1" />
                      PNG
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {(isGenerating || isEditing) ? (
                  <div className="py-4">
                    <AIGenerationLoader
                      currentStep={isEditing ? "Editing your design..." : "Regenerating your design..."}
                      subtitle={isEditing ? "AI is applying your changes" : "AI is creating a new version"}
                    />
                  </div>
                ) : generatedDesign.status === "COMPLETED" && generatedDesign.imageUrl ? (
                  <div className="space-y-4">
                    <div
                      className="rounded-xl overflow-hidden border bg-muted/30 flex items-center justify-center relative group cursor-pointer"
                      onClick={() => setPreviewDesign(generatedDesign)}
                    >
                      <img
                        src={generatedDesign.imageUrl}
                        alt={generatedDesign.prompt}
                        className="max-w-full max-h-[500px] object-contain"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center rounded-lg">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{generatedDesign.category.replace("_", " ")}</Badge>
                      <Badge variant="outline">{generatedDesign.size}</Badge>
                      {generatedDesign.style && (
                        <Badge variant="outline">{generatedDesign.style}</Badge>
                      )}
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                        AI Generated
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-xl">
                      <strong>Prompt:</strong> {generatedDesign.prompt}
                    </p>

                    {/* ── Edit Design ── */}
                    <div className="space-y-2.5 pt-3 border-t border-border/50">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <PenLine className="w-4 h-4 text-brand-500" />
                        Edit This Design
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Describe what to change — e.g. &quot;change headline to Summer Sale&quot;, &quot;make background blue&quot;, &quot;remove the person&quot;
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editInstruction}
                          onChange={(e) => setEditInstruction(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && editInstruction.trim()) handleEditDesign(); }}
                          placeholder="What would you like to change?"
                          maxLength={300}
                          disabled={isEditing}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-muted-foreground/50 disabled:opacity-50"
                        />
                        <Button
                          onClick={handleEditDesign}
                          disabled={isEditing || !editInstruction.trim()}
                          className="bg-brand-500 hover:bg-brand-600 rounded-xl px-5"
                        >
                          {isEditing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Creating your design...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Post to Feed / Social ─── */}
          {generatedDesign && generatedDesign.status === "COMPLETED" && generatedDesign.imageUrl && (
            <PostSharePanel
              mediaUrl={generatedDesign.imageUrl}
              mediaType="image"
              prompt={generatedDesign.prompt}
            />
          )}
        </div>
      ) : (
        /* ═══ Gallery View ═══ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Design Gallery</h2>
            <div className="flex gap-2 flex-wrap">
              {DESIGN_CATEGORIES.map((cat) => (
                <Button
                  key={cat.id}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    // TODO: Filter by category
                  }}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingDesigns ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : recentDesigns.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="p-8 text-center">
                <Image className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="font-medium">No designs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Switch to Create view to generate your first design
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setActiveView("create")}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Create Design
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {recentDesigns.map((design) => (
                <motion.div
                  key={design.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer rounded-2xl">
                    <div
                      className="aspect-square bg-white flex items-center justify-center overflow-hidden relative"
                      onClick={() => setPreviewDesign(design)}
                    >
                      {design.imageUrl ? (
                        <img
                          src={design.imageUrl}
                          alt={design.prompt}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Image className="w-8 h-8 text-muted-foreground" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs truncate">{design.prompt}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {design.category.replace("_", " ")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {design.size}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Hover Actions */}
                  {design.imageUrl && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPng(design);
                        }}
                        title="Download PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Background Remover Dialog */}
      <BackgroundRemover
        imageUrl={bgRemoverImageUrl}
        open={bgRemoverOpen}
        onClose={() => setBgRemoverOpen(false)}
        onComplete={(processedUrl) => {
          // Replace the first exact image with the processed one
          setExactImageUrls((prev) => [processedUrl, ...prev.slice(1)]);
          setBgRemoverOpen(false);
        }}
      />

      {/* Large Preview Modal */}
      <Dialog open={!!previewDesign} onOpenChange={(open) => !open && setPreviewDesign(null)}>
        <DialogContent className="max-w-3xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-brand-500" />
              Design Preview
            </DialogTitle>
          </DialogHeader>
          {previewDesign && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-white overflow-hidden flex items-center justify-center" style={{ maxHeight: "60vh" }}>
                {previewDesign.imageUrl ? (
                  <img src={previewDesign.imageUrl} alt={previewDesign.prompt} className="max-w-full max-h-[55vh] object-contain" />
                ) : (
                  <div className="p-8 text-muted-foreground text-sm">No preview available</div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{previewDesign.category.replace("_", " ")}</Badge>
                <Badge variant="outline">{previewDesign.size}</Badge>
                {previewDesign.style && (
                  <Badge variant="outline">{previewDesign.style}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(previewDesign.createdAt).toLocaleDateString()}
                </span>
              </div>

              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-xl">
                <strong>Prompt:</strong> {previewDesign.prompt}
              </p>

              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    handleDownloadPng(previewDesign);
                  }}
                >
                  <FileImage className="w-4 h-4 mr-1" />
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGeneratedDesign(previewDesign);
                    setActiveView("create");
                    setPreviewDesign(null);
                  }}
                >
                  Open in Editor
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
