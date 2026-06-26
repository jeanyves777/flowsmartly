"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/**
 * The FlowSmartly brand mark in its white tile — padded so the logo isn't
 * clipped by the rounded container (matches the approved mockup). Uses the
 * real /icon.png asset. The wordmark is rendered adaptively (Flow = theme
 * text, Smartly = brand gradient) because /logo.png has no dark variant.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[10px] bg-white shadow-[0_4px_14px_rgba(14,165,233,0.35)]",
        className,
      )}
      style={{ width: size, height: size, padding: Math.round(size * 0.17) }}
    >
      <Image
        src="/icon.png"
        alt="FlowSmartly"
        width={size}
        height={size}
        className="h-full w-full object-contain"
        priority
        unoptimized
      />
    </span>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight", className)}>
      Flow
      <span className="bg-gradient-to-r from-brand-500 to-violet-500 bg-clip-text text-transparent">Smartly</span>
    </span>
  );
}
