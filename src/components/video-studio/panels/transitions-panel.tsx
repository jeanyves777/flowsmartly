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
  { id: "none", label: "None", icon: "\u2014", description: "Hard cut" },
  { id: "crossfade", label: "Crossfade", icon: "x", description: "Smooth blend" },
  { id: "wipe-left", label: "Wipe Left", icon: "\u2190", description: "Wipe from right" },
  { id: "wipe-right", label: "Wipe Right", icon: "\u2192", description: "Wipe from left" },
  { id: "slide", label: "Slide", icon: "\u21E5", description: "Slide in" },
  { id: "dissolve", label: "Dissolve", icon: "\u25CC", description: "Pixel dissolve" },
];

export function TransitionsPanel() {
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const clips = useVideoStore((s) => s.clips);
  const updateClip = useVideoStore((s) => s.updateClip);

  const selectedClip = selectedClipIds.length === 1 ? clips[selectedClipIds[0]] : null;
  const isVideoOrImage = selectedClip?.type === "video" || selectedClip?.type === "image";

  const currentTransIn = selectedClip?.transitionType || "none";
  const currentTransInDur = selectedClip?.transitionDuration || 0.5;
  const currentTransOut = selectedClip?.transitionOutType || "none";
  const currentTransOutDur = selectedClip?.transitionOutDuration || 0.5;

  const handleApplyTransition = (type: TransitionType, side: "in" | "out") => {
    if (!selectedClip) return;
    if (side === "in") {
      updateClip(selectedClip.id, {
        transitionType: type,
        transitionDuration: type === "none" ? 0 : currentTransInDur,
      });
    } else {
      updateClip(selectedClip.id, {
        transitionOutType: type,
        transitionOutDuration: type === "none" ? 0 : currentTransOutDur,
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, type: TransitionType) => {
    e.dataTransfer.setData("transition-type", type);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="space-y-4">
      {/* Drag-and-drop section (always visible) */}
      <div className="space-y-1.5">
        <Label className="text-xs">Drag onto clip edges</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {TRANSITIONS.filter((t) => t.id !== "none").map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => handleDragStart(e, t.id)}
              className="flex flex-col items-center gap-0.5 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors"
            >
              <span className="text-base">{t.icon}</span>
              <span className="text-[9px] font-medium">{t.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground">
          Drag a transition onto the left or right edge of a video/image clip
        </p>
      </div>

      {/* Selected clip controls */}
      {!selectedClip || !isVideoOrImage ? (
        <div className="text-center py-4">
          <ArrowLeftRight className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
          <p className="text-xs text-muted-foreground">
            Select a video/image clip to configure transitions
          </p>
        </div>
      ) : (
        <>
          {/* Transition In */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Transition In (start)</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TRANSITIONS.map((t) => {
                const isSelected = currentTransIn === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleApplyTransition(t.id, "in")}
                    className={`relative flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {isSelected && t.id !== "none" && (
                      <div className="absolute top-0.5 right-0.5">
                        <Check className="h-2.5 w-2.5 text-brand-500" />
                      </div>
                    )}
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[9px] font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {currentTransIn !== "none" && (
              <div className="space-y-1">
                <Label className="text-[10px]">
                  Duration: {currentTransInDur.toFixed(1)}s
                </Label>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={currentTransInDur}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      transitionDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-brand-500"
                />
              </div>
            )}
          </div>

          {/* Transition Out */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Transition Out (end)</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {TRANSITIONS.map((t) => {
                const isSelected = currentTransOut === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleApplyTransition(t.id, "out")}
                    className={`relative flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {isSelected && t.id !== "none" && (
                      <div className="absolute top-0.5 right-0.5">
                        <Check className="h-2.5 w-2.5 text-brand-500" />
                      </div>
                    )}
                    <span className="text-base">{t.icon}</span>
                    <span className="text-[9px] font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
            {currentTransOut !== "none" && (
              <div className="space-y-1">
                <Label className="text-[10px]">
                  Duration: {currentTransOutDur.toFixed(1)}s
                </Label>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={currentTransOutDur}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      transitionOutDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-brand-500"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
