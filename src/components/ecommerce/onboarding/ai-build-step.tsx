"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Check, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface AIBuildStepProps {
  storeName: string;
  industry: string;
  niche: string;
  targetAudience: string;
  region: string;
  currency: string;
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

export function AIBuildStep({
  storeName,
  industry,
  niche,
  targetAudience,
  region,
  currency,
  onComplete,
  onError,
}: AIBuildStepProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const hasStarted = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    startBuild();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    hasStarted.current = false;
    setActiveStepIndex(0);
    setIsComplete(false);
    setError(null);
    hasStarted.current = true;
    startBuild();
  }

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
                isActive && "bg-violet-50 dark:bg-violet-950/30",
                !isDone && !isActive && "opacity-40"
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                  isDone && "bg-emerald-500 text-white",
                  isActive && "bg-violet-500 text-white",
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
