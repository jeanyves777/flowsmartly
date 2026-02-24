"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Check, Loader2, AlertCircle, RefreshCw, Palette, PenLine, FolderOpen, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface AIBuildStepProps {
  storeName: string;
  industry: string;
  niche: string;
  targetAudience: string;
  region: string;
  currency: string;
  showBrandName?: boolean;
  existingSiteUrl?: string;
  generateImages?: boolean;
  onToggleGenerateImages?: () => void;
  includeVariants?: boolean;
  onToggleVariants?: () => void;
  heroMediaType?: "none" | "images" | "video";
  onChangeHeroMediaType?: (type: "none" | "images" | "video") => void;
  onComplete: (blueprint: unknown) => void;
  onError: (error: string) => void;
}

const BUILD_STEPS = [
  { key: "template", label: "Selecting the perfect theme", icon: "palette" },
  { key: "content", label: "Writing your store copy", icon: "pen" },
  { key: "categories", label: "Organizing product categories", icon: "folder" },
  { key: "products", label: "Creating your product catalog", icon: "package" },
  { key: "seo", label: "Optimizing for search engines", icon: "search" },
];

const BUILD_SUMMARY_ITEMS = [
  { icon: Palette, label: "A custom theme tailored to your brand" },
  { icon: PenLine, label: "Store copy, tagline, and about page" },
  { icon: FolderOpen, label: "Product categories for your industry" },
  { icon: Package, label: "6-10 starter products with descriptions" },
  { icon: Search, label: "SEO-optimized content and metadata" },
];

export function AIBuildStep({
  storeName,
  industry,
  niche,
  targetAudience,
  region,
  currency,
  showBrandName,
  existingSiteUrl,
  generateImages,
  onToggleGenerateImages,
  includeVariants,
  onToggleVariants,
  heroMediaType,
  onChangeHeroMediaType,
  onComplete,
  onError,
}: AIBuildStepProps) {
  const [started, setStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function handleStartBuild() {
    setStarted(true);
    startBuild();
  }

  async function startBuild() {
    setIsBuilding(true);
    setError(null);
    setActiveStepIndex(0);

    // Animate through steps every 4 seconds
    timerRef.current = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev < BUILD_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 4000);

    // Scrape existing site if URL provided
    let scrapedSiteData: unknown = undefined;
    if (existingSiteUrl) {
      try {
        const scrapeRes = await fetch("/api/ecommerce/ai/scrape-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: existingSiteUrl }),
        });
        const scrapeJson = await scrapeRes.json();
        if (scrapeJson.success) {
          scrapedSiteData = scrapeJson.data;
        }
      } catch {
        // Non-critical — continue without scraped data
      }
    }

    try {
      const res = await fetch("/api/ecommerce/ai/build-store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName,
          industry,
          niche: niche || undefined,
          targetAudience: targetAudience || undefined,
          region: region || undefined,
          currency: currency || undefined,
          showBrandName: showBrandName !== undefined ? showBrandName : undefined,
          includeVariants: includeVariants !== undefined ? includeVariants : undefined,
          scrapedSiteData: scrapedSiteData || undefined,
        }),
      });

      const json = await res.json();

      if (timerRef.current) clearInterval(timerRef.current);

      if (!json.success) {
        const msg = json.error?.message || "Failed to build store. Please try again.";
        setError(msg);
        onError(msg);
        return;
      }

      // Mark all steps complete
      setActiveStepIndex(BUILD_STEPS.length);
      setIsComplete(true);
      onComplete(json.data);
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      const msg = "Network error. Please check your connection and try again.";
      setError(msg);
      onError(msg);
    } finally {
      setIsBuilding(false);
    }
  }

  function handleRetry() {
    setActiveStepIndex(0);
    setIsComplete(false);
    setError(null);
    startBuild();
  }

  // ── Confirmation screen (before build starts) ──────────────────────────────
  if (!started) {
    return (
      <div className="flex flex-col items-center py-8">
        {/* Header Icon */}
        <div className="relative mb-8">
          <div className="h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg bg-brand-500">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-1">Ready to build your store</h2>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
          AI will generate a theme, store copy, product categories, and 6-10 products for your{" "}
          <span className="font-medium text-foreground">{industry}</span> store.
        </p>

        {/* Summary Card */}
        <div className="w-full max-w-sm rounded-xl border bg-card p-5 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            What AI will create
          </h3>
          {BUILD_SUMMARY_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              </div>
              <span className="text-sm">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Build Options */}
        <div className="w-full max-w-sm space-y-2 mb-4">
          {/* AI Product Images Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex-1 mr-3">
              <p className="text-sm font-medium">AI Product Images</p>
              <p className="text-xs text-muted-foreground">Generate professional photos (15 credits each)</p>
            </div>
            <button
              type="button"
              onClick={onToggleGenerateImages}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                generateImages ? "bg-brand-500" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                generateImages ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {/* Product Variants Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex-1 mr-3">
              <p className="text-sm font-medium">Product Variants</p>
              <p className="text-xs text-muted-foreground">Include sizes, colors, and options</p>
            </div>
            <button
              type="button"
              onClick={onToggleVariants}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                includeVariants ? "bg-brand-500" : "bg-muted"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                includeVariants ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>
        </div>

        {/* Hero Media */}
        <div className="w-full max-w-sm mb-4">
          <p className="text-sm font-medium mb-2">Hero Section Media</p>
          <div className="space-y-2">
            {([
              { value: "none" as const, label: "No Media", desc: "Gradient background only" },
              { value: "images" as const, label: "AI Slideshow", desc: "3-4 hero images (15 credits each)" },
              { value: "video" as const, label: "AI Video", desc: "8-second Sora video (60 credits)" },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeHeroMediaType?.(opt.value)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors",
                  heroMediaType === opt.value
                    ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/30"
                    : "hover:bg-muted"
                )}
              >
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
                {heroMediaType === opt.value && (
                  <div className="h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Cost Display */}
        <div className="w-full max-w-sm mb-6 p-3 rounded-lg bg-muted/50 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Store generation</span>
            <span className="font-medium">20 credits</span>
          </div>
          {generateImages && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Product images (~8 products)</span>
              <span className="font-medium">~120 credits</span>
            </div>
          )}
          {heroMediaType === "images" && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hero slideshow (4 images)</span>
              <span className="font-medium">60 credits</span>
            </div>
          )}
          {heroMediaType === "video" && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Hero video (8 seconds)</span>
              <span className="font-medium">60 credits</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm pt-1 border-t mt-1">
            <span className="font-medium">Estimated total</span>
            <span className="font-bold text-brand-600">
              ~{20 + (generateImages ? 120 : 0) + (heroMediaType === "images" ? 60 : 0) + (heroMediaType === "video" ? 60 : 0)} credits
            </span>
          </div>
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStartBuild}
          size="lg"
          className="gap-2 bg-brand-500 hover:bg-brand-600 text-white shadow-lg"
        >
          <Sparkles className="h-5 w-5" />
          Start AI Build
        </Button>
      </div>
    );
  }

  // ── Build progress screen ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center py-8">
      {/* Header */}
      <div className="relative mb-8">
        <div
          className={cn(
            "h-20 w-20 rounded-2xl flex items-center justify-center shadow-lg",
            isComplete
              ? "bg-gradient-to-br from-emerald-500 to-green-600"
              : error
                ? "bg-gradient-to-br from-red-500 to-rose-600"
                : "bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600"
          )}
        >
          {isComplete ? (
            <Check className="h-10 w-10 text-white" />
          ) : error ? (
            <AlertCircle className="h-10 w-10 text-white" />
          ) : (
            <Sparkles className="h-10 w-10 text-white animate-pulse" />
          )}
        </div>
      </div>

      <h2 className="text-xl font-bold mb-1">
        {isComplete
          ? "Your store is ready!"
          : error
            ? "Something went wrong"
            : "Building your store with AI..."}
      </h2>
      <p className="text-sm text-muted-foreground mb-8 text-center max-w-md">
        {isComplete
          ? `We've designed ${storeName} with a theme, products, and content tailored to your ${industry} business.`
          : error
            ? error
            : "Our AI is creating your theme, writing store copy, and building your product catalog."}
      </p>

      {/* Progress Steps */}
      <div className="w-full max-w-sm space-y-3 mb-8">
        {BUILD_STEPS.map((step, i) => {
          const isDone = isComplete || i < activeStepIndex;
          const isActive = !isComplete && !error && i === activeStepIndex;

          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                isDone && "bg-emerald-50 dark:bg-emerald-950/30",
                isActive && "bg-brand-50 dark:bg-brand-950/30",
                !isDone && !isActive && "opacity-40"
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                  isDone && "bg-emerald-500 text-white",
                  isActive && "bg-brand-500 text-white",
                  !isDone && !isActive && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="text-xs font-medium">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isDone && "text-emerald-700 dark:text-emerald-300",
                  isActive && "text-violet-700 dark:text-violet-300"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Retry Button */}
      {error && (
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
