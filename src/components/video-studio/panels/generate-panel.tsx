"use client";

import { useState, useCallback } from "react";
import { Wand2, Sparkles, Film, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useVideoStore } from "../hooks/use-video-store";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import {
  VIDEO_CATEGORIES,
  VIDEO_DURATIONS,
  ASPECT_RATIO_OPTIONS,
  getExtensionCount,
  type VideoCategory,
  type AspectRatio,
  type DurationOption,
} from "@/lib/constants/video-presets";

const PROVIDERS = [
  { id: "veo3", label: "Veo 3", desc: "Google AI video", icon: Film },
  { id: "slideshow", label: "Slideshow", desc: "Image-based", icon: ImageIcon },
] as const;

type Provider = (typeof PROVIDERS)[number]["id"];

export function GeneratePanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const isGenerating = useVideoStore((s) => s.isGenerating);
  const generationStatus = useVideoStore((s) => s.generationStatus);
  const setGenerating = useVideoStore((s) => s.setGenerating);

  const [provider, setProvider] = useState<Provider>("veo3");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState<VideoCategory>("product_ad");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [duration, setDuration] = useState<DurationOption>(VIDEO_DURATIONS[2]);

  const { toast } = useToast();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }

    setGenerating(true, "Initializing...");

    try {
      const res = await fetch("/api/ai/video-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          category,
          aspectRatio,
          duration: duration.seconds,
          style: "cinematic",
          resolution: "720p",
          provider,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === "INSUFFICIENT_CREDITS") {
          handleCreditError(err);
          return;
        }
        throw new Error(err.error || "Generation failed");
      }

      // SSE streaming for progress
      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let finalData: { url?: string; designId?: string; duration?: number } | null = null;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.status) setGenerating(true, data.status);
                  if (data.url) finalData = data;
                } catch {}
              }
            }
          }
        }

        if (finalData?.url) {
          addVideoToTimeline(finalData.url, finalData.duration || duration.seconds);
        }
      } else {
        // Non-streaming response
        const data = await res.json();
        if (data.url || data.data?.url) {
          addVideoToTimeline(data.url || data.data.url, data.duration || duration.seconds);
        }
      }

      toast({ title: "Video generated and added to timeline" });
    } catch (err: unknown) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [prompt, category, aspectRatio, duration, provider, addClip, tracks, toast, setGenerating]);

  const addVideoToTimeline = useCallback(
    (url: string, dur: number) => {
      const videoTrack = tracks.find((t) => t.type === "video");
      if (!videoTrack) return;

      addClip({
        type: "video",
        trackId: videoTrack.id,
        startTime: 0,
        duration: dur,
        trimStart: 0,
        trimEnd: 0,
        sourceUrl: url,
        sourceDuration: dur,
        name: `AI Video - ${prompt.slice(0, 30)}`,
        volume: 1,
        muted: false,
        aiGenerated: true,
        aiProvider: provider,
        aiPrompt: prompt,
      });
    },
    [tracks, addClip, prompt, provider]
  );

  const extCount = provider === "veo3" ? getExtensionCount(duration.seconds) : 0;
  const creditCost = provider === "slideshow" ? 25 : Math.round(60 * (1 + extCount));

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Provider</Label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                  provider === p.id
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt */}
      <div className="space-y-1.5">
        <Label className="text-xs">Prompt</Label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the video you want to create..."
          className="w-full h-24 px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label className="text-xs">Category</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {VIDEO_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id as VideoCategory)}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                category === cat.id
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-1.5">
        <Label className="text-xs">Aspect Ratio</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIO_OPTIONS.map((ar) => (
            <button
              key={ar.id}
              onClick={() => setAspectRatio(ar.id as AspectRatio)}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                aspectRatio === ar.id
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs">Duration</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {VIDEO_DURATIONS.map((d) => (
            <button
              key={d.seconds}
              onClick={() => setDuration(d)}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                duration.seconds === d.seconds
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full gap-2"
      >
        {isGenerating ? (
          <>
            <Sparkles className="h-4 w-4 animate-spin" />
            {generationStatus || "Generating..."}
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Generate Video
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {creditCost} credits
            </Badge>
          </>
        )}
      </Button>
    </div>
  );
}
