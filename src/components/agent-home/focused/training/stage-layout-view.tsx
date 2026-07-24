"use client";

/**
 * Lays the presentation + the co-host video onto the 16:9 stage per the deck's `stageLayout`:
 *   - presentation   → slides only (co-host hidden)
 *   - cohost_right    → slides on the left, co-host docked on the right
 *   - cohost_bottom   → slides on top, co-host as a bottom strip
 *   - floating        → slides fill; co-host is a picture-in-picture corner tile
 * `slide` is the presentation (a DeckSlideView), `cohost` is the co-host video element (or null when
 * none is available). Used by BOTH the builder preview and the live room so they match exactly.
 * [[training-presenter-talking-video]]
 */
import type { ReactNode } from "react";
import type { StageLayout } from "@/lib/training/types";
import { cohostSize } from "@/lib/training/types";
import { cn } from "@/lib/utils/cn";

export function StageLayoutView({ layout, slide, cohost, className, fullVisual }: {
  layout?: StageLayout | null;
  slide: ReactNode;
  cohost: ReactNode | null;
  className?: string;
  fullVisual?: boolean;
}) {
  const mode = layout?.mode ?? "cohost_right";
  const sz = cohostSize(layout);
  const show = !!cohost && mode !== "presentation" && !(layout?.hideOnFullVisual && fullVisual && !layout?.keepVisible);

  if (!show) return <div className={cn("relative h-full w-full overflow-hidden", className)}>{slide}</div>;

  if (mode === "floating") {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {slide}
        <div className="absolute bottom-3 right-3 z-[3] overflow-hidden rounded-xl bg-black shadow-xl ring-2 ring-brand-500/50" style={{ width: `${sz.floatPct}%`, aspectRatio: "16 / 9" }}>{cohost}</div>
      </div>
    );
  }
  if (mode === "cohost_bottom") {
    return (
      <div className={cn("relative flex h-full w-full flex-col overflow-hidden", className)}>
        <div className="min-h-0 flex-1 overflow-hidden">{slide}</div>
        <div className="relative w-full shrink-0 overflow-hidden bg-black" style={{ height: `${sz.bottomPct}%` }}>{cohost}</div>
      </div>
    );
  }
  // cohost_right (default)
  return (
    <div className={cn("relative flex h-full w-full overflow-hidden", className)}>
      <div className="min-w-0 flex-1 overflow-hidden">{slide}</div>
      <div className="relative h-full shrink-0 overflow-hidden bg-black" style={{ width: `${sz.rightPct}%` }}>{cohost}</div>
    </div>
  );
}
