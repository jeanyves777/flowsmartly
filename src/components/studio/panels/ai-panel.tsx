"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Crop,
  ImagePlus,
  Maximize2,
  MousePointerSquareDashed,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { handleCreditError } from "@/components/payments/credit-purchase-modal";
import { AISpinner } from "@/components/shared/ai-generation-loader";
import { MediaUploader } from "@/components/shared/media-uploader";
import { useToast } from "@/hooks/use-toast";
import { emitCreditsUpdate } from "@/lib/utils/credits-event";
import { useCanvasExport } from "../hooks/use-canvas-export";
import { useCanvasStore } from "../hooks/use-canvas-store";
import { addImageToCanvas } from "../utils/canvas-helpers";

const promptPresets = [
  "Make the design cleaner and more premium",
  "Replace the selected subject using my reference",
  "Remove the extra object and blend the background",
  "Match the style of my reference images",
  "Make the text more readable",
  "Blend the subject naturally into the flyer",
];

export function AiPanel() {
  const { toast } = useToast();
  const canvas = useCanvasStore((s) => s.canvas);
  const canvasWidth = useCanvasStore((s) => s.canvasWidth);
  const canvasHeight = useCanvasStore((s) => s.canvasHeight);
  const selectedObjectIds = useCanvasStore((s) => s.selectedObjectIds);
  const regionSelectMode = useCanvasStore((s) => s.regionSelectMode);
  const setRegionSelectMode = useCanvasStore((s) => s.setRegionSelectMode);
  const aiSelectedRegion = useCanvasStore((s) => s.aiSelectedRegion);
  const setAiSelectedRegion = useCanvasStore((s) => s.setAiSelectedRegion);
  const { getCanvasDataUrl } = useCanvasExport();

  const [isImproving, setIsImproving] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [instruction, setInstruction] = useState("");
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ai/studio");
        const data = await res.json();
        if (data.success) setCreditsRemaining(data.data.stats?.creditsRemaining ?? 0);
      } catch {
        // Credit count is helpful but should never block the editor.
      }
    })();
  }, []);

  const selectionRegion = useMemo(() => {
    if (!canvas || selectedObjectIds.length === 0) return null;
    const active = canvas.getActiveObject?.();
    if (!active) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = (active as any).getBoundingRect?.();
    if (!bounds) return null;
    return {
      x: Math.max(0, Math.round(bounds.left)),
      y: Math.max(0, Math.round(bounds.top)),
      w: Math.min(canvasWidth, Math.round(bounds.width)),
      h: Math.min(canvasHeight, Math.round(bounds.height)),
      canvasW: canvasWidth,
      canvasH: canvasHeight,
    };
  }, [canvas, canvasHeight, canvasWidth, selectedObjectIds]);

  const effectiveRegion = aiSelectedRegion ?? selectionRegion ?? null;
  const regionLabel = effectiveRegion
    ? `${effectiveRegion.w}x${effectiveRegion.h}px region`
    : "Whole canvas";

  const handleApplyEdit = async () => {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      toast({ title: "Describe what to change", variant: "destructive" });
      return;
    }
    if (!canvas) return;

    if (regionSelectMode) setRegionSelectMode(false);

    setIsImproving(true);
    try {
      const dataUrl = getCanvasDataUrl("png", 1);
      if (!dataUrl) throw new Error("Failed to export canvas");

      const blob = await fetch(dataUrl).then((res) => res.blob());
      const formData = new FormData();
      formData.append("file", blob, "canvas-export.png");
      formData.append("tags", JSON.stringify(["studio-export"]));

      const uploadRes = await fetch("/api/media", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error("Upload failed");

      const res = await fetch("/api/ai/visual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanInstruction,
          category: "social_post",
          size: `${canvasWidth}x${canvasHeight}`,
          style: "modern",
          provider: "xai",
          heroType: "people",
          textMode: "exact",
          editImageUrl: uploadData.data.file.url,
          editRegion: effectiveRegion,
          editIntent: "auto",
          editReferenceMode: "adapt",
          editReferenceImageUrls: referenceUrls,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (handleCreditError(data.error || {}, "AI design")) return;
        throw new Error(data.error?.message || "AI edit failed");
      }

      if (data.data?.design?.imageUrl && canvas) {
        const fabric = await import("fabric");
        await addImageToCanvas(canvas, data.data.design.imageUrl, fabric);
      }

      if (data.data?.creditsRemaining !== undefined) {
        setCreditsRemaining(data.data.creditsRemaining);
        emitCreditsUpdate(data.data.creditsRemaining);
      }

      setInstruction("");
      setAiSelectedRegion(null);
      toast({ title: "Edit applied" });
    } catch (error) {
      toast({
        title: "AI edit failed",
        description: error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-brand-500" />
          AI Design
        </h3>
        <span className="text-[10px] text-muted-foreground">{creditsRemaining} credits</span>
      </div>

      <div className="space-y-2">
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Tell FlowAI what to change, remove, improve, replace, or match..."
          className="min-h-[132px] w-full resize-none rounded-md border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <Button
          onClick={handleApplyEdit}
          disabled={isImproving || !instruction.trim()}
          className="h-10 w-full gap-2"
        >
          {isImproving ? <AISpinner className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {isImproving ? "Applying edit..." : "Apply AI edit"}
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <ImagePlus className="h-3.5 w-3.5" />
          Reference media
        </div>
        <MediaUploader
          value={referenceUrls}
          onChange={setReferenceUrls}
          maxFiles={4}
          accept="image/png,image/jpeg,image/jpg,image/webp"
          filterTypes={["image"]}
          variant="small"
          placeholder="Add references"
          libraryTitle="Pick reference images"
          className="rounded-md border bg-muted/20 p-2"
        />
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Edit area
        </div>

        <div
          className={`flex items-center gap-2 rounded-md border p-2 ${
            effectiveRegion ? "border-brand-500/50 bg-brand-500/5" : "border-border bg-muted/30"
          }`}
        >
          {effectiveRegion ? (
            <Crop className="h-4 w-4 shrink-0 text-brand-500" />
          ) : (
            <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{regionLabel}</div>
            {effectiveRegion ? (
              <div className="truncate text-[10px] text-muted-foreground">
                at ({effectiveRegion.x}, {effectiveRegion.y}) on {effectiveRegion.canvasW}x{effectiveRegion.canvasH}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground">AI will read the full design</div>
            )}
          </div>
          {aiSelectedRegion && (
            <button
              type="button"
              onClick={() => setAiSelectedRegion(null)}
              className="-mr-1 rounded p-1 text-muted-foreground hover:bg-muted"
              title="Clear pinpoint"
              aria-label="Clear pinpoint region"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={regionSelectMode ? "default" : "outline"}
            className="h-8 gap-1.5 text-[11px]"
            onClick={() => {
              setAiSelectedRegion(null);
              setRegionSelectMode(!regionSelectMode);
            }}
          >
            <Crop className="h-3.5 w-3.5" />
            {regionSelectMode ? "Drawing..." : "Pinpoint area"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-[11px]"
            disabled={!selectionRegion}
            onClick={() => {
              if (selectionRegion) setAiSelectedRegion(selectionRegion);
            }}
          >
            <MousePointerSquareDashed className="h-3.5 w-3.5" />
            Use selected
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Quick prompts
        </div>
        <div className="flex flex-wrap gap-1">
          {promptPresets.map((preset) => (
            <Badge
              key={preset}
              variant="outline"
              className="cursor-pointer text-[10px] hover:bg-brand-500/10"
              onClick={() => setInstruction(preset)}
            >
              {preset}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
