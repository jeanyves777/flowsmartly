"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVideoStore } from "./hooks/use-video-store";
import { useVideoExport } from "./hooks/use-video-export";
import type { ExportSettings } from "@/lib/video-editor/types";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RESOLUTIONS = ["480p", "720p", "1080p"] as const;
const QUALITIES = [
  { id: "draft", label: "Draft", desc: "Fast, lower quality" },
  { id: "standard", label: "Standard", desc: "Balanced" },
  { id: "high", label: "High", desc: "Best quality, slower" },
] as const;
const FPS_OPTIONS = [24, 30, 60] as const;

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const isExporting = useVideoStore((s) => s.isExporting);
  const exportProgress = useVideoStore((s) => s.exportProgress);
  const captionSettings = useVideoStore((s) => s.captionSettings);
  const { startExport } = useVideoExport();

  const [settings, setSettings] = useState<ExportSettings>({
    format: "mp4",
    quality: "standard",
    resolution: "720p",
    fps: 30,
    includeAudio: true,
    captionStyleId: captionSettings.defaultStyleId,
  });

  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const handleExport = async () => {
    const result = await startExport(settings);
    if (result?.url) {
      setExportUrl(result.url);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      setExportUrl(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
        </DialogHeader>

        {exportUrl ? (
          /* Success state */
          <div className="space-y-4 py-2">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <Download className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium">Export complete!</p>
            </div>
            <Button asChild className="w-full">
              <a href={exportUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download Video
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setExportUrl(null);
                onOpenChange(false);
              }}
            >
              Close
            </Button>
          </div>
        ) : isExporting ? (
          /* Exporting state */
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Exporting...</span>
                <span className="font-mono">{Math.round(exportProgress)}%</span>
              </div>
              <Progress value={exportProgress} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Please don't close this window
            </p>
          </div>
        ) : (
          /* Settings form */
          <div className="space-y-4">
            {/* Resolution */}
            <div className="space-y-1.5">
              <Label className="text-xs">Resolution</Label>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSettings({ ...settings, resolution: r })}
                    className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                      settings.resolution === r
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="space-y-1.5">
              <Label className="text-xs">Quality</Label>
              <div className="space-y-1.5">
                {QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        quality: q.id as ExportSettings["quality"],
                      })
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      settings.quality === q.id
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <span className="text-sm font-medium">{q.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {q.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div className="space-y-1.5">
              <Label className="text-xs">Frame Rate</Label>
              <div className="grid grid-cols-3 gap-2">
                {FPS_OPTIONS.map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        fps: f as ExportSettings["fps"],
                      })
                    }
                    className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
                      settings.fps === f
                        ? "border-brand-500 bg-brand-500/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {f} fps
                  </button>
                ))}
              </div>
            </div>

            {/* Export button */}
            <Button onClick={handleExport} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Export Video
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
