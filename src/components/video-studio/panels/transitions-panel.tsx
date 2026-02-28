"use client";

import { ArrowLeftRight, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useVideoStore } from "../hooks/use-video-store";
import type { TransitionType } from "@/lib/video-editor/types";

const TRANSITIONS: {
  id: TransitionType;
  label: string;
  icon: string;
  description: string;
}[] = [
  { id: "none", label: "None", icon: "—", description: "Hard cut" },
  { id: "crossfade", label: "Crossfade", icon: "x", description: "Smooth blend" },
  { id: "wipe-left", label: "Wipe Left", icon: "←", description: "Wipe from right" },
  { id: "wipe-right", label: "Wipe Right", icon: "→", description: "Wipe from left" },
  { id: "slide", label: "Slide", icon: "⇥", description: "Slide in" },
  { id: "dissolve", label: "Dissolve", icon: "◌", description: "Pixel dissolve" },
];

export function TransitionsPanel() {
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const clips = useVideoStore((s) => s.clips);
  const updateClip = useVideoStore((s) => s.updateClip);

  const selectedClip = selectedClipIds.length === 1 ? clips[selectedClipIds[0]] : null;
  const currentTransition = selectedClip?.transitionType || "none";
  const currentDuration = selectedClip?.transitionDuration || 0.5;

  const handleApplyTransition = (type: TransitionType) => {
    if (!selectedClip) return;
    updateClip(selectedClip.id, {
      transitionType: type,
      transitionDuration: type === "none" ? 0 : currentDuration,
    });
  };

  return (
    <div className="space-y-4">
      {!selectedClip ? (
        <div className="text-center py-8">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Select a clip to apply transitions
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Click a video clip on the timeline
          </p>
        </div>
      ) : (
        <>
          {/* Transition type */}
          <div className="space-y-1.5">
            <Label className="text-xs">Transition Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {TRANSITIONS.map((t) => {
                const isSelected = currentTransition === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleApplyTransition(t.id)}
                    className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3 text-brand-500" />
                      </div>
                    )}
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-[10px] font-medium">{t.label}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration */}
          {currentTransition !== "none" && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Duration: {currentDuration.toFixed(1)}s
              </Label>
              <input
                type="range"
                min={0.1}
                max={3}
                step={0.1}
                value={currentDuration}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    transitionDuration: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-brand-500"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
