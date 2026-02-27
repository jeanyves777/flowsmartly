"use client";

import { useState, useEffect, useCallback } from "react";
import { Share2, Loader2 } from "lucide-react";
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

interface SocialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SocialDialog({ open, onOpenChange }: SocialDialogProps) {
  const designId = useCanvasStore((s) => s.designId);
  const designName = useCanvasStore((s) => s.designName);
  const { getCanvasDataUrl } = useCanvasExport();

  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setMediaUrls([]);
      setMediaError(null);
    }
  }, [open]);

  const exportAndUpload = useCallback(async () => {
    if (mediaUrls.length > 0 || isUploadingMedia) return;
    setIsUploadingMedia(true);
    setMediaError(null);
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
      setMediaUrls([data.data.file.url]);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : "Failed to prepare image");
    } finally {
      setIsUploadingMedia(false);
    }
  }, [getCanvasDataUrl, designName, mediaUrls.length, isUploadingMedia]);

  // Auto-export when dialog opens
  useEffect(() => {
    if (open && mediaUrls.length === 0 && !isUploadingMedia) {
      exportAndUpload();
    }
  }, [open, exportAndUpload, mediaUrls.length, isUploadingMedia]);

  const needsSave = !designId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-white" />
            </div>
            Post to Social
          </DialogTitle>
        </DialogHeader>

        {needsSave ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">Save your design first to share it.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.dispatchEvent(new CustomEvent("studio:save"))}
            >
              Save Now
            </Button>
          </div>
        ) : isUploadingMedia ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin" />
              <Share2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-brand-500" />
            </div>
            <p className="text-sm font-medium">Preparing your design...</p>
          </div>
        ) : mediaError ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">{mediaError}</p>
            <Button variant="outline" size="sm" onClick={exportAndUpload}>Try Again</Button>
          </div>
        ) : mediaUrls.length > 0 ? (
          <PostSharePanel
            mediaUrls={mediaUrls}
            mediaType="image"
            prompt={designName}
            bare
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
