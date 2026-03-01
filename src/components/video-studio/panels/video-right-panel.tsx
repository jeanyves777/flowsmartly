"use client";

import { X, Volume2, VolumeX, Move, Maximize2, RotateCcw, Eye, Gauge, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVideoStore } from "../hooks/use-video-store";
import type { TimelineClip, TransitionType, TextAnimation } from "@/lib/video-editor/types";

const TRANSITION_OPTIONS: { id: TransitionType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "crossfade", label: "Crossfade" },
  { id: "wipe-left", label: "Wipe Left" },
  { id: "wipe-right", label: "Wipe Right" },
  { id: "slide", label: "Slide" },
  { id: "dissolve", label: "Dissolve" },
];

export function VideoRightPanel() {
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const clips = useVideoStore((s) => s.clips);
  const updateClip = useVideoStore((s) => s.updateClip);
  const isRightPanelCollapsed = useVideoStore((s) => s.isRightPanelCollapsed);
  const toggleRightPanel = useVideoStore((s) => s.toggleRightPanel);

  const selectedClip = selectedClipIds.length === 1 ? clips[selectedClipIds[0]] : null;

  if (isRightPanelCollapsed) return null;

  return (
    <div className="w-[260px] border-l bg-background flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Properties
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleRightPanel}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Empty state when no clip selected */}
      {!selectedClip ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <MousePointerClick className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-xs font-medium text-muted-foreground">No clip selected</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Click a clip in the preview or timeline to see its properties
          </p>
        </div>
      ) : (
      /* Content */
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Clip info */}
        <div className="space-y-1">
          <Label className="text-xs">Name</Label>
          <input
            type="text"
            value={selectedClip.name}
            onChange={(e) =>
              updateClip(selectedClip.id, { name: e.target.value })
            }
            className="w-full px-2 py-1.5 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Type</Label>
            <p className="text-xs font-medium capitalize">{selectedClip.type}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Duration</Label>
            <p className="text-xs font-medium font-mono">
              {selectedClip.duration.toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Timing */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Timing</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Start</Label>
              <input
                type="number"
                value={selectedClip.startTime.toFixed(1)}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    startTime: Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                step={0.1}
                min={0}
                className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Duration</Label>
              <input
                type="number"
                value={selectedClip.duration.toFixed(1)}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    duration: Math.max(0.1, parseFloat(e.target.value) || 0.1),
                  })
                }
                step={0.1}
                min={0.1}
                className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
              />
            </div>
          </div>
        </div>

        {/* Transform (video/image clips) */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Transform</Label>
              <button
                onClick={() =>
                  updateClip(selectedClip.id, {
                    transform: { x: 0, y: 0, scale: 1 },
                  })
                }
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                title="Reset transform"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Move className="h-3 w-3" /> X
                </Label>
                <input
                  type="number"
                  value={Math.round(selectedClip.transform?.x ?? 0)}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      transform: {
                        ...(selectedClip.transform || { x: 0, y: 0, scale: 1 }),
                        x: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step={1}
                  className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Move className="h-3 w-3" /> Y
                </Label>
                <input
                  type="number"
                  value={Math.round(selectedClip.transform?.y ?? 0)}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      transform: {
                        ...(selectedClip.transform || { x: 0, y: 0, scale: 1 }),
                        y: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  step={1}
                  className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Maximize2 className="h-3 w-3" /> Scale: {Math.round((selectedClip.transform?.scale ?? 1) * 100)}%
              </Label>
              <input
                type="range"
                min={10}
                max={500}
                step={5}
                value={Math.round((selectedClip.transform?.scale ?? 1) * 100)}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    transform: {
                      ...(selectedClip.transform || { x: 0, y: 0, scale: 1 }),
                      scale: parseInt(e.target.value) / 100,
                    },
                  })
                }
                className="w-full accent-brand-500"
              />
            </div>
          </div>
        )}

        {/* Opacity (video/image clips) */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> Opacity: {Math.round((selectedClip.opacity ?? 1) * 100)}%
            </Label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((selectedClip.opacity ?? 1) * 100)}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  opacity: parseInt(e.target.value) / 100,
                })
              }
              className="w-full accent-brand-500"
            />
          </div>
        )}

        {/* Speed (video, audio, voiceover clips) */}
        {(selectedClip.type === "video" ||
          selectedClip.type === "audio" ||
          selectedClip.type === "voiceover") && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3 w-3" /> Speed: {(selectedClip.speed ?? 1).toFixed(2)}x
            </Label>
            <input
              type="range"
              min={25}
              max={400}
              step={25}
              value={Math.round((selectedClip.speed ?? 1) * 100)}
              onChange={(e) =>
                updateClip(selectedClip.id, {
                  speed: parseInt(e.target.value) / 100,
                })
              }
              className="w-full accent-brand-500"
            />
          </div>
        )}

        {/* Audio controls (video, audio, voiceover) */}
        {(selectedClip.type === "video" ||
          selectedClip.type === "audio" ||
          selectedClip.type === "voiceover") && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Audio</Label>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateClip(selectedClip.id, { muted: !selectedClip.muted })
                }
                className="p-1 rounded hover:bg-muted"
              >
                {selectedClip.muted ? (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={selectedClip.volume}
                onChange={(e) =>
                  updateClip(selectedClip.id, {
                    volume: parseFloat(e.target.value),
                  })
                }
                className="flex-1 accent-brand-500"
              />
              <span className="text-[10px] font-mono w-8 text-right">
                {Math.round(selectedClip.volume * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Transitions (video/image clips) */}
        {(selectedClip.type === "video" || selectedClip.type === "image") && (
          <>
            {/* Transition In */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Transition In</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      updateClip(selectedClip.id, {
                        transitionType: opt.id,
                        transitionDuration: opt.id === "none" ? 0 : (selectedClip.transitionDuration || 0.5),
                      })
                    }
                    className={`text-[10px] px-1.5 py-1 rounded-md border transition-colors ${
                      (selectedClip.transitionType || "none") === opt.id
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedClip.transitionType && selectedClip.transitionType !== "none" && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Duration: {(selectedClip.transitionDuration || 0.5).toFixed(1)}s
                  </Label>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={selectedClip.transitionDuration || 0.5}
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
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Transition Out</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {TRANSITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      updateClip(selectedClip.id, {
                        transitionOutType: opt.id,
                        transitionOutDuration: opt.id === "none" ? 0 : (selectedClip.transitionOutDuration || 0.5),
                      })
                    }
                    className={`text-[10px] px-1.5 py-1 rounded-md border transition-colors ${
                      (selectedClip.transitionOutType || "none") === opt.id
                        ? "border-brand-500 bg-brand-500/10 text-brand-600"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {selectedClip.transitionOutType && selectedClip.transitionOutType !== "none" && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Duration: {(selectedClip.transitionOutDuration || 0.5).toFixed(1)}s
                  </Label>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={selectedClip.transitionOutDuration || 0.5}
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

        {/* Text properties */}
        {selectedClip.type === "text" && selectedClip.textStyle && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Text</Label>
            <textarea
              value={selectedClip.textContent || ""}
              onChange={(e) =>
                updateClip(selectedClip.id, { textContent: e.target.value })
              }
              className="w-full h-16 px-2 py-1.5 text-sm rounded-md border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Font Size
                </Label>
                <input
                  type="number"
                  value={selectedClip.textStyle.fontSize}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        fontSize: parseInt(e.target.value) || 36,
                      },
                    })
                  }
                  min={8}
                  max={200}
                  className="w-full px-2 py-1 text-xs rounded-md border bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Color
                </Label>
                <input
                  type="color"
                  value={selectedClip.textStyle.fontColor}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        fontColor: e.target.value,
                      },
                    })
                  }
                  className="w-full h-7 rounded-md border cursor-pointer"
                />
              </div>
            </div>

            {/* Text position */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Position X
                </Label>
                <input
                  type="number"
                  value={Math.round(selectedClip.textStyle.position.x)}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        position: {
                          ...selectedClip.textStyle!.position,
                          x: Math.max(0, Math.min(100, parseInt(e.target.value) || 50)),
                        },
                      },
                    })
                  }
                  min={0}
                  max={100}
                  className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">
                  Position Y
                </Label>
                <input
                  type="number"
                  value={Math.round(selectedClip.textStyle.position.y)}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        position: {
                          ...selectedClip.textStyle!.position,
                          y: Math.max(0, Math.min(100, parseInt(e.target.value) || 50)),
                        },
                      },
                    })
                  }
                  min={0}
                  max={100}
                  className="w-full px-2 py-1 text-xs rounded-md border bg-background font-mono"
                />
              </div>
            </div>

            {/* Font weight */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Weight</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["normal", "bold"] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() =>
                      updateClip(selectedClip.id, {
                        textStyle: { ...selectedClip.textStyle!, fontWeight: w },
                      })
                    }
                    className={`text-[10px] px-2 py-1 rounded-md border capitalize ${
                      selectedClip.textStyle!.fontWeight === w
                        ? "border-brand-500 bg-brand-500/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* Background color */}
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Background
              </Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedClip.textStyle.backgroundColor || "#000000"}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        backgroundColor: e.target.value,
                      },
                    })
                  }
                  className="w-8 h-7 rounded-md border cursor-pointer"
                />
                <button
                  onClick={() =>
                    updateClip(selectedClip.id, {
                      textStyle: {
                        ...selectedClip.textStyle!,
                        backgroundColor: undefined,
                      },
                    })
                  }
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI info */}
        {selectedClip.aiGenerated && (
          <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              AI Generated
            </Label>
            <p className="text-xs">
              Provider: <span className="font-mono">{selectedClip.aiProvider}</span>
            </p>
            {selectedClip.aiPrompt && (
              <p className="text-[10px] text-muted-foreground line-clamp-3">
                {selectedClip.aiPrompt}
              </p>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
