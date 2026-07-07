"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

/**
 * LogoGlowLoader — the minimal in-CHAT "generating" indicator: the FlowSmartly
 * mark kept FADED / ghosted and softly glowing (a breathing halo). No text, no
 * ring, no progress — a calm signal that the agent is working. Optional `dots`
 * lays it on the same dot-grid as the playground canvas (for the task card /
 * thinking bubble). For inline button/label busy states keep FlowLoader /
 * FlowActionSpinner instead. [[agent-writes-into-ui-element-not-chat]]
 */
export function LogoGlowLoader({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={cn("relative z-[1] inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      {/* soft pulsing glow halo behind the mark */}
      <motion.span
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: size * 1.9,
          height: size * 1.9,
          background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, rgba(59,130,246,0.24) 44%, rgba(59,130,246,0) 70%)",
          filter: "blur(10px)",
        }}
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.16, 0.85] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* the FADED, gently-breathing mark */}
      <motion.span
        className="relative overflow-hidden rounded-[24%]"
        style={{ width: size, height: size, filter: "drop-shadow(0 0 10px rgba(139,92,246,0.4))" }}
        animate={{ opacity: [0.28, 0.6, 0.28], scale: [0.95, 1, 0.95] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src="/icon.png" alt="" width={size} height={size} className="h-full w-full object-contain" unoptimized priority />
      </motion.span>
    </span>
  );
}

/**
 * The playground dot-grid surface — same dots as the canvas, softly masked at the
 * edges. A positioned parent must wrap it (it's absolutely filled).
 */
export function DotGrid({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: "radial-gradient(currentColor 1.4px, transparent 1.4px)",
        backgroundSize: "22px 22px",
        WebkitMaskImage: "radial-gradient(120% 100% at 50% 45%, #000 45%, transparent 82%)",
        maskImage: "radial-gradient(120% 100% at 50% 45%, #000 45%, transparent 82%)",
      }}
    />
  );
}
