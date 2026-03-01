"use client";

import { useState, useMemo } from "react";
import { Captions, Check, Loader2, Mic, Music, Trash2, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useVideoStore } from "../hooks/use-video-store";
import {
  generateCaptionsFromTTSScript,
  createCaptionClipData,
} from "@/lib/video-editor/caption-sync";
import type { CaptionStyleId } from "@/lib/cartoon/caption-generator";
import type { TimedWord } from "@/lib/video-editor/types";

const CAPTION_STYLES: {
  id: CaptionStyleId;
  label: string;
  preview: string;
  description: string;
}[] = [
  { id: "classic", label: "Classic", preview: "Aa", description: "White text with dark outline" },
  { id: "bold_pop", label: "Bold Pop", preview: "Aa", description: "Large bold colorful text" },
  { id: "boxed", label: "Boxed", preview: "Aa", description: "Text in a dark background box" },
  { id: "cinematic", label: "Cinematic", preview: "Aa", description: "Elegant serif with letterboxing" },
  { id: "colorful", label: "Colorful", preview: "Aa", description: "Vibrant multi-color text" },
  { id: "karaoke", label: "Karaoke", preview: "Aa", description: "Word-by-word highlight" },
  { id: "minimal", label: "Minimal", preview: "Aa", description: "Small clean lower-left" },
  { id: "subtitle_bar", label: "Subtitle Bar", preview: "Aa", description: "Full-width bar at bottom" },
  { id: "neon", label: "Neon", preview: "Aa", description: "Glowing neon text effect" },
];

const POSITIONS = [
  { id: "top", label: "Top" },
  { id: "center", label: "Center" },
  { id: "bottom", label: "Bottom" },
] as const;

export function CaptionsPanel() {
  const clips = useVideoStore((s) => s.clips);
  const tracks = useVideoStore((s) => s.tracks);
  const addClip = useVideoStore((s) => s.addClip);
  const updateClip = useVideoStore((s) => s.updateClip);
  const removeClip = useVideoStore((s) => s.removeClip);
  const addTrack = useVideoStore((s) => s.addTrack);
  const captionSettings = useVideoStore((s) => s.captionSettings);
  const setCaptionSettings = useVideoStore((s) => s.setCaptionSettings);

  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Find all audio/voiceover clips
  const audioClips = useMemo(
    () =>
      Object.values(clips).filter(
        (c) => c.type === "audio" || c.type === "voiceover"
      ),
    [clips]
  );

  // Find all existing caption clips
  const captionClips = useMemo(
    () =>
      Object.values(clips).filter(
        (c) => c.type === "caption" && c.captionData
      ),
    [clips]
  );

  // Map of audioClipId → captionClipId
  const audioCaptionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cc of captionClips) {
      if (cc.captionData?.linkedAudioClipId) {
        map[cc.captionData.linkedAudioClipId] = cc.id;
      }
    }
    return map;
  }, [captionClips]);

  const findOrCreateCaptionTrack = () => {
    const existing = tracks.find((t) => t.type === "caption");
    if (existing) return existing.id;
    return addTrack("caption", "Captions");
  };

  const handleGenerateCaptions = async (audioClipId: string) => {
    const audioClip = clips[audioClipId];
    if (!audioClip) return;

    setGeneratingFor(audioClipId);
    setError(null);

    try {
      let words: TimedWord[];

      if (audioClip.type === "voiceover" && audioClip.aiPrompt) {
        // For TTS-generated voiceovers, we know the script — estimate timing
        words = generateCaptionsFromTTSScript(
          audioClip.aiPrompt,
          audioClip.duration
        );
      } else if (audioClip.sourceUrl) {
        // For uploaded audio, transcribe via Whisper API
        const res = await fetch("/api/ai/video-editor/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioUrl: audioClip.sourceUrl }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Transcription failed");
        }

        const data = await res.json();
        words = data.data.words;
      } else {
        throw new Error("No audio source available");
      }

      // Create caption clip data
      const captionData = createCaptionClipData(
        audioClipId,
        words,
        captionSettings.defaultStyleId
      );

      // Remove existing caption for this audio if any
      const existingCaptionId = audioCaptionMap[audioClipId];
      if (existingCaptionId) {
        removeClip(existingCaptionId);
      }

      // Add caption clip to the caption track
      const captionTrackId = findOrCreateCaptionTrack();
      addClip({
        type: "caption",
        trackId: captionTrackId,
        startTime: audioClip.startTime,
        duration: audioClip.duration,
        trimStart: 0,
        trimEnd: 0,
        sourceUrl: "",
        sourceDuration: audioClip.duration,
        name: `Captions: ${audioClip.name}`,
        volume: 1,
        muted: false,
        captionData,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate captions");
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleRemoveCaption = (captionClipId: string) => {
    removeClip(captionClipId);
  };

  const handleChangeStyle = (captionClipId: string, styleId: CaptionStyleId) => {
    const clip = clips[captionClipId];
    if (!clip?.captionData) return;
    updateClip(captionClipId, {
      captionData: { ...clip.captionData, captionStyleId: styleId },
    });
  };

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

      {/* Audio clips — generate captions for each */}
      <div className="space-y-1.5">
        <Label className="text-xs">Audio Clips</Label>
        {audioClips.length === 0 ? (
          <p className="text-[10px] text-muted-foreground py-2">
            No audio or voiceover clips on the timeline. Add one first.
          </p>
        ) : (
          <div className="space-y-1.5">
            {audioClips.map((clip) => {
              const hasCaptions = !!audioCaptionMap[clip.id];
              const isGenerating = generatingFor === clip.id;
              const captionClipId = audioCaptionMap[clip.id];

              return (
                <div
                  key={clip.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
                >
                  {clip.type === "voiceover" ? (
                    <Mic className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  ) : (
                    <Music className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">
                      {clip.name}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {clip.duration.toFixed(1)}s
                      {hasCaptions && " \u2014 has captions"}
                    </p>
                  </div>
                  {hasCaptions ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleGenerateCaptions(clip.id)}
                        disabled={isGenerating}
                        title="Re-generate captions"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-500 hover:text-red-600"
                        onClick={() => handleRemoveCaption(captionClipId!)}
                        title="Remove captions"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => handleGenerateCaptions(clip.id)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Captions className="h-3 w-3 mr-1" />
                          Add Captions
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-[10px] text-red-500 mt-1">{error}</p>
        )}
      </div>

      {/* Style picker */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Caption Style
        </Label>
        <div className="grid grid-cols-3 gap-2">
          {CAPTION_STYLES.map((style) => {
            const isSelected = captionSettings.defaultStyleId === style.id;
            return (
              <button
                key={style.id}
                onClick={() => {
                  setCaptionSettings({ defaultStyleId: style.id });
                  // Also update all existing caption clips to this style
                  for (const cc of captionClips) {
                    handleChangeStyle(cc.id, style.id);
                  }
                }}
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

      {/* Existing caption clips */}
      {captionClips.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Active Captions</Label>
          {captionClips.map((cc) => {
            const linkedAudio = cc.captionData?.linkedAudioClipId
              ? clips[cc.captionData.linkedAudioClipId]
              : null;
            return (
              <div
                key={cc.id}
                className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
              >
                <Captions className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{cc.name}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {cc.captionData?.segments.length || 0} segments
                    {linkedAudio && ` \u00b7 synced to "${linkedAudio.name}"`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
        <p className="text-xs font-medium">How captions work</p>
        <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc pl-3">
          <li>Click &quot;Add Captions&quot; next to an audio clip above</li>
          <li>Voiceovers use their script text (instant)</li>
          <li>Uploaded audio is transcribed via Whisper (uses credits)</li>
          <li>Change style to update all captions at once</li>
          <li>Captions are baked into exported video</li>
        </ul>
      </div>
    </div>
  );
}
