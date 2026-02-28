"use client";

import { useState, useCallback, useEffect } from "react";
import { Mic2, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useVideoStore } from "../hooks/use-video-store";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import {
  GENDERS,
  ACCENTS,
  STYLES,
  VOICE_PRESETS,
  type VoiceGender,
  type VoiceAccent,
  type VoiceStyle,
} from "@/lib/voice/voice-presets";

interface VoiceProfile {
  id: string;
  name: string;
  openaiVoiceId: string | null;
  elevenLabsVoiceId: string | null;
}

export function VoicePanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const { toast } = useToast();

  const [gender, setGender] = useState<string>("female");
  const [accent, setAccent] = useState<string>("american");
  const [style, setStyle] = useState<string>("professional");
  const [speed, setSpeed] = useState(1);
  const [script, setScript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // Derive active preset
  const activePresetId = VOICE_PRESETS.find(
    (p) => p.gender === gender && p.accent === accent && p.style === style
  )?.id;

  // Load voice profiles
  useEffect(() => {
    fetch("/api/ai/voice-studio/profiles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) setProfiles(data.data);
      })
      .catch(() => {});
  }, []);

  const applyPreset = (preset: (typeof VOICE_PRESETS)[number]) => {
    setGender(preset.gender);
    setAccent(preset.accent);
    setStyle(preset.style);
    setSelectedProfileId(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!script.trim()) {
      toast({ title: "Enter a script", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
      const useCloned =
        selectedProfile &&
        (selectedProfile.openaiVoiceId || selectedProfile.elevenLabsVoiceId);

      const res = await fetch("/api/ai/voice-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          gender,
          accent,
          style,
          speed,
          useClonedVoice: !!useCloned,
          voiceProfileId: selectedProfileId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.code === "INSUFFICIENT_CREDITS") {
          handleCreditError(err);
          return;
        }
        throw new Error(err.error || "Voice generation failed");
      }

      const data = await res.json();
      const audioUrl = data.data?.audioUrl || data.audioUrl;

      if (audioUrl) {
        setGeneratedAudioUrl(audioUrl);

        const dur = await getAudioDuration(audioUrl);

        const audioTrack = tracks.find((t) => t.type === "audio");
        if (audioTrack) {
          addClip({
            type: "voiceover",
            trackId: audioTrack.id,
            startTime: 0,
            duration: dur,
            trimStart: 0,
            trimEnd: 0,
            sourceUrl: audioUrl,
            sourceDuration: dur,
            name: `Voiceover - ${script.slice(0, 25)}`,
            volume: 1,
            muted: false,
            aiGenerated: true,
            aiProvider: "openai-tts",
            aiPrompt: script,
          });
        }

        toast({ title: "Voiceover generated and added to timeline" });
      }
    } catch (err: unknown) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [script, gender, accent, style, speed, selectedProfileId, profiles, addClip, tracks, toast]);

  return (
    <div className="space-y-4">
      {/* Quick Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-brand-500" />
          <Label className="text-xs font-medium">Quick Presets</Label>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {VOICE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className={`text-left px-2.5 py-2 rounded-lg border transition-all ${
                activePresetId === preset.id
                  ? "border-brand-500 bg-brand-500/10 shadow-[0_0_8px_rgba(147,51,234,0.2)]"
                  : "border-border hover:border-brand-500/50 hover:bg-muted/50"
              }`}
            >
              <p className="text-[11px] font-medium text-foreground leading-tight">
                {preset.name}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <Label className="text-xs">Gender</Label>
        <div className="flex gap-1.5">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGender(g.id);
                setSelectedProfileId(null);
              }}
              className={`flex-1 text-[11px] font-medium py-1.5 rounded-full transition-all ${
                gender === g.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-muted border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent */}
      <div className="space-y-1.5">
        <Label className="text-xs">Accent</Label>
        <div className="flex flex-wrap gap-1">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAccent(a.id);
                setSelectedProfileId(null);
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                accent === a.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-muted border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="space-y-1.5">
        <Label className="text-xs">Style</Label>
        <div className="flex flex-wrap gap-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setStyle(s.id);
                setSelectedProfileId(null);
              }}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                style === s.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-muted border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cloned voices */}
      {profiles.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Cloned Voices</Label>
          <div className="space-y-1">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`w-full text-left text-xs px-3 py-2 rounded-md border flex items-center gap-2 transition-colors ${
                  selectedProfileId === p.id
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Mic2 className="h-3 w-3 text-purple-500 shrink-0" />
                <span className="truncate">{p.name}</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-[9px] shrink-0"
                >
                  Cloned
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Speed */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Speed</Label>
          <span className="text-[11px] font-mono text-brand-500">
            {speed.toFixed(1)}x
          </span>
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.25}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between px-0.5">
          <span className="text-[9px] text-muted-foreground">0.5x</span>
          <span className="text-[9px] text-muted-foreground">1.0x</span>
          <span className="text-[9px] text-muted-foreground">1.5x</span>
          <span className="text-[9px] text-muted-foreground">2.0x</span>
        </div>
      </div>

      {/* Script */}
      <div className="space-y-1.5">
        <Label className="text-xs">Script</Label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Type or paste your voiceover script..."
          className="w-full h-28 px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {script.split(/\s+/).filter(Boolean).length} words
        </p>
      </div>

      {/* Preview */}
      {generatedAudioUrl && (
        <div className="p-2 rounded-lg bg-muted/50 border">
          <audio src={generatedAudioUrl} controls className="w-full h-8" />
        </div>
      )}

      {/* Generate */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !script.trim()}
        className="w-full gap-2"
      >
        {isGenerating ? (
          <>
            <Sparkles className="h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4" />
            Generate Voiceover
          </>
        )}
      </Button>
    </div>
  );
}

function getAudioDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(audio.duration || 5);
      audio.remove();
    };
    audio.onerror = () => resolve(5);
    audio.src = url;
  });
}
