"use client";

import { useState } from "react";
import { Type, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useVideoStore } from "../hooks/use-video-store";
import type { TextClipStyle, TextAnimation } from "@/lib/video-editor/types";

const TEXT_PRESETS: {
  label: string;
  description: string;
  style: Partial<TextClipStyle>;
}[] = [
  {
    label: "Title",
    description: "Large bold heading",
    style: {
      fontFamily: "Inter",
      fontSize: 72,
      fontColor: "#ffffff",
      fontWeight: "bold",
      textAlign: "center",
      position: { x: 50, y: 40 },
    },
  },
  {
    label: "Subtitle",
    description: "Medium text below title",
    style: {
      fontFamily: "Inter",
      fontSize: 36,
      fontColor: "#ffffff",
      fontWeight: "normal",
      textAlign: "center",
      position: { x: 50, y: 60 },
    },
  },
  {
    label: "Lower Third",
    description: "Name/title bar at bottom",
    style: {
      fontFamily: "Inter",
      fontSize: 28,
      fontColor: "#ffffff",
      fontWeight: "bold",
      textAlign: "left",
      backgroundColor: "rgba(0,0,0,0.6)",
      position: { x: 10, y: 85 },
    },
  },
  {
    label: "Call-out",
    description: "Highlighted centered text",
    style: {
      fontFamily: "Inter",
      fontSize: 42,
      fontColor: "#FFD700",
      fontWeight: "bold",
      textAlign: "center",
      position: { x: 50, y: 50 },
    },
  },
];

const ANIMATIONS: { id: TextAnimation; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade-in", label: "Fade In" },
  { id: "slide-up", label: "Slide Up" },
  { id: "slide-left", label: "Slide Left" },
  { id: "typewriter", label: "Typewriter" },
];

export function VideoTextPanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const addTrack = useVideoStore((s) => s.addTrack);

  const [text, setText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [animation, setAnimation] = useState<TextAnimation>("fade-in");
  const [duration, setDuration] = useState(5);

  const handleAddText = (presetIndex?: number) => {
    const actualText = text.trim() || "Your text here";
    const preset = TEXT_PRESETS[presetIndex ?? selectedPreset];

    // Find or create a text track
    let textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) {
      const trackId = addTrack("text");
      textTrack = useVideoStore.getState().tracks.find((t) => t.id === trackId);
      if (!textTrack) return;
    }

    addClip({
      type: "text",
      trackId: textTrack.id,
      startTime: 0,
      duration,
      trimStart: 0,
      trimEnd: 0,
      sourceUrl: "",
      sourceDuration: duration,
      name: `Text - ${actualText.slice(0, 20)}`,
      volume: 1,
      muted: false,
      textContent: actualText,
      textStyle: {
        fontFamily: preset.style.fontFamily || "Inter",
        fontSize: preset.style.fontSize || 36,
        fontColor: preset.style.fontColor || "#ffffff",
        fontWeight: preset.style.fontWeight || "normal",
        textAlign: preset.style.textAlign || "center",
        backgroundColor: preset.style.backgroundColor,
        position: preset.style.position || { x: 50, y: 50 },
        animation,
      },
    });

    // Clear input after adding
    setText("");
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Type your text */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">1. Type your text</Label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your text here..."
          className="w-full h-24 px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Step 2: Choose a style */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">2. Choose a style</Label>
        <div className="grid grid-cols-2 gap-2">
          {TEXT_PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => setSelectedPreset(i)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                selectedPreset === i
                  ? "border-brand-500 bg-brand-500/10"
                  : "hover:border-brand-500/50 hover:bg-brand-500/5"
              }`}
            >
              <span
                className="font-medium"
                style={{
                  fontSize: preset.style.fontSize
                    ? `${Math.min(preset.style.fontSize / 4, 18)}px`
                    : "14px",
                  color: preset.style.fontColor || "#fff",
                  fontWeight: preset.style.fontWeight || "normal",
                  textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                }}
              >
                Aa
              </span>
              <span className="text-[11px] font-medium">{preset.label}</span>
              <span className="text-[9px] text-muted-foreground">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Animation */}
      <div className="space-y-1.5">
        <Label className="text-xs">Animation</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {ANIMATIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAnimation(a.id)}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                animation === a.id
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs">Duration: {duration}s</Label>
        <input
          type="range"
          min={1}
          max={30}
          step={0.5}
          value={duration}
          onChange={(e) => setDuration(parseFloat(e.target.value))}
          className="w-full accent-brand-500"
        />
      </div>

      {/* Add button */}
      <Button onClick={() => handleAddText()} className="w-full gap-2">
        <Plus className="h-4 w-4" />
        Add Text to Timeline
      </Button>
    </div>
  );
}
