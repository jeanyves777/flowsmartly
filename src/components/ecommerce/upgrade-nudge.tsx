"use client";

import { Crown, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

interface UpgradeNudgeProps {
  context: "dashboard" | "domain" | "analytics" | "cart";
  className?: string;
}

const CONTEXT_MESSAGES: Record<UpgradeNudgeProps["context"], string> = {
  dashboard:
    "Upgrade to Pro \u2014 Get a FREE domain + AI chatbot + abandoned cart recovery",
  domain:
    "Get a FREE domain with FlowShop Pro ($12/month) instead of paying separately",
  analytics: "Unlock Advanced Analytics with FlowShop Pro",
  cart: "FlowShop Pro includes automatic abandoned cart recovery emails",
};

const DISMISS_KEY_PREFIX = "flowshop-upgrade-nudge-dismissed-";

export function UpgradeNudge({ context, className }: UpgradeNudgeProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check localStorage for dismissed state
    const dismissKey = `${DISMISS_KEY_PREFIX}${context}`;
    const dismissed = localStorage.getItem(dismissKey);
    if (!dismissed) {
      setVisible(true);
    }
    // Trigger mount animation after a brief delay
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, [context]);

  const handleDismiss = () => {
    setMounted(false);
    // Wait for exit animation before hiding
    setTimeout(() => {
      setVisible(false);
      const dismissKey = `${DISMISS_KEY_PREFIX}${context}`;
      localStorage.setItem(dismissKey, new Date().toISOString());
    }, 300);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4 shadow-lg transition-all duration-300 ease-in-out",
        mounted
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-2",
        className
      )}
    >
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white" />
        <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-white" />
      </div>

      <div className="relative flex items-center gap-3">
        {/* Crown icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <Crown className="h-5 w-5 text-yellow-300" />
        </div>

        {/* Message */}
        <p className="flex-1 text-sm font-medium text-white">
          {CONTEXT_MESSAGES[context]}
        </p>

        {/* CTA button */}
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-white text-violet-700 hover:bg-white/90 hover:text-violet-800 shadow-sm"
        >
          <Link href="/ecommerce/settings?tab=subscription">
            Upgrade to Pro
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
