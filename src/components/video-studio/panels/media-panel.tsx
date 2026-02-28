"use client";

import { useState, useCallback } from "react";
import { Upload, Film, Image as ImageIcon, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoStore } from "../hooks/use-video-store";
import type { ClipType } from "@/lib/video-editor/types";

function detectClipType(mimeType: string): ClipType {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("image/")) return "image";
  return "video";
}

export function MediaPanel() {
  const addClip = useVideoStore((s) => s.addClip);
  const tracks = useVideoStore((s) => s.tracks);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      setIsUploading(true);
      try {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.append("file", file);

          const res = await fetch("/api/media", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) continue;
          const data = await res.json();
          const url = data.url || data.data?.url;
          if (!url) continue;

          const clipType = detectClipType(file.type);
          const trackType = clipType === "audio" ? "audio" : "video";
          const targetTrack = tracks.find((t) => t.type === trackType);
          if (!targetTrack) continue;

          // Get media duration if video/audio
          let duration = 5; // default for images
          if (clipType === "video" || clipType === "audio") {
            duration = await getMediaDuration(url);
          }

          addClip({
            type: clipType,
            trackId: targetTrack.id,
            startTime: 0,
            duration,
            trimStart: 0,
            trimEnd: 0,
            sourceUrl: url,
            sourceDuration: duration,
            name: file.name,
            volume: 1,
            muted: false,
          });
        }
      } finally {
        setIsUploading(false);
        // Reset input
        e.target.value = "";
      }
    },
    [addClip, tracks]
  );

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors">
        <Upload className="h-8 w-8 text-muted-foreground" />
        <span className="text-sm font-medium">
          {isUploading ? "Uploading..." : "Upload Media"}
        </span>
        <span className="text-xs text-muted-foreground">
          Video, images, or audio
        </span>
        <input
          type="file"
          className="hidden"
          accept="video/*,image/*,audio/*"
          multiple
          onChange={handleFileUpload}
          disabled={isUploading}
        />
      </label>

      {/* Quick add section */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Quick Add
        </p>
        <div className="grid grid-cols-3 gap-2">
          <QuickButton
            icon={Film}
            label="Video"
            accept="video/*"
            onUpload={handleFileUpload}
          />
          <QuickButton
            icon={ImageIcon}
            label="Image"
            accept="image/*"
            onUpload={handleFileUpload}
          />
          <QuickButton
            icon={Music}
            label="Audio"
            accept="audio/*"
            onUpload={handleFileUpload}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-center pt-2">
        Drag & drop files onto the timeline
      </div>
    </div>
  );
}

function QuickButton({
  icon: Icon,
  label,
  accept,
  onUpload,
}: {
  icon: React.ElementType;
  label: string;
  accept: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10px]">{label}</span>
      <input type="file" className="hidden" accept={accept} onChange={onUpload} />
    </label>
  );
}

function getMediaDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      resolve(el.duration || 5);
      el.remove();
    };
    el.onerror = () => {
      // Try as audio
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        resolve(audio.duration || 5);
        audio.remove();
      };
      audio.onerror = () => resolve(5);
      audio.src = url;
    };
    el.src = url;
  });
}
