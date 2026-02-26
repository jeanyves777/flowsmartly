"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Wand2,
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
  Eraser,
  Zap,
  Layers,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";
import { useCanvasExport } from "../hooks/use-canvas-export";
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
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium"
      >
        <Icon className={`w-3.5 h-3.5 ${isOpen ? "text-brand-500" : "text-muted-foreground"}`} />
        <span className="flex-1">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
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

export function AiPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const setCanvasDimensions = useCanvasStore((s) => s.setCanvasDimensions);
  const { getCanvasDataUrl } = useCanvasExport();

  // Generation state
  const [prompt, setPrompt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<DesignCategory>("social_post");
  const [selectedSize, setSelectedSize] = useState<SizePreset | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ImageProvider>("xai");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [heroType, setHeroType] = useState<"people" | "product" | "text-only">("people");
  const [textMode, setTextMode] = useState<"exact" | "creative">("creative");
  const [ctaText, setCtaText] = useState("");
  const [exactImageUrls, setExactImageUrls] = useState<string[]>([]);
  const [styleReferenceUrls, setStyleReferenceUrls] = useState<string[]>([]);

  // Brand
  const [brandIdentity, setBrandIdentity] = useState<BrandIdentity | null>(null);
  const [showBrandName, setShowBrandName] = useState(false);
  const [showSocialIcons, setShowSocialIcons] = useState(false);
  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<Set<string>>(new Set());
  const [logoType, setLogoType] = useState<"auto" | "icon" | "full">("auto");
  const [logoSizePercent, setLogoSizePercent] = useState(18);
  const [includeInDesign, setIncludeInDesign] = useState({
    email: false, phone: false, website: false, address: false,
  });

  // AI ideas
  const [isGeneratingIdeas, setIsGeneratingIdeas] = useState(false);
  const [aiIdeas, setAiIdeas] = useState<string[]>([]);

  // Loading states
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [designCreditCost, setDesignCreditCost] = useState(15);

  // Improve design
  const [improveInstruction, setImproveInstruction] = useState("");

  const [removingBg, setRemovingBg] = useState(false);

  // Active section
  const [activeSection, setActiveSection] = useState<"generate" | "improve" | "bgremove" | "text">("generate");

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

  // Fetch brand data
  useEffect(() => {
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
          const parsedHandles = typeof kit.handles === "string" ? JSON.parse(kit.handles || "{}") : (kit.handles || {});
          setBrandIdentity({
            id: kit.id, name: kit.name,
            logo: kit.logo || null, iconLogo: kit.iconLogo || null,
            colors: typeof kit.colors === "string" ? JSON.parse(kit.colors) : kit.colors,
            voiceTone: kit.voiceTone,
            email: kit.email || null, phone: kit.phone || null,
            website: kit.website || null, address: kit.address || null,
            handles: parsedHandles,
          });
          const platformsWithHandles = Object.keys(parsedHandles).filter((k: string) => parsedHandles[k]);
          if (platformsWithHandles.length > 0) setSelectedSocialPlatforms(new Set(platformsWithHandles));
        }
        if (studioData.success) setCreditsRemaining(studioData.data.stats?.creditsRemaining ?? 0);
        if (costsData.success && costsData.data?.costs?.AI_VISUAL_DESIGN) setDesignCreditCost(costsData.data.costs.AI_VISUAL_DESIGN);
      } catch { /* silently */ }
    })();
  }, []);

  // ─── Generate Ideas ───
  const handleGenerateIdeas = async () => {
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
  };

  // ─── Generate Design → add to canvas ───
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
          brandLogo: logoType === "icon" ? (brandIdentity?.iconLogo || brandIdentity?.logo)
            : logoType === "full" ? (brandIdentity?.logo || brandIdentity?.iconLogo)
            : (brandIdentity?.logo || brandIdentity?.iconLogo),
          logoSizePercent,
          brandName: showBrandName ? brandIdentity?.name : null,
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
          templateImageUrl: styleReferenceUrls[0] || null,
          referenceImageUrl: exactImageUrls[0] || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "visual design")) return;
        throw new Error(data.error?.message || "Generation failed");
      }

      // Add generated image to canvas
      if (data.data?.design?.imageUrl && canvas) {
        // Optionally resize canvas to match generated size
        const [w, h] = (data.data.design.size || "").split("x").map(Number);
        if (w && h && (w !== canvasWidth || h !== canvasHeight)) {
          setCanvasDimensions(w, h);
        }
        const fabric = await import("fabric");
        await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
      }

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      toast({ title: "Design generated and added to canvas!" });
    } catch (e) {
      toast({ title: "Generation failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── AI Improve (export canvas → edit) ───
  const handleImprove = async () => {
    if (!improveInstruction.trim()) {
      toast({ title: "Please describe how to improve the design", variant: "destructive" });
      return;
    }
    if (!canvas) return;

    setIsImproving(true);
    try {
      // Export canvas as data URL
      const dataUrl = getCanvasDataUrl("png", 1);
      if (!dataUrl) throw new Error("Failed to export canvas");

      // Convert data URL to blob and upload
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("file", blob, "canvas-export.png");
      formData.append("tags", JSON.stringify(["studio-export"]));

      const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error("Upload failed");

      const imageUrl = uploadData.data.file.url;

      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: improveInstruction.trim(),
          category: selectedCategory,
          size: `${canvasWidth}x${canvasHeight}`,
          style: selectedStyle,
          provider: selectedProvider,
          heroType,
          textMode: "exact",
          editImageUrl: imageUrl,
          brandLogo: logoType === "icon" ? (brandIdentity?.iconLogo || brandIdentity?.logo)
            : logoType === "full" ? (brandIdentity?.logo || brandIdentity?.iconLogo)
            : (brandIdentity?.logo || brandIdentity?.iconLogo),
          logoSizePercent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "visual design")) return;
        throw new Error(data.error?.message || "Improvement failed");
      }

      if (data.data?.design?.imageUrl && canvas) {
        const fabric = await import("fabric");
        await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
      }

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      setImproveInstruction("");
      toast({ title: "Design improved!" });
    } catch (e) {
      toast({ title: "Improvement failed", description: e instanceof Error ? e.message : "Try again", variant: "destructive" });
    } finally {
      setIsImproving(false);
    }
  };

  // ─── Remove BG from selected image ───
  const handleRemoveBg = async () => {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj || obj.type !== "image") {
      toast({ title: "Select an image first", variant: "destructive" });
      return;
    }
    const src = obj.getSrc?.() || obj._element?.src;
    if (!src) {
      toast({ title: "Cannot read image source", variant: "destructive" });
      return;
    }

    setRemovingBg(true);
    try {
      let imageUrl = src;

      // If data URL or blob URL, upload first
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        const blob = await fetch(src).then((r) => r.blob());
        const formData = new FormData();
        formData.append("file", blob, "bg-remove-input.png");
        formData.append("tags", JSON.stringify(["studio-bg-remove"]));
        const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) throw new Error("Upload failed");
        imageUrl = uploadData.data.file.url;
      }

      const res = await fetch("/api/image-tools/remove-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Failed");

      if (data.data?.imageUrl) {
        const fabric = await import("fabric");
        const newImg = await fabric.FabricImage.fromURL(data.data.imageUrl, { crossOrigin: "anonymous" });
        if (newImg) {
          newImg.set({
            left: obj.left, top: obj.top,
            scaleX: obj.scaleX, scaleY: obj.scaleY,
            angle: obj.angle,
          });
          (newImg as any).id = (obj as any).id;
          (newImg as any).customName = "Image (No BG)";
          canvas.remove(obj);
          canvas.add(newImg);
          canvas.setActiveObject(newImg);
          canvas.renderAll();
        }
        toast({ title: "Background removed!" });
      }
    } catch (e) {
      toast({
        title: "Background removal failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setRemovingBg(false);
    }
  };

  const currentCategory = DESIGN_CATEGORIES.find((c) => c.id === selectedCategory)!;

  return (
    <div className="p-3 space-y-4 text-sm">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-brand-500" />
        AI Tools
      </h3>

      {/* Section tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
        {[
          { id: "generate" as const, label: "Generate", icon: Sparkles },
          { id: "improve" as const, label: "Improve", icon: Wand2 },
          { id: "bgremove" as const, label: "BG Remove", icon: Eraser },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
              activeSection === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3 w-3" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ SECTION A: AI Generate ═══ */}
      {activeSection === "generate" && (
        <div className="space-y-3">
          {/* Prompt input + Ideas */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Describe your design</Label>
              <div className="flex items-center gap-1">
                <AIIdeasHistory
                  contentType="DESIGN_IDEAS"
                  onSelect={(idea) => setPrompt(idea)}
                  className="text-[10px]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={handleGenerateIdeas}
                  disabled={isGeneratingIdeas}
                >
                  {isGeneratingIdeas ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  Ideas
                </Button>
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A vibrant Instagram post announcing a new product launch"
              className="w-full min-h-[80px] p-2 text-xs border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 bg-background"
            />
            {/* Ideas suggestions */}
            {aiIdeas.length > 0 && (
              <div className="mt-2 space-y-1">
                {aiIdeas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => { setPrompt(idea); setAiIdeas([]); }}
                    className="w-full text-left p-2 text-[11px] rounded border hover:border-brand-500 hover:bg-brand-500/5 transition-colors line-clamp-2"
                  >
                    {idea}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Design Type & Size */}
          <CollapsibleSection title="Design Type & Size" icon={Layers} defaultOpen>
            {/* Category */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Category</Label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {DESIGN_CATEGORIES.map((cat) => {
                  const CatIcon = categoryIcons[cat.id] || ImageIcon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id as DesignCategory)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded text-[10px] border transition-colors ${
                        selectedCategory === cat.id
                          ? "border-brand-500 bg-brand-500/10 text-brand-600"
                          : "border-transparent hover:bg-muted"
                      }`}
                    >
                      <CatIcon className="h-3.5 w-3.5" />
                      {cat.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Preset */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Size Preset</Label>
              <div className="space-y-0.5 mt-1">
                {currentCategory?.presets.map((preset) => {
                  const providers = getProvidersForPreset(preset.width, preset.height);
                  const compatible = providers.includes(selectedProvider);
                  return (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setSelectedSize(preset);
                        setCanvasDimensions(preset.width, preset.height);
                      }}
                      disabled={!compatible}
                      className={`w-full flex justify-between items-center px-2 py-1 rounded text-[11px] transition-colors ${
                        selectedSize?.name === preset.name
                          ? "bg-brand-500/10 text-brand-600 border border-brand-500"
                          : compatible
                          ? "hover:bg-muted border border-transparent"
                          : "opacity-40 cursor-not-allowed border border-transparent"
                      }`}
                    >
                      <span>{preset.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
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
              <Label className="text-[10px] text-muted-foreground">Visual Style</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {DESIGN_STYLES.map((style) => (
                  <Badge
                    key={style.id}
                    variant={selectedStyle === style.id ? "default" : "outline"}
                    className="cursor-pointer text-[10px]"
                    onClick={() => setSelectedStyle(style.id)}
                  >
                    {style.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Visual Focus */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Visual Focus</Label>
              <div className="flex gap-1 mt-1">
                {[
                  { id: "people" as const, icon: User, label: "People" },
                  { id: "product" as const, icon: Package, label: "Product" },
                  { id: "text-only" as const, icon: Type, label: "Text Only" },
                ].map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setHeroType(h.id)}
                    className={`flex-1 flex flex-col items-center gap-1 p-2 rounded border text-[10px] transition-colors ${
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
              <Label className="text-[10px] text-muted-foreground">Text Mode</Label>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => setTextMode("creative")}
                  className={`flex-1 p-2 rounded border text-[10px] text-center transition-colors ${
                    textMode === "creative" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-300"
                  }`}
                >
                  AI Creative
                </button>
                <button
                  onClick={() => setTextMode("exact")}
                  className={`flex-1 p-2 rounded border text-[10px] text-center transition-colors ${
                    textMode === "exact" ? "border-brand-500 bg-brand-500/10" : "border-border hover:border-brand-300"
                  }`}
                >
                  Use My Text
                </button>
              </div>
            </div>

            {/* CTA */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Call to Action (optional)</Label>
              <Input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder='e.g. "Shop Now", "Book Today"'
                className="h-7 text-xs mt-1"
              />
            </div>

            {/* Style Reference */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Style Reference</Label>
              <MediaUploader
                value={styleReferenceUrls}
                onChange={setStyleReferenceUrls}
                maxFiles={1}
                accept="image/*"
              />
            </div>

            {/* Exact Image */}
            <div>
              <Label className="text-[10px] text-muted-foreground">Exact Image</Label>
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
            <Label className="text-[10px] text-muted-foreground">AI Provider</Label>
            <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v as ImageProvider)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI (gpt-image-1)</SelectItem>
                <SelectItem value="xai">Grok (xAI)</SelectItem>
                <SelectItem value="gemini">Gemini (Google)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Brand & Contact */}
          <CollapsibleSection title="Brand & Contact Info" icon={Building2}>
            {brandIdentity ? (
              <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground">
                  Using <span className="font-medium text-foreground">{brandIdentity.name}</span>
                </div>

                {/* Logo */}
                <div>
                  <Label className="text-[10px] text-muted-foreground">Logo Display</Label>
                  <div className="flex gap-1 mt-1">
                    {(["auto", "icon", "full"] as const).map((lt) => (
                      <button
                        key={lt}
                        onClick={() => setLogoType(lt)}
                        className={`flex-1 p-1.5 rounded border text-[10px] capitalize transition-colors ${
                          logoType === lt ? "border-brand-500 bg-brand-500/10" : "border-border"
                        }`}
                      >
                        {lt === "auto" ? "Auto" : lt === "icon" ? "Icon Logo" : "Full Logo"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Size */}
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Logo Size</span>
                    <span>{logoSizePercent}%</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={35}
                    value={logoSizePercent}
                    onChange={(e) => setLogoSizePercent(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-brand-500"
                  />
                </div>

                {/* Brand Name */}
                <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBrandName}
                    onChange={(e) => setShowBrandName(e.target.checked)}
                    className="accent-brand-500"
                  />
                  Show Brand Name
                </label>

                {/* Social Icons */}
                {Object.keys(brandIdentity.handles).some((k) => brandIdentity.handles[k as keyof SocialHandles]) && (
                  <label className="flex items-center gap-2 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSocialIcons}
                      onChange={(e) => setShowSocialIcons(e.target.checked)}
                      className="accent-brand-500"
                    />
                    Show Social Icons
                  </label>
                )}

                {/* Contact */}
                <div>
                  <Label className="text-[10px] text-muted-foreground">Include Contact Info</Label>
                  <div className="space-y-1 mt-1">
                    {[
                      { key: "email" as const, icon: Mail, label: "Email", value: brandIdentity.email },
                      { key: "phone" as const, icon: Phone, label: "Phone", value: brandIdentity.phone },
                      { key: "website" as const, icon: Globe, label: "Website", value: brandIdentity.website },
                      { key: "address" as const, icon: MapPin, label: "Address", value: brandIdentity.address },
                    ]
                      .filter((c) => c.value)
                      .map((c) => (
                        <label key={c.key} className="flex items-center gap-2 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeInDesign[c.key]}
                            onChange={(e) =>
                              setIncludeInDesign((prev) => ({ ...prev, [c.key]: e.target.checked }))
                            }
                            className="accent-brand-500"
                          />
                          <c.icon className="h-3 w-3 text-muted-foreground" />
                          {c.label}
                        </label>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Set up your brand in Settings to include logo, colors, and contact info.
              </p>
            )}
          </CollapsibleSection>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full gap-2"
            size="sm"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? "Generating..." : `Generate Design`}
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {designCreditCost} credits
            </Badge>
          </Button>
          {brandIdentity && (
            <p className="text-[10px] text-muted-foreground text-center">
              Using {brandIdentity.name}
            </p>
          )}
        </div>
      )}

      {/* ═══ SECTION B: AI Improve ═══ */}
      {activeSection === "improve" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Export your canvas and let AI improve it. The result will be added as a new layer.
          </p>

          <div className="flex flex-wrap gap-1">
            {["Make it more professional", "Improve colors", "Fix layout", "Add visual flair"].map((q) => (
              <Badge
                key={q}
                variant="outline"
                className="cursor-pointer text-[10px] hover:bg-brand-500/10"
                onClick={() => setImproveInstruction(q)}
              >
                {q}
              </Badge>
            ))}
          </div>

          <textarea
            value={improveInstruction}
            onChange={(e) => setImproveInstruction(e.target.value)}
            placeholder="Describe how to improve your design..."
            className="w-full min-h-[60px] p-2 text-xs border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 bg-background"
          />

          <Button
            onClick={handleImprove}
            disabled={isImproving || !improveInstruction.trim()}
            className="w-full gap-2"
            size="sm"
          >
            {isImproving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {isImproving ? "Improving..." : "Improve Design"}
          </Button>
        </div>
      )}

      {/* ═══ SECTION C: BG Remove ═══ */}
      {activeSection === "bgremove" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Select an image on the canvas, then click the button to remove its background.
          </p>
          <Button
            onClick={handleRemoveBg}
            className="w-full gap-2"
            size="sm"
            variant="outline"
            disabled={removingBg}
          >
            {removingBg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
            {removingBg ? "Removing..." : "Remove Background"}
          </Button>
        </div>
      )}
    </div>
  );
}
