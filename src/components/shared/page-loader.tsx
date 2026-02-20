"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface PageLoaderProps {
  /** Rotating tip messages */
  tips?: string[];
  /** Extra class names */
  className?: string;
}

function SpinnerRing({ size = 80, gradientId = "plGrad" }: { size?: number; gradientId?: string }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.svg
      width={size}
      height={size}
      className="absolute drop-shadow-[0_0_8px_rgba(139,92,246,0.2)]"
      animate={{ rotate: 360 }}
      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
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

/**
 * Shared full-page loader with animated FlowSmartly logo and spinner ring.
 * Use on any page that needs a loading state — consistent branding everywhere.
 */
export function PageLoader({ tips, className }: PageLoaderProps) {
  const uid = useId();
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!tips || tips.length <= 1) return;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [tips]);

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[60vh] gap-6", className)}>
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: 80, height: 80 }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <SpinnerRing size={80} gradientId={`pl-${uid}`} />
        <motion.div
          className="relative z-10 rounded-xl overflow-hidden"
          animate={{
            boxShadow: [
              "0 0 12px rgba(139,92,246,0.2), 0 0 40px rgba(59,130,246,0.1)",
              "0 0 20px rgba(139,92,246,0.4), 0 0 50px rgba(59,130,246,0.2)",
              "0 0 12px rgba(139,92,246,0.2), 0 0 40px rgba(59,130,246,0.1)",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image src="/icon.png" alt="FlowSmartly" width={40} height={40} className="rounded-xl" priority />
        </motion.div>
      </motion.div>

      {tips && tips.length > 0 && (
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="text-sm text-muted-foreground"
          >
            {tips[tipIndex]}
          </motion.p>
        </AnimatePresence>
      )}
    </div>
  );
}
