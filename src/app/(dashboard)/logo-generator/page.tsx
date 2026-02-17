"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import {
  Crown,
  Sparkles,
  Loader2,
  Download,
  RefreshCw,
  Zap,
  Palette,
  Check,
  ArrowLeft,
  Maximize2,
  X,
  Type,
  Shapes,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { useCreditCosts } from "@/hooks/use-credit-costs";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { LOGO_STYLES } from "@/lib/constants/logo-presets";

interface LogoDesign {
  id: string;
  label: string;
  style: string;
  imageUrl: string;
  variation: string;
}

export default function LogoGeneratorPage() {
  const { toast } = useToast();
  const { costs } = useCreditCosts("AI_LOGO_GENERATION");

  // Form state
  const [brandName, setBrandName] = useState("");
  const [tagline, setTagline] = useState("");
  const [industry, setIndustry] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("combination");
  const [logoType, setLogoType] = useState<"nameOnly" | "nameWithIcon" | "nameInIcon">("nameWithIcon");
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [colors, setColors] = useState({ primary: "#0ea5e9", secondary: "#8b5cf6", accent: "#f59e0b" });
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Generation state
  const [step, setStep] = useState<"input" | "loading" | "results">("input");
  const [logos, setLogos] = useState<LogoDesign[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string | null>(null);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [previewLogo, setPreviewLogo] = useState<LogoDesign | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingBrand, setIsSavingBrand] = useState(false);

  // Fetch brand identity
  const fetchData = useCallback(async () => {
    try {
      const [brandRes, studioRes] = await Promise.all([
        fetch("/api/brand"),
        fetch("/api/ai/studio"),
      ]);

      const brandData = await brandRes.json();
      const studioData = await studioRes.json();

      if (brandData.success && brandData.data?.brandKit) {
        const kit = brandData.data.brandKit;
        if (!brandName) setBrandName(kit.name || "");
        if (!tagline) setTagline(kit.tagline || "");
        if (!industry) setIndustry(kit.industry || "");
        if (kit.colors) {
          const c = typeof kit.colors === "string" ? JSON.parse(kit.colors) : kit.colors;
          if (c.primary || c.secondary || c.accent) {
            setColors({
              primary: c.primary || "#0ea5e9",
              secondary: c.secondary || "#8b5cf6",
              accent: c.accent || "#f59e0b",
            });
          }
        }
      }

      if (studioData.success) {
        setCreditsRemaining(studioData.data.stats?.creditsRemaining ?? 0);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate 3 logo concepts
  const handleGenerate = async () => {
    if (!brandName.trim()) {
      toast({ title: "Brand name is required", variant: "destructive" });
      return;
    }

    setStep("loading");
    setLogos([]);
    setSelectedLogoId(null);

    try {
      const res = await fetch("/api/ai/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          tagline: showSubtitle ? tagline : undefined,
          industry,
          style: selectedStyle,
          logoType,
          showSubtitle,
          colors,
          additionalNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "logo generation")) {
          setStep("input");
          return;
        }
        throw new Error(data.error?.message || "Generation failed");
      }

      setLogos(data.data.logos);
      setCreditsRemaining(data.data.creditsRemaining);
      emitCreditsUpdate(data.data.creditsRemaining);
      setStep("results");
      toast({ title: `${data.data.logos.length} logos generated!` });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
      setStep("input");
    }
  };

  const handleStartOver = () => {
    setStep("input");
    setLogos([]);
    setSelectedLogoId(null);
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleDownload = async (logo: LogoDesign) => {
    if (!logo.imageUrl) return;

    setIsDownloading(true);
    try {
      const response = await fetch(logo.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${brandName.toLowerCase().replace(/\s+/g, "-")}-logo-${logo.variation.toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Logo downloaded!" });
    } catch {
      toast({ title: "Failed to download logo", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      for (const logo of logos) {
        await handleDownload(logo);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between downloads
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSetAsBrandLogo = async (logo: LogoDesign, type: "icon" | "full") => {
    if (!logo.imageUrl) return;

    setIsSavingBrand(true);
    try {
      const payload: Record<string, unknown> = {
        name: brandName,
        tagline,
        industry,
        colors,
      };
      if (type === "icon") {
        payload.iconLogo = logo.imageUrl;
      } else {
        payload.logo = logo.imageUrl;
      }

      const res = await fetch("/api/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: type === "icon" ? "Set as icon logo!" : "Set as full logo!" });
      } else {
        throw new Error(data.error?.message);
      }
    } catch {
      toast({ title: "Failed to set brand logo", variant: "destructive" });
    } finally {
      setIsSavingBrand(false);
    }
  };

  const selectedLogo = logos.find((l) => l.id === selectedLogoId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            AI Logo Generator
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate professional logos with transparent backgrounds using AI
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
          <Zap className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-medium">{creditsRemaining} credits</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* INPUT STEP - Full width form */}
        {step === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6">
                {/* Brand Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-500" />
                    Brand Details
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Brand Name *</Label>
                      <Input
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        placeholder="e.g., FlowSmartly"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Industry</Label>
                      <Input
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g., SaaS, E-commerce, Technology"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo Style */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Logo Style</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {LOGO_STYLES.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setSelectedStyle(style.id)}
                        className={`relative text-left p-3 rounded-xl border-2 transition-all ${
                          selectedStyle === style.id
                            ? "border-brand-500 bg-brand-500/5"
                            : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                        }`}
                        title={style.description}
                      >
                        {selectedStyle === style.id && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <span className="text-sm font-medium">{style.label}</span>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {style.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Type */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Shapes className="w-5 h-5 text-brand-500" />
                    Logo Type
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: "nameOnly" as const,
                        label: "Name Only",
                        description: "Clean text-based logo, no icon",
                        icon: Type,
                      },
                      {
                        id: "nameWithIcon" as const,
                        label: "Name + Icon",
                        description: "Text with a separate icon/symbol",
                        icon: Shapes,
                      },
                      {
                        id: "nameInIcon" as const,
                        label: "Name in Icon",
                        description: "Text integrated into a shape or emblem",
                        icon: Square,
                      },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setLogoType(type.id)}
                        className={`relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                          logoType === type.id
                            ? "border-brand-500 bg-brand-500/5"
                            : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          logoType === type.id ? "bg-brand-500/20" : "bg-muted"
                        }`}>
                          <type.icon className={`w-5 h-5 ${logoType === type.id ? "text-brand-500" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{type.label}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                        </div>
                        {logoType === type.id && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Option */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Include Subtitle</h3>
                      <p className="text-sm text-muted-foreground">
                        Show your tagline below the logo name
                      </p>
                    </div>
                    <button
                      onClick={() => setShowSubtitle(!showSubtitle)}
                      className={`relative w-14 h-8 rounded-full transition-all ${
                        showSubtitle ? "bg-brand-500" : "bg-muted"
                      }`}
                    >
                      <div className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all ${
                        showSubtitle ? "left-7" : "left-1"
                      }`} />
                    </button>
                  </div>
                  {showSubtitle && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <Label>Subtitle Text</Label>
                      <Input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="e.g., Smart Marketing Solutions"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">
                        This text will appear below your brand name in the logo
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Colors */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="w-5 h-5 text-brand-500" />
                    Brand Colors
                  </h3>
                  <div className="flex flex-wrap items-center gap-6">
                    {(["primary", "secondary", "accent"] as const).map((key) => (
                      <div key={key} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={colors[key]}
                          onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                          className="w-12 h-12 rounded-lg cursor-pointer border-2 border-muted"
                        />
                        <div>
                          <span className="text-sm font-medium capitalize">{key}</span>
                          <p className="text-xs text-muted-foreground">{colors[key]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label>Additional Notes (Optional)</Label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="e.g., Include a leaf icon, use rounded shapes, modern minimalist feel..."
                    className="min-h-[100px]"
                    rows={3}
                  />
                </div>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={!brandName.trim()}
                  className="w-full h-14 text-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate 3 Logo Concepts ({costs.AI_LOGO_GENERATION ?? 30} credits)
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Creates 3 unique high-quality transparent PNG logos using AI
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* LOADING STEP */}
        {step === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-brand-500/20 rounded-2xl">
              <CardContent className="p-6">
                <AIGenerationLoader
                  currentStep={`Designing 3 unique logos for "${brandName}"`}
                  subtitle="Our AI is crafting your brand identity"
                />
                <div className="grid md:grid-cols-3 gap-6 mt-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="aspect-square rounded-2xl" />
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* RESULTS STEP */}
        {step === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleStartOver} size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
                <Button variant="outline" onClick={handleRegenerate} size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerate
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {logos.length} logos generated
                </Badge>
                <Button
                  onClick={handleDownloadAll}
                  disabled={isDownloading}
                  size="sm"
                >
                  {isDownloading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Download All
                </Button>
              </div>
            </div>

            {/* Logo Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              {logos.map((logo) => (
                <Card
                  key={logo.id}
                  className={`overflow-hidden transition-all cursor-pointer ${
                    selectedLogoId === logo.id
                      ? "ring-2 ring-brand-500 shadow-lg"
                      : "hover:shadow-md"
                  }`}
                  onClick={() => setSelectedLogoId(logo.id)}
                >
                  <div className="relative">
                    {/* Checkered background to show transparency */}
                    <div
                      className="aspect-square"
                      style={{
                        backgroundImage: `
                          linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                          linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                          linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                        `,
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      }}
                    >
                      <img
                        src={logo.imageUrl}
                        alt={`Logo ${logo.variation}`}
                        className="w-full h-full object-contain p-6"
                      />
                    </div>

                    {/* Selection indicator */}
                    {selectedLogoId === logo.id && (
                      <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                    )}

                    {/* Expand button */}
                    <button
                      className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewLogo(logo);
                      }}
                    >
                      <Maximize2 className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{logo.variation}</Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(logo);
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected Logo Actions */}
            {selectedLogo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-gradient-to-r from-brand-500/5 to-accent-purple/5 border-brand-500/20">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-16 h-16 rounded-xl overflow-hidden"
                          style={{
                            backgroundImage: `
                              linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                              linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                              linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                              linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)
                            `,
                            backgroundSize: '10px 10px',
                            backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                          }}
                        >
                          <img
                            src={selectedLogo.imageUrl}
                            alt="Selected logo"
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                        <div>
                          <h3 className="font-semibold">Selected: {selectedLogo.variation}</h3>
                          <p className="text-sm text-muted-foreground">
                            Ready to download or set as your brand logo
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleDownload(selectedLogo)}
                          disabled={isDownloading}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PNG
                        </Button>
                        <Button
                          onClick={() => handleSetAsBrandLogo(selectedLogo, "icon")}
                          disabled={isSavingBrand}
                          className="bg-brand-500 hover:bg-brand-600"
                        >
                          {isSavingBrand ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Crown className="w-4 h-4 mr-2" />
                          )}
                          Set as Icon Logo
                        </Button>
                        <Button
                          onClick={() => handleSetAsBrandLogo(selectedLogo, "full")}
                          disabled={isSavingBrand}
                          variant="outline"
                          className="border-brand-500/30 text-brand-600 hover:bg-brand-500/5"
                        >
                          <Crown className="w-4 h-4 mr-2" />
                          Set as Full Logo
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Dark background preview */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-3">Preview on Dark Background</h3>
                <div className="grid md:grid-cols-3 gap-4 p-6 rounded-xl bg-gray-900">
                  {logos.map((logo) => (
                    <div key={logo.id} className="aspect-square p-4">
                      <img
                        src={logo.imageUrl}
                        alt={`Logo ${logo.variation}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Large Preview Modal */}
      <Dialog open={!!previewLogo} onOpenChange={(open) => !open && setPreviewLogo(null)}>
        <DialogContent className="max-w-4xl w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                {previewLogo?.variation}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPreviewLogo(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewLogo && (
            <div className="space-y-6">
              {/* Large preview */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Light background */}
                <div
                  className="aspect-square rounded-xl p-8"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
                      linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
                      linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)
                    `,
                    backgroundSize: '30px 30px',
                    backgroundPosition: '0 0, 0 15px, 15px -15px, -15px 0px',
                  }}
                >
                  <img
                    src={previewLogo.imageUrl}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Dark background */}
                <div className="aspect-square rounded-xl bg-gray-900 p-8">
                  <img
                    src={previewLogo.imageUrl}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDownload(previewLogo)}
                  disabled={isDownloading}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
                <Button
                  onClick={() => {
                    handleSetAsBrandLogo(previewLogo, "icon");
                    setPreviewLogo(null);
                  }}
                  disabled={isSavingBrand}
                  className="bg-brand-500 hover:bg-brand-600"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Set as Icon Logo
                </Button>
                <Button
                  onClick={() => {
                    handleSetAsBrandLogo(previewLogo, "full");
                    setPreviewLogo(null);
                  }}
                  disabled={isSavingBrand}
                  variant="outline"
                  className="border-brand-500/30 text-brand-600 hover:bg-brand-500/5"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Set as Full Logo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
