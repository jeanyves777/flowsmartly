"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  Building2,
  Users,
  Target,
  Megaphone,
  BarChart3,
  Mail,
  PenTool,
  Globe,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Swords,
  Info,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

// --- Types ---

interface BrandKit {
  name: string;
  logo?: string;
  tagline?: string;
  description?: string;
  industry?: string;
  niche?: string;
  targetAudience?: string;
  audienceAge?: string;
  audienceLocation?: string;
  voiceTone?: string;
  personality: string[];
  keywords: string[];
  hashtags: string[];
  products: string[];
  uniqueValue?: string;
  handles: Record<string, string>;
  guidelines?: string;
}

type Timeframe = "1_MONTH" | "3_MONTHS" | "6_MONTHS";
type FocusArea = "content" | "social" | "ads" | "email" | "analytics";

interface FormState {
  goals: string;
  timeframe: Timeframe;
  focusAreas: FocusArea[];
  platforms: string[];
  additionalContext: string;
  competitorInfo: string;
  budget: string;
  showAdvanced: boolean;
}

// --- Constants ---

const FOCUS_AREAS: { id: FocusArea; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "content", label: "Content", icon: <PenTool className="h-4 w-4" />, description: "Blog posts, articles, guides" },
  { id: "social", label: "Social Media", icon: <Megaphone className="h-4 w-4" />, description: "Posts, stories, reels" },
  { id: "ads", label: "Advertising", icon: <DollarSign className="h-4 w-4" />, description: "Paid ads, campaigns" },
  { id: "email", label: "Email", icon: <Mail className="h-4 w-4" />, description: "Newsletters, sequences" },
  { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" />, description: "Tracking, reporting, KPIs" },
];

const PLATFORMS = [
  "Instagram", "Facebook", "Twitter/X", "LinkedIn", "TikTok",
  "YouTube", "Pinterest", "Blog", "Email",
];

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string; description: string }[] = [
  { value: "1_MONTH", label: "1 Month", description: "Quick sprint" },
  { value: "3_MONTHS", label: "3 Months", description: "Standard quarter" },
  { value: "6_MONTHS", label: "6 Months", description: "Long-term plan" },
];

const GENERIC_GOAL_PRESETS = [
  "Increase brand awareness and reach",
  "Drive more website traffic",
  "Generate leads and conversions",
  "Build community engagement",
  "Launch a new product or service",
  "Grow social media following",
  "Improve customer retention",
  "Establish thought leadership",
];

const HANDLE_TO_PLATFORM: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const GENERATION_STAGES = [
  { label: "Analyzing brand identity...", duration: 3000 },
  { label: "Creating strategy framework...", duration: 4000 },
  { label: "Generating tasks...", duration: 5000 },
  { label: "Finalizing plan...", duration: 3000 },
];

const DEFAULT_FORM: FormState = {
  goals: "",
  timeframe: "3_MONTHS",
  focusAreas: ["content", "social", "ads", "email", "analytics"],
  platforms: [],
  additionalContext: "",
  competitorInfo: "",
  budget: "",
  showAdvanced: false,
};

// --- Component ---

export default function GenerateStrategyPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [brand, setBrand] = useState<BrandKit | null>(null);
  const [isBrandLoading, setIsBrandLoading] = useState(true);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState(0);
  const [generationDone, setGenerationDone] = useState(false);
  const [brandExpanded, setBrandExpanded] = useState(false);

  // Load brand identity
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/brand");
        const data = await res.json();
        if (data.success && data.data?.brandKit) {
          const b = data.data.brandKit;
          setBrand({
            name: b.name || "",
            logo: b.iconLogo || b.logo || undefined,
            tagline: b.tagline || undefined,
            description: b.description || undefined,
            industry: b.industry || undefined,
            niche: b.niche || undefined,
            targetAudience: b.targetAudience || undefined,
            audienceAge: b.audienceAge || undefined,
            audienceLocation: b.audienceLocation || undefined,
            voiceTone: b.voiceTone || undefined,
            personality: Array.isArray(b.personality) ? b.personality : [],
            keywords: Array.isArray(b.keywords) ? b.keywords : [],
            hashtags: Array.isArray(b.hashtags) ? b.hashtags : [],
            products: Array.isArray(b.products) ? b.products : [],
            uniqueValue: b.uniqueValue || undefined,
            handles: typeof b.handles === "object" && b.handles ? b.handles : {},
            guidelines: b.guidelines || undefined,
          });
        }
      } catch {
        // Brand not set up — user can still generate with just goals
      } finally {
        setIsBrandLoading(false);
      }
    })();
  }, []);

  // Generation stage timer
  useEffect(() => {
    if (!isGenerating) {
      setGenerationStage(0);
      return;
    }
    const timers: NodeJS.Timeout[] = [];
    let accumulated = 0;
    GENERATION_STAGES.forEach((stage, i) => {
      if (i === 0) return;
      accumulated += GENERATION_STAGES[i - 1].duration;
      timers.push(setTimeout(() => setGenerationStage(i), accumulated));
    });
    return () => timers.forEach(clearTimeout);
  }, [isGenerating]);

  // Brand completeness score
  const brandCompleteness = useMemo(() => {
    if (!brand) return 0;
    const fields = [
      brand.name,
      brand.industry,
      brand.niche,
      brand.targetAudience,
      brand.voiceTone,
      brand.uniqueValue,
      brand.products.length > 0,
      brand.keywords.length > 0,
      brand.description,
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [brand]);

  // Active social handles
  const activeHandles = useMemo(() => {
    if (!brand?.handles) return [];
    return Object.entries(brand.handles)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }, [brand]);

  // Brand-specific goal presets
  const goalPresets = useMemo(() => {
    if (!brand) return GENERIC_GOAL_PRESETS;
    const presets: string[] = [];
    const name = brand.name;

    if (brand.products.length > 0) {
      presets.push(`Promote ${name}'s ${brand.products[0]} to new customers`);
      if (brand.products.length > 1) {
        presets.push(`Cross-sell ${brand.products.slice(0, 2).join(" & ")} to existing audience`);
      }
    }
    if (brand.targetAudience) {
      presets.push(`Grow ${name}'s reach among ${brand.targetAudience}`);
    }
    if (brand.niche) {
      presets.push(`Become the go-to brand in ${brand.niche}`);
    }
    if (brand.industry) {
      presets.push(`Establish ${name} as a thought leader in ${brand.industry}`);
    }
    if (activeHandles.length > 0) {
      const topPlatform = HANDLE_TO_PLATFORM[activeHandles[0]] || activeHandles[0];
      presets.push(`Grow ${name}'s ${topPlatform} following by 50%`);
    }
    if (brand.uniqueValue) {
      presets.push(`Highlight ${name}'s unique value: ${brand.uniqueValue.length > 60 ? brand.uniqueValue.slice(0, 57) + "..." : brand.uniqueValue}`);
    }

    // Pad with generic presets if we have fewer than 6
    const genericFallbacks = GENERIC_GOAL_PRESETS.filter(
      (g) => !presets.some((p) => p.toLowerCase().includes(g.split(" ").slice(0, 3).join(" ").toLowerCase()))
    );
    while (presets.length < 6 && genericFallbacks.length > 0) {
      presets.push(genericFallbacks.shift()!);
    }

    return presets;
  }, [brand, activeHandles]);

  // Recommended platforms from brand handles
  const recommendedPlatforms = useMemo(() => {
    return activeHandles
      .map((h) => HANDLE_TO_PLATFORM[h])
      .filter(Boolean);
  }, [activeHandles]);

  // Auto-select platforms from brand handles on first load
  const [platformsInitialized, setPlatformsInitialized] = useState(false);
  useEffect(() => {
    if (brand && !platformsInitialized && recommendedPlatforms.length > 0) {
      setPlatformsInitialized(true);
      setForm((f) => ({
        ...f,
        platforms: [...new Set([...f.platforms, ...recommendedPlatforms])],
      }));
    }
  }, [brand, platformsInitialized, recommendedPlatforms]);

  // Competitor suggestion based on brand
  const competitorSuggestion = useMemo(() => {
    if (!brand) return "";
    const parts: string[] = [];
    if (brand.industry && brand.niche) {
      parts.push(`Our main competitors in the ${brand.niche} space within ${brand.industry}`);
    } else if (brand.industry) {
      parts.push(`Our main competitors in the ${brand.industry} industry`);
    }
    if (brand.uniqueValue) {
      parts.push(`We differentiate through: ${brand.uniqueValue}`);
    }
    if (brand.products.length > 0) {
      parts.push(`Our key offerings: ${brand.products.join(", ")}`);
    }
    return parts.join(". ") + (parts.length > 0 ? "." : "");
  }, [brand]);

  // Budget suggestions based on industry
  const budgetSuggestions = useMemo(() => {
    if (!brand) return [];
    const suggestions = ["Organic only (no paid budget)"];
    if (brand.industry) {
      suggestions.push(`$500/month for ${brand.industry} ads`);
      suggestions.push(`$1,000/month mixed budget`);
    } else {
      suggestions.push("$500/month for paid ads");
      suggestions.push("$1,000/month mixed budget");
    }
    return suggestions;
  }, [brand]);

  // Additional context suggestions
  const contextSuggestions = useMemo(() => {
    if (!brand) return [];
    const suggestions: string[] = [];
    if (brand.products.length > 0) {
      suggestions.push(`Planning to launch new products alongside ${brand.products[0]}`);
    }
    if (brand.targetAudience && brand.audienceLocation) {
      suggestions.push(`Focusing on ${brand.audienceLocation} market for ${brand.targetAudience}`);
    }
    if (brand.voiceTone) {
      suggestions.push(`All content should maintain our ${brand.voiceTone} voice`);
    }
    if (brand.keywords.length > 0) {
      suggestions.push(`Key themes to weave in: ${brand.keywords.slice(0, 3).join(", ")}`);
    }
    return suggestions;
  }, [brand]);

  // Toggle focus area
  const toggleFocusArea = (area: FocusArea) => {
    setForm((f) => ({
      ...f,
      focusAreas: f.focusAreas.includes(area)
        ? f.focusAreas.filter((a) => a !== area)
        : [...f.focusAreas, area],
    }));
  };

  // Toggle platform
  const togglePlatform = (platform: string) => {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(platform)
        ? f.platforms.filter((p) => p !== platform)
        : [...f.platforms, platform],
    }));
  };

  // Add goal preset
  const addGoalPreset = (preset: string) => {
    setForm((f) => ({
      ...f,
      goals: f.goals ? `${f.goals}\n${preset}` : preset,
    }));
  };

  // Generate
  const handleGenerate = async () => {
    if (!form.goals.trim()) {
      toast({ title: "Please describe your goals", variant: "destructive" });
      return;
    }
    if (form.focusAreas.length === 0) {
      toast({ title: "Select at least one focus area", variant: "destructive" });
      return;
    }

    try {
      setIsGenerating(true);
      const res = await fetch("/api/content/strategy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goals: form.goals,
          timeframe: form.timeframe,
          focusAreas: form.focusAreas,
          platforms: form.platforms.length > 0 ? form.platforms : undefined,
          additionalContext: form.additionalContext || undefined,
          competitorInfo: form.competitorInfo || undefined,
          budget: form.budget || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || "Generation failed");

      setGenerationDone(true);
      await new Promise((r) => setTimeout(r, 1500));
      router.push("/content/strategy");
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to generate strategy",
        variant: "destructive",
      });
      setIsGenerating(false);
      setGenerationDone(false);
    }
  };

  // Full-screen generation overlay
  if (isGenerating) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8 max-w-md mx-auto px-6"
        >
          <AnimatePresence mode="wait">
            {!generationDone ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Animated spinner */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-purple-500 p-1"
                >
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                    <Sparkles className="w-10 h-10 text-orange-500" />
                  </div>
                </motion.div>

                {/* Stage text */}
                <AnimatePresence mode="wait">
                  <motion.p
                    key={generationStage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-xl font-semibold"
                  >
                    {GENERATION_STAGES[generationStage]?.label}
                  </motion.p>
                </AnimatePresence>

                {/* Progress dots */}
                <div className="flex items-center justify-center gap-2">
                  {GENERATION_STAGES.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        scale: i === generationStage ? [1, 1.3, 1] : 1,
                      }}
                      transition={{ duration: 0.5, repeat: i === generationStage ? Infinity : 0, repeatDelay: 0.5 }}
                      className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
                        i <= generationStage ? "bg-orange-500" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {/* Brand context */}
                {brand && (
                  <p className="text-sm text-muted-foreground">
                    Crafting a personalized strategy for <strong>{brand.name}</strong>
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                </motion.div>
                <p className="text-2xl font-bold text-green-600">Strategy Generated!</p>
                <p className="text-sm text-muted-foreground">Redirecting to your strategy board...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/content/strategy")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            AI Strategy Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate a personalized marketing strategy powered by your brand identity
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column — Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brand Identity Preview — Collapsible */}
          <Card>
            {isBrandLoading ? (
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading brand...
                </div>
              </CardContent>
            ) : brand ? (
              <>
                {/* Collapsed Header — always visible, clickable */}
                <button
                  onClick={() => setBrandExpanded((v) => !v)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3 px-5 py-4">
                    {brand.logo ? (
                      <img
                        src={brand.logo}
                        alt={brand.name}
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shrink-0">
                        {brand.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm leading-tight truncate">{brand.name}</h3>
                        {brand.industry && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {brand.industry}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {brand.voiceTone && (
                          <span className="text-xs text-muted-foreground capitalize">{brand.voiceTone}</span>
                        )}
                        {brand.voiceTone && brand.targetAudience && (
                          <span className="text-xs text-muted-foreground">·</span>
                        )}
                        {brand.targetAudience && (
                          <span className="text-xs text-muted-foreground truncate">{brand.targetAudience}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            brandCompleteness >= 80
                              ? "bg-green-500"
                              : brandCompleteness >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                        />
                        {brandCompleteness}%
                      </div>
                      <motion.div
                        animate={{ rotate: brandExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {brandExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-4 border-t pt-4">
                        {/* Description */}
                        {brand.description && (
                          <p className="text-sm text-muted-foreground">{brand.description}</p>
                        )}

                        {/* Info Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {brand.industry && (
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Industry</p>
                              <p className="text-sm font-semibold">{brand.industry}</p>
                            </div>
                          )}
                          {brand.niche && (
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Niche</p>
                              <p className="text-sm font-semibold">{brand.niche}</p>
                            </div>
                          )}
                          {brand.voiceTone && (
                            <div className="rounded-lg border bg-muted/30 p-3">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Voice & Tone</p>
                              <p className="text-sm font-semibold capitalize">{brand.voiceTone}</p>
                            </div>
                          )}
                          {brand.targetAudience && (
                            <div className="rounded-lg border bg-muted/30 p-3 col-span-2 sm:col-span-3">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Target Audience</p>
                              <p className="text-sm font-semibold">{brand.targetAudience}</p>
                              {(brand.audienceAge || brand.audienceLocation) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {[brand.audienceAge, brand.audienceLocation].filter(Boolean).join(" / ")}
                                </p>
                              )}
                            </div>
                          )}
                          {brand.uniqueValue && (
                            <div className="rounded-lg border bg-muted/30 p-3 col-span-2 sm:col-span-3">
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Value Proposition</p>
                              <p className="text-sm font-semibold">{brand.uniqueValue}</p>
                            </div>
                          )}
                        </div>

                        {/* Tags sections */}
                        <div className="space-y-3">
                          {brand.products.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Products & Services</p>
                              <div className="flex flex-wrap gap-1.5">
                                {brand.products.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs bg-blue-500/5 border-blue-500/20 text-blue-600">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {brand.keywords.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Keywords</p>
                              <div className="flex flex-wrap gap-1.5">
                                {brand.keywords.map((k) => (
                                  <Badge key={k} variant="outline" className="text-xs bg-purple-500/5 border-purple-500/20 text-purple-600">
                                    {k}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {brand.personality.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Brand Personality</p>
                              <div className="flex flex-wrap gap-1.5">
                                {brand.personality.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs bg-green-500/5 border-green-500/20 text-green-600 capitalize">
                                    {p}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {brand.hashtags.length > 0 && (
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Hashtags</p>
                              <div className="flex flex-wrap gap-1.5">
                                {brand.hashtags.map((h) => (
                                  <Badge key={h} variant="outline" className="text-xs bg-cyan-500/5 border-cyan-500/20 text-cyan-600">
                                    {h.startsWith("#") ? h : `#${h}`}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Social Handles */}
                        {activeHandles.length > 0 && (
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Social Presence</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(brand.handles)
                                .filter(([, v]) => v)
                                .map(([platform, handle]) => (
                                  <div key={platform} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2.5 py-1.5 border">
                                    <Globe className="h-3 w-3 text-muted-foreground" />
                                    <span className="capitalize text-muted-foreground">{platform}:</span>
                                    <span className="font-medium">{handle}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Info banner */}
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-500/5 rounded-lg px-3 py-2 border border-blue-500/10">
                          <Info className="h-3.5 w-3.5 shrink-0" />
                          All brand insights above will be used by AI to generate a personalized strategy
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-sm">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                  <div>
                    <p className="font-medium">No brand identity found</p>
                    <p className="text-muted-foreground mt-0.5">
                      Set up your brand identity for more personalized results.
                      You can still generate a strategy with just your goals.
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Goals */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-orange-500" />
                Goals & Objectives
                <span className="text-destructive">*</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Goal presets — brand-personalized when available */}
              {brand && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-orange-500" />
                  Suggestions based on {brand.name}&apos;s profile
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {goalPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => addGoalPreset(preset)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-orange-500/40 hover:bg-orange-500/5 text-muted-foreground hover:text-orange-600 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <Textarea
                placeholder={brand
                  ? `Describe your marketing goals for ${brand.name}...\ne.g., I want to grow ${brand.name}'s online presence${brand.products.length > 0 ? `, promote ${brand.products[0]}` : ""}, and drive more conversions through social media.`
                  : "Describe your marketing goals...\ne.g., I want to grow my online presence, increase followers by 50%, and drive more conversions."}
                value={form.goals}
                onChange={(e) => setForm((f) => ({ ...f, goals: e.target.value }))}
                className="min-h-[120px] resize-none"
              />
            </CardContent>
          </Card>

          {/* Focus Areas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-green-500" />
                Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FOCUS_AREAS.map((area) => {
                  const selected = form.focusAreas.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      onClick={() => toggleFocusArea(area.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        selected
                          ? "border-green-500 bg-green-500/5 text-foreground"
                          : "border-border hover:border-muted-foreground/40 text-muted-foreground"
                      }`}
                    >
                      <div className={`shrink-0 ${selected ? "text-green-500" : ""}`}>
                        {area.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{area.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{area.description}</p>
                      </div>
                      {selected && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Timeframe */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                Timeframe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {TIMEFRAME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm((f) => ({ ...f, timeframe: opt.value }))}
                    className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                      form.timeframe === opt.value
                        ? "border-purple-500 bg-purple-500/5"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <p className={`font-semibold text-sm ${
                      form.timeframe === opt.value ? "text-purple-600" : "text-foreground"
                    }`}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Platforms */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4 text-cyan-500" />
                Target Platforms
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendedPlatforms.length > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-cyan-500" />
                  Auto-selected from {brand?.name}&apos;s active social profiles
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => {
                  const selected = form.platforms.includes(platform);
                  const isRecommended = recommendedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all relative ${
                        selected
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-600"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40"
                      }`}
                    >
                      {selected && <CheckCircle2 className="h-3 w-3 inline mr-1.5" />}
                      {platform}
                      {isRecommended && !selected && (
                        <span className="ml-1.5 text-[10px] text-cyan-500 font-normal">rec</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Advanced Options Toggle */}
          <div className="flex items-center gap-3 px-1">
            <Switch
              checked={form.showAdvanced}
              onCheckedChange={(v) => setForm((f) => ({ ...f, showAdvanced: v }))}
            />
            <Label className="text-sm text-muted-foreground cursor-pointer">
              Show advanced options
            </Label>
          </div>

          {/* Advanced Options */}
          <AnimatePresence>
            {form.showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 overflow-hidden"
              >
                {/* Competitor Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Swords className="h-4 w-4 text-red-500" />
                      Competitor Landscape
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {competitorSuggestion && !form.competitorInfo && (
                      <button
                        onClick={() => setForm((f) => ({ ...f, competitorInfo: competitorSuggestion }))}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-dashed border-red-500/20 bg-red-500/5 text-red-600 hover:border-red-500/40 transition-colors flex items-center gap-1.5"
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span className="truncate">Use suggestion: {competitorSuggestion.length > 80 ? competitorSuggestion.slice(0, 77) + "..." : competitorSuggestion}</span>
                      </button>
                    )}
                    <Textarea
                      placeholder={brand
                        ? `Describe competitors in the ${brand.niche || brand.industry || "your"} space, their strengths, and what differentiates ${brand.name}...`
                        : "Describe your main competitors, their strengths, and what differentiates you..."}
                      value={form.competitorInfo}
                      onChange={(e) => setForm((f) => ({ ...f, competitorInfo: e.target.value }))}
                      className="min-h-[80px] resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Budget */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Budget Range
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {budgetSuggestions.length > 0 && !form.budget && (
                      <div className="flex flex-wrap gap-1.5">
                        {budgetSuggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => setForm((f) => ({ ...f, budget: s }))}
                            className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 text-muted-foreground hover:text-emerald-600 transition-colors"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <Input
                      placeholder={brand
                        ? `Budget for ${brand.name}'s marketing — e.g., $500/month for ads, organic only...`
                        : "e.g., $500/month for ads, organic only, $2000 total budget..."}
                      value={form.budget}
                      onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
                    />
                  </CardContent>
                </Card>

                {/* Additional Context */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Users className="h-4 w-4 text-amber-500" />
                      Additional Context
                      <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {contextSuggestions.length > 0 && !form.additionalContext && (
                      <div className="flex flex-wrap gap-1.5">
                        {contextSuggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => setForm((f) => ({ ...f, additionalContext: f.additionalContext ? `${f.additionalContext}\n${s}` : s }))}
                            className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-amber-500/40 hover:bg-amber-500/5 text-muted-foreground hover:text-amber-600 transition-colors"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <Textarea
                      placeholder={brand
                        ? `Any other context for ${brand.name}'s strategy...\ne.g., Upcoming product launches, seasonal trends, team capacity.`
                        : "Any other context that would help create a better strategy...\ne.g., We're launching a new product line in 2 months, seasonal peaks in December."}
                      value={form.additionalContext}
                      onChange={(e) => setForm((f) => ({ ...f, additionalContext: e.target.value }))}
                      className="min-h-[80px] resize-none"
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column — Summary & Generate */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Strategy Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {/* Brand */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Brand</span>
                  <span className="font-medium">
                    {brand?.name || "Not set"}
                  </span>
                </div>

                {/* Timeframe */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Timeframe</span>
                  <span className="font-medium">
                    {TIMEFRAME_OPTIONS.find((o) => o.value === form.timeframe)?.label}
                  </span>
                </div>

                {/* Focus Areas */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Focus</span>
                  <span className="font-medium">
                    {form.focusAreas.length === 5
                      ? "All areas"
                      : `${form.focusAreas.length} areas`}
                  </span>
                </div>

                {/* Platforms */}
                {form.platforms.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Platforms</span>
                    <span className="font-medium">
                      {form.platforms.length} selected
                    </span>
                  </div>
                )}

                {/* Est. tasks */}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Est. tasks</span>
                  <span className="font-medium">15-25</span>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <Badge
                      variant="outline"
                      className="bg-purple-500/10 text-purple-600 border-purple-500/20"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />5 credits
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !form.goals.trim() || form.focusAreas.length === 0}
              className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white text-base font-semibold"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Generating Strategy...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Generate Strategy
                </>
              )}
            </Button>

            {!form.goals.trim() && (
              <p className="text-xs text-center text-muted-foreground">
                Describe your goals to get started
              </p>
            )}

            {/* Tips */}
            <Card className="bg-muted/30">
              <CardContent className="py-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tips</p>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    Be specific about your goals for better results
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    Select focus areas that match your team capacity
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    A complete brand identity gives AI more context
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-green-500" />
                    Use advanced options for competitor-aware strategies
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
