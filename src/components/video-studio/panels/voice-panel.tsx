"use client";

import { useState, useCallback, useEffect } from "react";
import { Mic2, Sparkles, Plus, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useVideoStore } from "../hooks/use-video-store";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";

interface VoiceProfile {
  id: string;
  name: string;
  openaiVoiceId: string | null;
  elevenLabsVoiceId: string | null;
}

const BUILTIN_VOICES = [
  { id: "alloy", name: "Alloy", gender: "neutral" },
  { id: "echo", name: "Echo", gender: "male" },
  { id: "fable", name: "Fable", gender: "male" },
  { id: "onyx", name: "Onyx", gender: "male" },
  { id: "nova", name: "Nova", gender: "female" },
  { id: "shimmer", name: "Shimmer", gender: "female" },
  { id: "ash", name: "Ash", gender: "male" },
  { id: "coral", name: "Coral", gender: "female" },
  { id: "sage", name: "Sage", gender: "neutral" },
];

export function VoicePanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const { toast } = useToast();

  const [voice, setVoice] = useState("nova");
  const [script, setScript] = useState("");
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

  // Load voice profiles
  useEffect(() => {
    fetch("/api/ai/voice-studio/profiles")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data) setProfiles(data.data);
      })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!script.trim()) {
      toast({ title: "Enter a script", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
      const useCloned = selectedProfile && (selectedProfile.openaiVoiceId || selectedProfile.elevenLabsVoiceId);

      const res = await fetch("/api/ai/voice-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          voice,
          speed,
          useClonedVoice: !!useCloned,
          profileId: selectedProfileId,
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

        // Get duration
        const dur = await getAudioDuration(audioUrl);

        // Add to audio track
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
  }, [script, voice, speed, selectedProfileId, profiles, addClip, tracks, toast]);

  return (
    <div className="space-y-4">
      {/* Voice selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">Voice</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {BUILTIN_VOICES.map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setVoice(v.id);
                setSelectedProfileId(null);
              }}
              className={`text-[11px] px-2 py-1.5 rounded-md border transition-colors ${
                voice === v.id && !selectedProfileId
                  ? "border-brand-500 bg-brand-500/5 text-brand-600"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              {v.name}
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
                onClick={() => {
                  setSelectedProfileId(p.id);
                  setVoice("");
                }}
                className={`w-full text-left text-xs px-3 py-2 rounded-md border flex items-center gap-2 transition-colors ${
                  selectedProfileId === p.id
                    ? "border-brand-500 bg-brand-500/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <Mic2 className="h-3 w-3 text-purple-500 shrink-0" />
                <span className="truncate">{p.name}</span>
                <Badge variant="outline" className="ml-auto text-[9px] shrink-0">
                  Cloned
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Speed */}
      <div className="space-y-1.5">
        <Label className="text-xs">Speed: {speed}x</Label>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full accent-brand-500"
        />
      </div>

      {/* Script */}
      <div className="space-y-1.5">
        <Label className="text-xs">Script</Label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Type or paste your voiceover script..."
          className="w-full h-32 px-3 py-2 text-sm rounded-lg border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-brand-500"
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
