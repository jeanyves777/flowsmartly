"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Palette, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface OnboardingState {
  emailVerified: boolean;
  brandSetup: boolean;
  hasStrategy: boolean;
  strategyId: string | null;
  hasAutomation: boolean;
  dismissedBanners: string[];
}

interface BannerConfig {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  cta: string;
  href: string;
  gradient: string;
  iconColor: string;
}

export function OnboardingBanner() {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/user/onboarding-state");
      const json = await res.json();
      if (json.success && json.data) {
        setState(json.data);
        setDismissed(json.data.dismissedBanners || []);
      }
    } catch {
      // Silent fail — banner just won't show
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleDismiss = async (bannerId: string) => {
    setIsVisible(false);
    setDismissed((prev) => [...prev, bannerId]);
    try {
      await fetch("/api/user/dismiss-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerId }),
      });
    } catch {
      // Silent fail
    }
  };

  if (!state || !state.emailVerified) return null;

  // Determine which banner to show (progressive order)
  const banners: BannerConfig[] = [];

  if (!state.brandSetup) {
    banners.push({
      id: "setup-brand",
      icon: Palette,
      title: "Set Up Your Brand Identity",
      description: "Tell us about your brand to unlock AI-powered content generation, strategy planning, and more.",
      cta: "Set Up Brand",
      href: "/brand",
      gradient: "from-purple-500/10 via-pink-500/10 to-purple-500/10",
      iconColor: "text-purple-500",
    });
  }

  if (state.brandSetup && !state.hasStrategy) {
    banners.push({
      id: "create-strategy",
      icon: Target,
      title: "Create Your Marketing Strategy",
      description: "Generate an AI-powered marketing strategy with actionable tasks, timelines, and progress tracking.",
      cta: "Create Strategy",
      href: "/content/strategy/generate",
      gradient: "from-blue-500/10 via-cyan-500/10 to-blue-500/10",
      iconColor: "text-blue-500",
    });
  }

  if (state.hasStrategy && !state.hasAutomation) {
    banners.push({
      id: "automate-strategy",
      icon: Zap,
      title: "Fully Automate Your Marketing Strategy",
      description: "Put your strategy on autopilot — AI generates posts with images on your schedule, tracks progress, and scores performance.",
      cta: "Automate Now",
      href: state.strategyId
        ? `/content/automation?strategy=${state.strategyId}`
        : "/content/automation",
      gradient: "from-amber-500/10 via-orange-500/10 to-amber-500/10",
      iconColor: "text-amber-500",
    });
  }

  // Find the first non-dismissed banner
  const activeBanner = banners.find((b) => !dismissed.includes(b.id));
  if (!activeBanner || !isVisible) return null;

  const Icon = activeBanner.icon;

  return (
    <div
      className={cn(
        "relative mb-4 rounded-xl border border-border/40 overflow-hidden",
        "bg-gradient-to-r",
        activeBanner.gradient
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3 sm:px-5 sm:py-3.5">
        <div
          className={cn(
            "shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-background/80 border border-border/40",
            activeBanner.iconColor
          )}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            {activeBanner.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {activeBanner.description}
          </p>
        </div>

        <Link
          href={activeBanner.href}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors"
        >
          {activeBanner.cta}
        </Link>

        <button
          onClick={() => handleDismiss(activeBanner.id)}
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
