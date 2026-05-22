"use client";

import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";

interface Props {
  open: boolean;
  currentStep: string;
  subtitle?: string;
  progress?: number;
  /** Render z-index. Defaults to 50. Use higher (e.g. 100) when stacking above a FloatingPanel. */
  zIndex?: number;
}

/**
 * Shared full-screen overlay for long AI operations.
 *
 * Renders the branded `AIGenerationLoader` (compact) inside a centered card
 * over a soft semi-transparent black backdrop — never a giant near-black void
 * over the page.
 *
 * Use this anywhere a long AI op (>2s) runs: bulk creation with AI fill,
 * image / video pre-generation, strategy generation, cascading cancels, etc.
 * Always also keep the inline `AISpinner` on the trigger button.
 */
export function AILoaderOverlay({
  open,
  currentStep,
  subtitle,
  progress,
  zIndex = 50,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex }}
    >
      <div className="bg-card border rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <AIGenerationLoader
          compact
          currentStep={currentStep}
          subtitle={subtitle}
          progress={progress}
        />
      </div>
    </div>
  );
}
