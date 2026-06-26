"use client";

import { useId } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * FlowLoader — the ONE shared, on-brand loading indicator. Use this for EVERY
 * loading/busy state (inline spinners, "working…" labels, button busy states).
 * Do NOT hand-roll one-off spinners or reach for a raw <Loader2>.
 *
 * Brand ring uses the unified gradient (blue → violet → amber); sizes ≥ ~30px
 * (or `withMark`) show the FlowSmartly mark in the center. `tone="white"` for
 * loaders that sit on a colored/gradient surface (e.g. a send button).
 */
export function FlowLoader({
  size = 18,
  label,
  withMark,
  tone = "brand",
  className,
}: {
  size?: number;
  label?: string;
  withMark?: boolean;
  tone?: "brand" | "white";
  className?: string;
}) {
  const gid = useId();
  const stroke = Math.max(2, Math.round(size * 0.12));
  const showMark = (withMark ?? size >= 30) && tone === "brand";
  const circ = 2 * Math.PI * 10;

  const ring = (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin" style={{ animationDuration: "0.9s" }}>
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={tone === "white" ? "rgba(255,255,255,0.3)" : "currentColor"}
          strokeWidth={stroke}
          className={tone === "white" ? undefined : "text-muted-foreground/20"}
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={tone === "white" ? "#fff" : `url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * 0.62}
        />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>
      {showMark && (
        <span className="absolute grid place-items-center overflow-hidden rounded-[5px] bg-white" style={{ width: size * 0.5, height: size * 0.5, padding: Math.max(1, size * 0.05) }}>
          <Image src="/icon.png" alt="" width={size} height={size} className="h-full w-full object-contain" unoptimized />
        </span>
      )}
    </span>
  );

  if (!label) return <span className={cn("inline-flex", className)}>{ring}</span>;
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12px] text-muted-foreground", className)}>
      {ring}
      <span>{label}</span>
    </span>
  );
}
