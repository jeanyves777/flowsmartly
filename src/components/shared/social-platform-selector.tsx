"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSocialPlatforms } from "@/hooks/use-social-platforms";
import { PLATFORM_META, PLATFORM_ORDER } from "@/components/shared/social-platform-icons";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SocialPlatformSelectorProps {
  /** Currently selected platform IDs */
  selectedPlatforms: string[];
  /** Called when selection changes */
  onPlatformsChange: (platforms: string[]) => void;
  /** Visual variant: "pills" (labeled buttons) or "icons" (icon-only circles) */
  variant?: "pills" | "icons";
  /** Show "Connect accounts" link */
  showConnectLink?: boolean;
  /** Show selected count badge */
  showCount?: boolean;
  /** Optional label (default: "Publish to") */
  label?: string | null;
  /** Additional className for the wrapper */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SocialPlatformSelector({
  selectedPlatforms,
  onPlatformsChange,
  variant = "pills",
  showConnectLink = true,
  showCount = true,
  label = "Publish to",
  className,
}: SocialPlatformSelectorProps) {
  const { isConnected } = useSocialPlatforms();

  const platforms = useMemo(() => {
    return PLATFORM_ORDER
      .filter((id) => PLATFORM_META[id])
      .map((id) => ({
        id,
        ...PLATFORM_META[id],
        enabled: id === "feed" || isConnected(id),
      }));
  }, [isConnected]);

  const togglePlatform = (platformId: string) => {
    if (platformId === "feed") return; // Feed is always selected
    const next = selectedPlatforms.includes(platformId)
      ? selectedPlatforms.filter((p) => p !== platformId)
      : [...selectedPlatforms, platformId];
    onPlatformsChange(next);
  };

  if (variant === "icons") {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 flex-wrap">
          {label && (
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          )}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                const isFeed = platform.id === "feed";
                const isDisabled = !platform.enabled && !isFeed;

                return (
                  <Tooltip key={platform.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => !isDisabled && togglePlatform(platform.id)}
                        disabled={isDisabled}
                        className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                          isSelected
                            ? "border-brand-500 bg-brand-500/10 text-brand-600"
                            : isDisabled
                              ? "border-border/50 text-muted-foreground/30 cursor-not-allowed"
                              : "border-border text-muted-foreground hover:border-brand-500/50 hover:text-foreground"
                        } ${isFeed ? "cursor-default" : ""}`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {platform.label}
                      {isDisabled ? " (not connected)" : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
          {showConnectLink && (
            <Link
              href="/settings/social-accounts"
              className="text-[11px] text-brand-600 hover:underline ml-1"
            >
              Connect accounts
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ─── Pills variant (default) ──────────────────────────────────────────

  return (
    <div className={className}>
      {label && (
        <p className="text-sm font-semibold mb-2.5">{label}</p>
      )}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-2 flex-wrap">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            const isSelected = selectedPlatforms.includes(platform.id);
            const isFeed = platform.id === "feed";
            const isDisabled = !platform.enabled && !isFeed;

            const button = (
              <button
                key={platform.id}
                type="button"
                onClick={() => !isDisabled && togglePlatform(platform.id)}
                disabled={isDisabled}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
                  isSelected
                    ? "bg-brand-500/10 border-brand-500/30 text-brand-600 dark:text-brand-400"
                    : isDisabled
                      ? "opacity-40 cursor-not-allowed border-border bg-muted/30"
                      : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                } ${isFeed ? "cursor-default" : ""}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs font-medium">{platform.label}</span>
                {isSelected && <Check className="w-3 h-3 text-brand-500" />}
                {isDisabled && <LinkIcon className="w-3 h-3" />}
              </button>
            );

            if (isDisabled) {
              return (
                <Tooltip key={platform.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Connect {platform.label} in Settings</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-2 mt-2">
        {showCount && selectedPlatforms.length > 1 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {selectedPlatforms.length}
            </Badge>
            platforms selected
          </p>
        )}
        {showConnectLink && (
          <Link
            href="/settings/social-accounts"
            className="text-xs text-brand-600 hover:underline"
          >
            Connect accounts
          </Link>
        )}
      </div>
    </div>
  );
}
