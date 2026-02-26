"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PostSharePanel } from "@/components/shared/post-share-panel";
import { useCanvasStore } from "./hooks/use-canvas-store";
import { useCanvasExport } from "./hooks/use-canvas-export";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const designName = useCanvasStore((s) => s.designName);
  const { getCanvasDataUrl } = useCanvasExport();

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportAndUpload = useCallback(async () => {
    setIsUploading(true);
    setError(null);
    try {
      const dataUrl = getCanvasDataUrl("png", 2);
      if (!dataUrl) throw new Error("Failed to export canvas");

      const blob = await fetch(dataUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append("file", blob, `${designName || "design"}.png`);
      formData.append("tags", JSON.stringify(["studio-share"]));

      const res = await fetch("/api/media", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error("Upload failed");

      setMediaUrl(data.data.file.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare image");
    } finally {
      setIsUploading(false);
    }
  }, [getCanvasDataUrl, designName]);

  useEffect(() => {
    if (open && !mediaUrl && !isUploading) {
      exportAndUpload();
    }
    if (!open) {
      setMediaUrl(null);
      setError(null);
    }
  }, [open, exportAndUpload, mediaUrl, isUploading]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {isUploading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin" />
              <Share2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-brand-500" />
            </div>
            <p className="text-sm font-medium">Preparing your design...</p>
            <p className="text-xs text-muted-foreground">Exporting and uploading</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={exportAndUpload}>
              Try Again
            </Button>
          </div>
        ) : mediaUrl ? (
          <PostSharePanel
            mediaUrl={mediaUrl}
            mediaType="image"
            prompt={designName}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
