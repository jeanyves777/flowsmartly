"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils/cn";

interface AIGenerationLoaderProps {
  /** Current step description, e.g. "Generating video..." */
  currentStep?: string;
  /** Progress percentage 0-100. Pass undefined for indeterminate. */
  progress?: number;
  /** Subtitle hint, e.g. "This may take 1-2 minutes" */
  subtitle?: string;
  /** Optional icon to show instead of default spinner */
  icon?: React.ReactNode;
  /** Extra class names for the outer container */
  className?: string;
  /** Whether to show the progress bar (default: true when progress is defined) */
  showProgressBar?: boolean;
}

/**
 * Shared AI generation loader used across all AI features
 * (Video Studio, Cartoon Maker, etc.)
 *
 * Shows a large animated spinner, current step text, subtitle, and progress bar.
 */
export function AIGenerationLoader({
  currentStep = "Generating...",
  progress,
  subtitle = "This may take a few minutes",
  icon,
  className,
  showProgressBar,
}: AIGenerationLoaderProps) {
  const showBar = showProgressBar ?? progress !== undefined;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Visual area */}
      <div className="aspect-video bg-muted rounded-xl flex flex-col items-center justify-center">
        {icon || (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="h-16 w-16 text-brand-500" />
          </motion.div>
        )}
        <p className="text-lg font-medium mt-4">{currentStep}</p>
        <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
      </div>

      {/* Progress bar */}
      {showBar && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{currentStep}</span>
            {progress !== undefined && (
              <span className="text-muted-foreground">{Math.round(progress)}%</span>
            )}
          </div>
          {progress !== undefined ? (
            <Progress value={progress} className="h-3" />
          ) : (
            <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full bg-brand-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 120, ease: "linear" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
