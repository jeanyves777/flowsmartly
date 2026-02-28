"use client";

import { useState, useCallback } from "react";
import { Music, Upload, Volume2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useVideoStore } from "../hooks/use-video-store";

export function AudioPanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const addTrack = useVideoStore((s) => s.addTrack);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) return;
        const data = await res.json();
        const url = data.url || data.data?.url;
        if (!url) return;

        const dur = await getAudioDuration(url);

        let audioTrack = tracks.find((t) => t.type === "audio");
        if (!audioTrack) {
          const trackId = addTrack("audio");
          audioTrack = useVideoStore.getState().tracks.find((t) => t.id === trackId);
          if (!audioTrack) return;
        }

        addClip({
          type: "audio",
          trackId: audioTrack.id,
          startTime: 0,
          duration: dur,
          trimStart: 0,
          trimEnd: 0,
          sourceUrl: url,
          sourceDuration: dur,
          name: file.name,
          volume: 1,
          muted: false,
        });
      } finally {
        setIsUploading(false);
        e.target.value = "";
      }
    },
    [addClip, tracks, addTrack]
  );

  return (
    <div className="space-y-4">
      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors">
        <Music className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm font-medium">
          {isUploading ? "Uploading..." : "Upload Audio"}
        </span>
        <span className="text-xs text-muted-foreground">
          MP3, WAV, AAC, FLAC
        </span>
        <input
          type="file"
          className="hidden"
          accept="audio/*"
          onChange={handleUpload}
          disabled={isUploading}
        />
      </label>

      {/* Tips */}
      <div className="space-y-2">
        <Label className="text-xs">Tips</Label>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p>- Upload background music or sound effects</p>
          <p>- Adjust volume per clip in the timeline</p>
          <p>- Use the Voice panel for AI voiceovers</p>
          <p>- Audio from AI videos is auto-detached</p>
        </div>
      </div>
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
