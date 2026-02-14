"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Megaphone,
  ExternalLink,
  Eye,
  DollarSign,
  Loader2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdCardProps {
  campaign: {
    id: string;
    name: string;
    headline: string | null;
    description: string | null;
    mediaUrl: string | null;
    videoUrl: string | null;
    destinationUrl: string | null;
    ctaText: string | null;
    adType: string;
    adPage: { slug: string } | null;
  };
  currentUserId: string | null;
  onViewEarned?: (campaignId: string, amount: number) => void;
}

const VIEW_DURATION = 35; // seconds

export function AdCard({ campaign, currentUserId, onViewEarned }: AdCardProps) {
  const [viewState, setViewState] = useState<"idle" | "viewing" | "completed">("idle");
  const [viewProgress, setViewProgress] = useState(0);
  const [viewId, setViewId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startViewing = useCallback(async () => {
    if (viewState !== "idle") return;

    try {
      const res = await fetch("/api/ads/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", campaignId: campaign.id }),
      });
      const data = await res.json();
      if (!data.success) return;

      setViewId(data.data.viewId);
      setViewState("viewing");
      startTimeRef.current = Date.now();

      // Progress timer
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const progress = Math.min(elapsed / VIEW_DURATION, 1);
        setViewProgress(progress);

        if (progress >= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          completeView(data.data.viewId);
        }
      }, 100);
    } catch {
      // Silently fail
    }
  }, [viewState, campaign.id]);

  const completeView = async (vid: string) => {
    try {
      const res = await fetch("/api/ads/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", viewId: vid }),
      });
      const data = await res.json();
      if (data.success) {
        setViewState("completed");
        onViewEarned?.(campaign.id, data.data.earnedCents || 0);
      }
    } catch {
      // Silently fail
    }
  };

  const ctaUrl = campaign.adPage
    ? `/ad/${campaign.adPage.slug}`
    : campaign.destinationUrl || "#";

  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      {/* Sponsored badge */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b bg-muted/30">
        <Megaphone className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Sponsored</span>
      </div>

      {/* Media */}
      {campaign.videoUrl ? (
        <video
          src={campaign.videoUrl}
          controls
          className="w-full max-h-80 object-cover bg-black"
          poster={campaign.mediaUrl || undefined}
        />
      ) : campaign.mediaUrl ? (
        <img
          src={campaign.mediaUrl}
          alt={campaign.headline || campaign.name}
          className="w-full max-h-80 object-cover"
        />
      ) : null}

      {/* Content */}
      <div className="p-4 space-y-3">
        {campaign.headline && (
          <h3 className="font-semibold text-base">{campaign.headline}</h3>
        )}
        {campaign.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{campaign.description}</p>
        )}

        {/* CTA Button */}
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium text-sm transition-colors"
        >
          {campaign.ctaText || "Learn More"}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        {/* Watch & Earn */}
        {currentUserId && (
          <div className="border-t pt-3">
            {viewState === "idle" && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={startViewing}
              >
                <Eye className="w-3.5 h-3.5" />
                Watch & Earn
                <DollarSign className="w-3 h-3 text-green-500" />
              </Button>
            )}

            {viewState === "viewing" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Watching...
                  </span>
                  <span className="font-medium">{Math.round(viewProgress * VIEW_DURATION)}s / {VIEW_DURATION}s</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-100"
                    style={{ width: `${viewProgress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {viewState === "completed" && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-green-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Earned! Thank you for watching.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
