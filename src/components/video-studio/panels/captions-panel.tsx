"use client";

import { useState } from "react";
import { Captions, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useVideoStore } from "../hooks/use-video-store";
import type { CaptionStyleId } from "@/lib/cartoon/caption-generator";

const CAPTION_STYLES: {
  id: CaptionStyleId;
  label: string;
  preview: string;
  description: string;
}[] = [
  {
    id: "classic",
    label: "Classic",
    preview: "Aa",
    description: "White text with dark outline",
  },
  {
    id: "bold_pop",
    label: "Bold Pop",
    preview: "Aa",
    description: "Large bold colorful text",
  },
  {
    id: "boxed",
    label: "Boxed",
    preview: "Aa",
    description: "Text in a dark background box",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    preview: "Aa",
    description: "Elegant serif with letterboxing",
  },
  {
    id: "colorful",
    label: "Colorful",
    preview: "Aa",
    description: "Vibrant multi-color text",
  },
  {
    id: "karaoke",
    label: "Karaoke",
    preview: "Aa",
    description: "Word-by-word highlight",
  },
  {
    id: "minimal",
    label: "Minimal",
    preview: "Aa",
    description: "Small clean lower-left",
  },
  {
    id: "subtitle_bar",
    label: "Subtitle Bar",
    preview: "Aa",
    description: "Full-width bar at bottom",
  },
  {
    id: "neon",
    label: "Neon",
    preview: "Aa",
    description: "Glowing neon text effect",
  },
];

const POSITIONS = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
] as const;

export function CaptionsPanel() {
  const captionSettings = useVideoStore((s) => s.captionSettings);
  const setCaptionSettings = useVideoStore((s) => s.setCaptionSettings);

  return (
    <div className="space-y-4">
      {/* Auto-caption toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium">Auto-Caption</Label>
          <p className="text-[10px] text-muted-foreground">
            Auto-generate for new audio
          </p>
        </div>
        <Switch
          checked={captionSettings.autoCaption}
          onCheckedChange={(checked) =>
            setCaptionSettings({ autoCaption: checked })
          }
        />
      </div>

      {/* Style picker */}
      <div className="space-y-1.5">
        <Label className="text-xs">Caption Style</Label>
        <div className="grid grid-cols-3 gap-2">
          {CAPTION_STYLES.map((style) => {
            const isSelected = captionSettings.defaultStyleId === style.id;
            return (
              <button
                key={style.id}
                onClick={() =>
                  setCaptionSettings({ defaultStyleId: style.id })
                }
                className={`relative flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-colors ${
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
                <div
                  className={`text-lg font-bold ${
                    style.id === "neon"
                      ? "text-cyan-400 drop-shadow-[0_0_4px_rgba(0,255,255,0.5)]"
                      : style.id === "bold_pop"
                        ? "text-yellow-500"
                        : style.id === "colorful"
                          ? "bg-gradient-to-r from-pink-500 to-blue-500 bg-clip-text text-transparent"
                          : ""
                  }`}
                >
                  {style.preview}
                </div>
                <span className="text-[10px] font-medium">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Position */}
      <div className="space-y-1.5">
        <Label className="text-xs">Default Position</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos.id}
              onClick={() => setCaptionSettings({ globalPosition: pos.id })}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                captionSettings.globalPosition === pos.id
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-xs font-medium">How captions work</p>
        <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc pl-3">
          <li>Voiceovers auto-generate word-timed captions</li>
          <li>Uploaded audio is transcribed via Whisper</li>
          <li>Double-click caption clips to edit text</li>
          <li>Captions are baked into exported video</li>
        </ul>
      </div>
    </div>
  );
}
