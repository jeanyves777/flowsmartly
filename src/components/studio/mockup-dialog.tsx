"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { Download, Smartphone, Globe, Image as ImageIcon, Frame, Instagram, Shirt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "./hooks/use-canvas-store";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MOCKUPS, renderMockup, type MockupId } from "./utils/mockups";

const MOCKUP_ICONS: Record<MockupId, React.ElementType> = {
  iphone: Smartphone,
  browser: Globe,
  billboard: ImageIcon,
  "framed-poster": Frame,
  "instagram-post": Instagram,
  tshirt: Shirt,
};

interface MockupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MockupDialog({ open, onOpenChange }: MockupDialogProps) {
  const canvas = useCanvasStore((s) => s.canvas);
  const designName = useCanvasStore((s) => s.designName);
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<MockupId>("iphone");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);

  // When the dialog opens, capture the current canvas as a PNG once. We
  // re-use that source for every mockup-style switch so we're not paying
  // a fresh canvas snapshot on each click.
  useEffect(() => {
    if (!open || !canvas) return;
    try {
      // Reset viewport to identity so the snapshot isn't shifted by zoom/pan
      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
      setSourceDataUrl(dataUrl);
      setPreviewUrl(null);
    } catch (e) {
      console.error("[MockupDialog] Failed to snapshot canvas:", e);
      toast({ title: "Couldn't read the canvas", variant: "destructive" });
    }
  }, [open, canvas, toast]);

  // Render the chosen mockup whenever selection or source changes
  useEffect(() => {
    if (!sourceDataUrl) return;
    let cancelled = false;
    setIsRendering(true);
    setPreviewUrl(null);
    renderMockup(selectedId, sourceDataUrl)
      .then((url) => {
        if (cancelled) return;
        setPreviewUrl(url);
      })
      .catch((err) => {
        console.error("[MockupDialog] render failed:", err);
        if (!cancelled) toast({ title: "Mockup render failed", variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });
    return () => { cancelled = true; };
  }, [sourceDataUrl, selectedId, toast]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${(designName || "design").replace(/[^a-z0-9-_]+/gi, "_")}-${selectedId}-mockup.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Mockup Preview</DialogTitle>
          <DialogDescription>
            Composite your design into a polished frame for sharing or pitching.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[180px_1fr] gap-4 min-h-0 flex-1">
          {/* Mockup picker */}
          <div className="space-y-1.5 overflow-y-auto pr-1">
            {MOCKUPS.map((m) => {
              const Icon = MOCKUP_ICONS[m.id];
              const isActive = selectedId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full text-left p-2.5 rounded-md border transition-colors",
                    isActive
                      ? "border-brand-500 bg-brand-500/5"
                      : "border-border hover:border-brand-500/50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-brand-600" : "text-muted-foreground",
                      )}
                    />
                    <span className="text-sm font-medium">{m.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                    {m.description}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                    {m.designRatio}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Preview area */}
          <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30 rounded-md border overflow-hidden">
            {!sourceDataUrl ? (
              <p className="text-xs text-muted-foreground">Capturing canvas…</p>
            ) : isRendering ? (
              <div className="flex flex-col items-center gap-2">
                <AISpinner className="h-6 w-6 animate-spin" />
                <p className="text-xs text-muted-foreground">Rendering {selectedId} mockup…</p>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt={`${selectedId} mockup preview`}
                className="max-w-full max-h-[60vh] object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">No preview yet</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            Renders client-side at high resolution — no credits charged.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!previewUrl || isRendering}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
