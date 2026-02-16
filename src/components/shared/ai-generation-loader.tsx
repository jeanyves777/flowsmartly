"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface AIGenerationLoaderProps {
  /** Current step description, e.g. "Generating video..." */
  currentStep?: string;
  /** Progress percentage 0-100. Pass undefined for indeterminate. */
  progress?: number;
  /** Subtitle hint, e.g. "This may take 1-2 minutes" */
  subtitle?: string;
  /** Extra class names for the outer container */
  className?: string;
  /** Whether to show the progress bar (default: true when progress is defined) */
  showProgressBar?: boolean;
  /** Compact mode: smaller logo, fewer sparkles, fits inline overlays */
  compact?: boolean;
}

// ─── Floating sparkle particle ───

function Sparkle({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        background: `radial-gradient(circle, rgba(139,92,246,0.6) 0%, rgba(59,130,246,0.3) 50%, transparent 70%)`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0.6, 0],
        scale: [0, 1.2, 0.8, 0],
        y: [0, -30, -50],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 2,
        ease: "easeOut",
      }}
    />
  );
}

// ─── SVG circular progress ring ───

function ProgressRing({ progress, size = 140, gradientId = "progressGradient" }: { progress: number; size?: number; gradientId?: string }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute -rotate-90"
      style={{ filter: "drop-shadow(0 0 8px rgba(139,92,246,0.4))" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Indeterminate spinning ring ───

function SpinnerRing({ size = 140, gradientId = "spinnerGradient" }: { size?: number; gradientId?: string }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.svg
      width={size}
      height={size}
      className="absolute"
      animate={{ rotate: 360 }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
      style={{ filter: "drop-shadow(0 0 8px rgba(139,92,246,0.3))" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.7}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}

// ─── Animated step text ───

function AnimatedStepText({ text }: { text: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.3 }}
        className="text-base font-semibold text-foreground text-center max-w-sm"
      >
        {text}
      </motion.p>
    </AnimatePresence>
  );
}

// ─── Animated dots for loading effect ───

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
        />
      ))}
    </span>
  );
}

// ─── Sparkle positions ───

const SPARKLES = [
  { x: 10, y: 20, size: 6, delay: 0 },
  { x: 85, y: 15, size: 8, delay: 0.5 },
  { x: 15, y: 70, size: 5, delay: 1 },
  { x: 80, y: 65, size: 7, delay: 1.5 },
  { x: 50, y: 10, size: 4, delay: 2 },
  { x: 25, y: 45, size: 6, delay: 0.8 },
  { x: 75, y: 40, size: 5, delay: 1.3 },
  { x: 45, y: 80, size: 7, delay: 0.3 },
  { x: 65, y: 85, size: 4, delay: 1.8 },
  { x: 35, y: 15, size: 5, delay: 2.2 },
];

/**
 * Shared premium AI generation loader with animated FlowSmartly logo,
 * circular progress ring, floating particles, and smooth step transitions.
 *
 * Used across all AI features: Video Studio, Cartoon Maker, etc.
 */
export function AIGenerationLoader({
  currentStep = "Generating...",
  progress,
  subtitle = "This may take a few minutes",
  className,
  showProgressBar,
  compact = false,
}: AIGenerationLoaderProps) {
  const uid = useId();
  const showBar = showProgressBar ?? progress !== undefined;

  // Animated progress counter for smooth number transitions
  const [displayProgress, setDisplayProgress] = useState(progress ?? 0);
  useEffect(() => {
    if (progress === undefined) return;
    const timer = setTimeout(() => setDisplayProgress(progress), 50);
    return () => clearTimeout(timer);
  }, [progress]);

  // For indeterminate: fake slow progress
  const [fakeProgress, setFakeProgress] = useState(0);
  useEffect(() => {
    if (progress !== undefined) return;
    const interval = setInterval(() => {
      setFakeProgress((p) => {
        if (p >= 88) return p;
        const increment = p < 30 ? 1.5 : p < 60 ? 0.8 : 0.3;
        return Math.min(88, p + increment);
      });
    }, 800);
    return () => clearInterval(interval);
  }, [progress]);

  const effectiveProgress = progress ?? fakeProgress;

  // ─── Compact variant: smaller, horizontal, for overlays ───
  if (compact) {
    const ringSize = 56;
    const logoSize = 28;
    const compactSparkles = SPARKLES.slice(0, 5);

    return (
      <div className={cn("relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950", className)}>
        {/* Animated gradient background */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.1) 0%, transparent 60%)",
          }}
          animate={{
            background: [
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.1) 0%, transparent 60%)",
              "radial-gradient(ellipse at 40% 40%, rgba(139,92,246,0.12) 0%, transparent 60%), radial-gradient(ellipse at 60% 60%, rgba(245,158,11,0.08) 0%, transparent 60%)",
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.1) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.1) 0%, transparent 60%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Sparkles */}
        {compactSparkles.map((s, i) => (
          <Sparkle key={i} {...s} />
        ))}

        {/* Content */}
        <div className="relative z-10 flex items-center gap-4 px-5 py-4">
          {/* Mini logo + ring */}
          <div className="relative flex items-center justify-center shrink-0" style={{ width: ringSize, height: ringSize }}>
            {progress !== undefined ? (
              <ProgressRing progress={displayProgress} size={ringSize} gradientId={`pg-${uid}`} />
            ) : (
              <SpinnerRing size={ringSize} gradientId={`sg-${uid}`} />
            )}
            <motion.div
              className="relative z-10 rounded-lg overflow-hidden"
              animate={{
                boxShadow: [
                  "0 0 10px rgba(139,92,246,0.2), 0 0 30px rgba(59,130,246,0.1)",
                  "0 0 16px rgba(139,92,246,0.4), 0 0 40px rgba(59,130,246,0.2)",
                  "0 0 10px rgba(139,92,246,0.2), 0 0 30px rgba(59,130,246,0.1)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image src="/icon.png" alt="FlowSmartly" width={logoSize} height={logoSize} className="rounded-lg" priority />
            </motion.div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <AnimatedStepText text={currentStep} />
            {subtitle && (
              <p className="text-xs text-slate-400 flex items-center mt-1">
                {subtitle}
                <LoadingDots />
              </p>
            )}
          </div>

          {/* Progress */}
          {effectiveProgress > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-amber-400 bg-clip-text text-transparent shrink-0"
            >
              {Math.round(effectiveProgress)}%
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ─── Full variant: large, centered, for main generation progress ───
  return (
    <div className={cn("space-y-5", className)}>
      {/* Main visual area */}
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Animated gradient background */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)",
          }}
          animate={{
            background: [
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)",
              "radial-gradient(ellipse at 40% 40%, rgba(139,92,246,0.1) 0%, transparent 60%), radial-gradient(ellipse at 60% 60%, rgba(245,158,11,0.06) 0%, transparent 60%)",
              "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.08) 0%, transparent 60%)",
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Floating sparkles */}
        {SPARKLES.map((s, i) => (
          <Sparkle key={i} {...s} />
        ))}

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-10">
          {/* Logo + Ring */}
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            {progress !== undefined ? (
              <ProgressRing progress={displayProgress} gradientId={`pg-${uid}`} />
            ) : (
              <SpinnerRing gradientId={`sg-${uid}`} />
            )}

            {/* Logo with pulse glow */}
            <motion.div
              className="relative z-10 rounded-2xl overflow-hidden"
              animate={{
                boxShadow: [
                  "0 0 20px rgba(139,92,246,0.2), 0 0 60px rgba(59,130,246,0.1)",
                  "0 0 30px rgba(139,92,246,0.4), 0 0 80px rgba(59,130,246,0.2)",
                  "0 0 20px rgba(139,92,246,0.2), 0 0 60px rgba(59,130,246,0.1)",
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/icon.png"
                alt="FlowSmartly"
                width={64}
                height={64}
                className="rounded-2xl"
                priority
              />
            </motion.div>
          </div>

          {/* Step text */}
          <div className="flex flex-col items-center gap-2 px-6">
            <AnimatedStepText text={currentStep} />
            <p className="text-sm text-slate-400 flex items-center">
              {subtitle}
              <LoadingDots />
            </p>
          </div>

          {/* Progress percentage */}
          {effectiveProgress > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-violet-400 to-amber-400 bg-clip-text text-transparent"
            >
              {Math.round(effectiveProgress)}%
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom progress bar */}
      {showBar && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{currentStep}</span>
            <span className="text-muted-foreground font-medium">
              {Math.round(effectiveProgress)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/50">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #f59e0b)",
                backgroundSize: "200% 100%",
              }}
              initial={{ width: "0%" }}
              animate={{
                width: `${effectiveProgress}%`,
                backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
              }}
              transition={{
                width: { duration: 0.8, ease: "easeInOut" },
                backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Small gradient spinner for button-level AI loading.
 * Drop-in replacement for `<Loader2 className="animate-spin" />`.
 */
export function AISpinner({ className }: { className?: string }) {
  const uid = useId();
  return (
    <motion.svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("inline-block", className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={`url(#as-${uid})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * 10}
        strokeDashoffset={2 * Math.PI * 10 * 0.7}
      />
      <defs>
        <linearGradient id={`as-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
